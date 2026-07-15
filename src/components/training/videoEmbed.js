// Parse a raw YouTube / Google Drive share URL into an embeddable form.
// Returns { type, id, embedUrl, thumb } or { type: 'unknown' } when unrecognized.

export function parseVideoUrl(raw) {
  if (!raw) return { type: 'unknown', id: null, embedUrl: null, thumb: null };
  const url = String(raw).trim();

  const yt = matchYouTube(url);
  if (yt) return { type: 'youtube', ...yt };

  const gd = matchDrive(url);
  if (gd) return { type: 'drive', ...gd };

  return { type: 'unknown', id: null, embedUrl: null, thumb: null };
}

function matchYouTube(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{6,})/,
    /youtu\.be\/([\w-]{6,})/,
    /youtube\.com\/embed\/([\w-]{6,})/,
    /youtube\.com\/shorts\/([\w-]{6,})/,
    /youtube\.com\/v\/([\w-]{6,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const id = m[1];
      return {
        id,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }
  return null;
}

function matchDrive(url) {
  let id = null;
  let m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (m) id = m[1];
  if (!id) {
    m = url.match(/drive\.google\.com\/open\?id=([\w-]+)/);
    if (m) id = m[1];
  }
  if (!id && /drive\.google\.com/.test(url)) {
    m = url.match(/[?&]id=([\w-]+)/);
    if (m) id = m[1];
  }
  if (!id) return null;
  return {
    id,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    thumb: null, // Drive has no public thumbnail without an API call
  };
}