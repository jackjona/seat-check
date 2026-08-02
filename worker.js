/**
 * Seat Check
 * A live seat-availability checker for Cineplex movies. Pick a film, date, and time to see an actual seat map of what's open.
 */

import SITE_HTML from './site.html';

const DEFAULT_KEY_HEADER = 'ocp-apim-subscription-key';
const DEFAULT_KEY_VALUE = 'dcdac5601d864addbc2675a2e96cb1f8';
const UPSTREAM_HOST = 'https://apis.cineplex.com';

// Explicit path prefixes are proxied
const ALLOWED_PREFIXES = [
  '/prod/cpx/theatrical/api/',
  '/prod/ticketing/api/',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const isApiPath = ALLOWED_PREFIXES.some((p) => url.pathname.startsWith(p));
    if (isApiPath) {
      return handleProxy(request, url, env);
    }

    return new Response(SITE_HTML, {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};

async function handleProxy(request, url, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'GET') {
    return new Response('Only GET is proxied', { status: 405, headers: corsHeaders(request) });
  }

  const keyHeader = (env && env.CINEPLEX_KEY_HEADER) || DEFAULT_KEY_HEADER;
  const keyValue = (env && env.CINEPLEX_KEY_VALUE) || DEFAULT_KEY_VALUE;

  const target = UPSTREAM_HOST + url.pathname + url.search;

  let upstreamRes;
  try {
    upstreamRes = await fetch(target, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        // 'User-Agent': 'Mozilla/5.0 (compatible; SeatCheckProxy/1.0)',
        [keyHeader]: keyValue,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Upstream request to Cineplex failed', detail: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } }
    );
  }

  const body = await upstreamRes.text();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
      ...corsHeaders(request),
    },
  });
}

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
}
