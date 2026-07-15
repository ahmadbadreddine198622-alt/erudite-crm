import { base44 } from '@/api/base44Client';

/**
 * Fetch ALL records for an entity, regardless of dataset size.
 *
 * The platform does NOT support $lt/$gt range filters on built-in fields
 * (updated_date, created_date, id), so cursor pagination is impossible —
 * a `{ updated_date: { $lt: cursor } }` filter silently returns zero records.
 * This helper uses skip/offset pagination instead: loops `entity.list(sort, 1000, skip)`,
 * increasing `skip` by 1000 each iteration, until a page returns fewer than 1000 records.
 *
 * Keep this as the single source of truth for full-table loads so every call site
 * scales past the old capped `list()` calls.
 *
 * @param {object} entity  — base44.entities.<Name> (has .list(sort, limit, skip))
 * @param {string} [sort]  — sort order, defaults to '-updated_date'
 * @returns {Promise<Array>}
 */
export async function fetchAllRecords(entity, sort = '-updated_date') {
  if (!entity || typeof entity.list !== 'function') {
    throw new Error('fetchAllRecords: entity must expose a .list() method');
  }
  const all = [];
  const pageSize = 1000;
  let skip = 0;
  while (true) {
    const batch = await entity.list(sort, pageSize, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

export default fetchAllRecords;