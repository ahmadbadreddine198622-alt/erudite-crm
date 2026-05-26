import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');

    // Helper
    const igFetch = (path) =>
      fetch(`https://graph.instagram.com/v21.0${path}${path.includes('?') ? '&' : '?'}access_token=${accessToken}`)
        .then(r => r.json());

    if (action === 'get_account') {
      const me = await igFetch('/me?fields=id,username,name,profile_picture_url,followers_count,media_count');
      return Response.json(me);
    }

    if (action === 'get_posts') {
      const me = await igFetch('/me?fields=id');
      const media = await igFetch(`/${me.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count&limit=12`);
      return Response.json(media);
    }

    if (action === 'get_comments') {
      const { post_id } = body;
      const comments = await igFetch(`/${post_id}/comments?fields=id,text,username,timestamp,replies{id,text,username,timestamp}&limit=50`);
      return Response.json(comments);
    }

    if (action === 'reply_comment') {
      const { post_id, message } = body;
      const res = await fetch(`https://graph.instagram.com/v21.0/${post_id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: accessToken }),
      });
      const data = await res.json();
      return Response.json(data);
    }

    if (action === 'sync_leads') {
      // Fetch recent posts and their comments, auto-create leads from keyword matches
      const { keywords = ['interested', 'price', 'info', 'details', 'how much', 'available', 'whatsapp', 'contact'] } = body;
      const me = await igFetch('/me?fields=id');
      const media = await igFetch(`/${me.id}/media?fields=id,caption,permalink,timestamp&limit=10`);

      const newLeads = [];
      for (const post of (media.data || [])) {
        const commentsRes = await igFetch(`/${post.id}/comments?fields=id,text,username,timestamp&limit=50`);
        for (const comment of (commentsRes.data || [])) {
          const matchedKeyword = keywords.find(k => comment.text.toLowerCase().includes(k.toLowerCase()));
          if (!matchedKeyword) continue;

          // Check if lead already exists
          const existing = await base44.asServiceRole.entities.Lead.filter({
            'source_metadata.comment_id': comment.id
          });
          if (existing.length > 0) continue;

          const lead = await base44.asServiceRole.entities.Lead.create({
            name: '@' + comment.username,
            source: 'social_media',
            stage: 'new_lead',
            tags: ['instagram', matchedKeyword],
            notes: `Instagram comment: "${comment.text}"\nPost: ${post.permalink}`,
            source_metadata: {
              channel: 'instagram',
              username: comment.username,
              comment: comment.text,
              comment_id: comment.id,
              post_url: post.permalink,
              post_id: post.id,
              keyword_triggered: matchedKeyword,
              synced_at: new Date().toISOString(),
            },
          });
          newLeads.push(lead);
        }
      }

      return Response.json({ synced: newLeads.length, leads: newLeads });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});