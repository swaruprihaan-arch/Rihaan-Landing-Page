// Bricks A'Hoy — optional CORS relay for LEGO.com, as a Cloudflare Worker.
//
// Only needed when the site is hosted on a domain other than localhost: browsers block cross-site requests
// to LEGO.com from there. This worker forwards two things, nothing else:
//   • POST https://www.lego.com/api/graphql            (set + booklet lookup)
//   • GET  https://www.lego.com/cdn/product-assets/…   (instruction PDFs and cover images)
// It adds CORS headers and passes `Range` through, so big booklets load page by page.
//
// Deploy: dash.cloudflare.com → Workers & Pages → Create → paste this file → Deploy.
// Then in the site: Settings → Data sources → Instructions proxy URL → https://<name>.<you>.workers.dev
// Usage by the site: <worker>/?url=<encoded LEGO URL>

const ALLOWED = [
  /^https:\/\/www\.lego\.com\/api\/graphql$/,
  /^https:\/\/www\.lego\.com\/cdn\/product-assets\/[^?#]+$/,
];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,range',
  'access-control-expose-headers': 'content-length,content-range,accept-ranges,content-type',
  'access-control-max-age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const target = new URL(request.url).searchParams.get('url') || '';
    if (!ALLOWED.some(re => re.test(target))) return new Response('Only LEGO.com instruction URLs are relayed.', { status: 403, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

    const headers = new Headers({ 'user-agent': 'Mozilla/5.0 (Bricks A\'Hoy relay)', accept: '*/*' });
    for (const h of ['content-type', 'range']) { const v = request.headers.get(h); if (v) headers.set(h, v); }
    const upstream = await fetch(target, { method: request.method, headers, body: request.method === 'POST' ? await request.arrayBuffer() : undefined });

    const out = new Headers(upstream.headers);
    ['set-cookie', 'content-security-policy', 'x-frame-options'].forEach(h => out.delete(h));
    for (const [k, v] of Object.entries(CORS)) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
