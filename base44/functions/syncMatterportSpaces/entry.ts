/**
 * syncMatterportSpaces
 * 
 * Read-only sync from Matterport API into PropCRM.
 * Fetches all Matterport Spaces, matches them to CRM units by unit_reference,
 * and writes 3D tour links + floor plan data.
 * 
 * Matching: Extracts unit reference from Space name (e.g. "Peninsula 2 - 3403")
 * and matches to LandlordProperty.unit_reference (case-insensitive, normalized).
 * Unmatched spaces are logged but not written.
 * 
 * Returns: JSON summary with matched/unmatched counts and details.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MATTERPORT_API_ENDPOINT = 'https://api.matterport.com/api/models/graph';

// Normalize a unit reference for matching (remove special chars, lowercase, collapse spaces)
function normalizeUnitRef(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // remove punctuation
    .replace(/\s+/g, ' ')         // collapse spaces
    .trim();
}

// Try to match a normalized space name to a unit reference
function matchSpaceToUnit(
  normalizedSpaceName: string,
  landlordProperties: Array<any>
): { property: any; confidence: 'exact' | 'partial' } | null {
  const matches: Array<{ property: any; score: number }> = [];
  
  for (const lp of landlordProperties) {
    const unitRef = normalizeUnitRef(lp.unit_reference || '');
    if (!unitRef) continue;
    
    // Exact match after normalization
    if (normalizedSpaceName === unitRef) {
      return { property: lp, confidence: 'exact' };
    }
    
    // Partial match: space name contains the unit reference or vice versa
    const spaceParts = normalizedSpaceName.split(' ');
    const unitParts = unitRef.split(' ');
    
    const unitInSpace = unitParts.every(part => spaceParts.includes(part));
    const spaceInUnit = spaceParts.every(part => unitParts.includes(part));
    
    if (unitInSpace || spaceInUnit) {
      matches.push({ property: lp, score: unitInSpace ? 2 : 1 });
    }
  }
  
  if (matches.length === 0) return null;
  if (matches.length === 1) return { property: matches[0].property, confidence: 'partial' };
  
  matches.sort((a, b) => b.score - a.score);
  if (matches[0].score > matches[1]?.score) {
    return { property: matches[0].property, confidence: 'partial' };
  }
  
  return null;
}

const GET_SPACES_QUERY = `
  query GetModels($cursor: String) {
    models(first: 50, after: $cursor) {
      edges {
        node {
          id
          name
          status
          createdDate
          showcaseUrl
          floorPlanUrl
          hasFloorPlan
          dimensions {
            width
            height
            depth
          }
          photos {
            edges {
              node {
                url
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchAllMatterportSpaces(apiToken: string): Promise<Array<any>> {
  const allSpaces: Array<any> = [];
  let cursor: string | null = null;
  let hasMore = true;
  
  const token = btoa(`${apiToken}:`);
  
  while (hasMore) {
    const variables = cursor ? { cursor } : {};
    
    const response = await fetch(MATTERPORT_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${token}`,
      },
      body: JSON.stringify({
        query: GET_SPACES_QUERY,
        variables,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Matterport API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    const edges = result.data?.models?.edges || [];
    for (const edge of edges) {
      allSpaces.push(edge.node);
    }
    
    hasMore = result.data?.models?.pageInfo?.hasNextPage || false;
    cursor = result.data?.models?.pageInfo?.endCursor || null;
  }
  
  return allSpaces;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const apiToken = Deno.env.get('MATTERPORT_API_TOKEN');
    if (!apiToken) {
      return Response.json({ error: 'MATTERPORT_API_TOKEN not configured' }, { status: 500 });
    }
    
    console.log('Fetching Matterport spaces...');
    const spaces = await fetchAllMatterportSpaces(apiToken);
    console.log(`Fetched ${spaces.length} spaces`);
    
    console.log('Fetching CRM data...');
    const landlordProperties = await base44.asServiceRole.entities.LandlordProperty.list();
    const photographyTasks = await base44.asServiceRole.entities.PhotographyTask.list();
    const existingMatterportSpaces = await base44.asServiceRole.entities.MatterportSpace.list();
    
    console.log(`Found ${landlordProperties.length} LandlordProperties, ${photographyTasks.length} PhotographyTasks, ${existingMatterportSpaces.length} existing MatterportSpaces`);
    
    const results = {
      totalSpacesFetched: spaces.length,
      matched: [] as Array<any>,
      unmatched: [] as Array<any>,
      errors: [] as Array<any>,
    };
    
    for (const space of spaces) {
      try {
        const normalizedSpaceName = normalizeUnitRef(space.name || '');
        
        if (!normalizedSpaceName) {
          results.unmatched.push({
            spaceId: space.id,
            spaceName: space.name || 'Unknown',
            reason: 'Empty or invalid space name',
          });
          continue;
        }
        
        const match = matchSpaceToUnit(normalizedSpaceName, landlordProperties);
        
        if (!match) {
          results.unmatched.push({
            spaceId: space.id,
            spaceName: space.name || 'Unknown',
            reason: 'No matching unit found',
          });
          continue;
        }
        
        const lp = match.property;
        const lpId = lp.id;
        console.log(`Matched space "${space.name}" to unit "${lp.unit_reference}" (${match.confidence} confidence)`);
        
        let photographyTask = photographyTasks.find(pt => pt.landlord_property_id === lpId);
        let photographyTaskId: string | undefined = undefined;
        
        const existingMpSpace = existingMatterportSpaces.find(ms => ms.matterport_space_id === space.id);
        
        const mpSpaceData: any = {
          matterport_space_id: space.id,
          name: space.name || '',
          tour_url: space.showcaseUrl || '',
          thumbnail_url: space.photos?.edges?.[0]?.node?.url || '',
          status: space.status || '',
          scan_date: space.createdDate || undefined,
          details_json: JSON.stringify({
            dimensions: space.dimensions,
            hasFloorPlan: space.hasFloorPlan,
            floorPlanUrl: space.floorPlanUrl,
          }),
          linked_landlord_property_id: lpId,
          last_synced_at: new Date().toISOString(),
        };
        
        let mpSpaceId: string;
        if (existingMpSpace) {
          await base44.asServiceRole.entities.MatterportSpace.update(existingMpSpace.id, mpSpaceData);
          mpSpaceId = existingMpSpace.id;
          mpSpaceData.linked_photography_task_id = existingMpSpace.linked_photography_task_id;
          console.log(`Updated MatterportSpace ${existingMpSpace.id}`);
        } else {
          const newMpSpace = await base44.asServiceRole.entities.MatterportSpace.create(mpSpaceData);
          mpSpaceId = newMpSpace.id;
          console.log(`Created MatterportSpace ${newMpSpace.id}`);
        }
        
        let tourLinkWritten = false;
        if (space.showcaseUrl) {
          if (photographyTask) {
            await base44.asServiceRole.entities.PhotographyTask.update(photographyTask.id, {
              tour_3d_link: space.showcaseUrl,
            });
            photographyTaskId = photographyTask.id;
            tourLinkWritten = true;
            console.log(`Updated PhotographyTask ${photographyTask.id} with tour link`);
          } else {
            const newTask = await base44.asServiceRole.entities.PhotographyTask.create({
              landlord_id: lp.landlord_id,
              landlord_property_id: lpId,
              tour_3d_link: space.showcaseUrl,
              task_stage: 'uploaded_3d',
              uploaded_3d_at: new Date().toISOString(),
            });
            photographyTaskId = newTask.id;
            tourLinkWritten = true;
            console.log(`Created PhotographyTask ${newTask.id} with tour link`);
            
            await base44.asServiceRole.entities.MatterportSpace.update(mpSpaceId, {
              linked_photography_task_id: newTask.id,
            });
          }
        }
        
        let floorPlanWritten = false;
        if (space.hasFloorPlan && space.floorPlanUrl) {
          await base44.asServiceRole.entities.LandlordProperty.update(lpId, {
            has_floor_plan: true,
            floor_plan_url: space.floorPlanUrl,
          });
          floorPlanWritten = true;
          console.log(`Updated LandlordProperty ${lpId} with floor plan`);
        }
        
        results.matched.push({
          spaceId: space.id,
          spaceName: space.name || 'Unknown',
          unitReference: lp.unit_reference || 'Unknown',
          landlordPropertyId: lpId,
          photographyTaskId,
          matterportSpaceId: mpSpaceId,
          tourLinkWritten,
          floorPlanWritten,
          confidence: match.confidence,
        });
        
      } catch (error) {
        console.error(`Error processing space ${space.id}:`, error);
        results.errors.push({
          spaceId: space.id,
          spaceName: space.name || 'Unknown',
          error: error.message,
        });
      }
    }
    
    const summary = {
      totalFetched: results.totalSpacesFetched,
      matchedCount: results.matched.length,
      unmatchedCount: results.unmatched.length,
      errorCount: results.errors.length,
      tourLinksWritten: results.matched.filter(m => m.tourLinkWritten).length,
      floorPlansWritten: results.matched.filter(m => m.floorPlanWritten).length,
    };
    
    console.log(`Sync complete: ${JSON.stringify(summary)}`);
    
    return Response.json({
      success: true,
      summary,
      matched: results.matched,
      unmatched: results.unmatched,
      errors: results.errors,
    });
    
  } catch (error) {
    console.error('Matterport sync failed:', error);
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
});