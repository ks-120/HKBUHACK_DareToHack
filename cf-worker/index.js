const HKBU_BASE_URL = 'https://genai.hkbu.edu.hk/api/v0/rest'
const HKBU_API_VER  = '2024-12-01-preview'
const SA_DOMAIN     = 'https://sa.hkbu.edu.hk'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // ── CORS preflight ────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // ── Image proxy  GET /img?url=<encoded-sa.hkbu.edu.hk-path> ──────────
    if (request.method === 'GET' && url.pathname === '/img') {
      const imgUrl = url.searchParams.get('url')
      if (!imgUrl) {
        return new Response('Missing url param', { status: 400, headers: CORS_HEADERS })
      }
      // Only allow proxying from sa.hkbu.edu.hk for safety
      if (!imgUrl.startsWith(SA_DOMAIN) && !imgUrl.startsWith('/')) {
        return new Response('Forbidden origin', { status: 403, headers: CORS_HEADERS })
      }
      const target = imgUrl.startsWith('http') ? imgUrl : `${SA_DOMAIN}${imgUrl}`
      const upstream = await fetch(target, {
        headers: { 'Referer': SA_DOMAIN, 'User-Agent': 'Mozilla/5.0' },
      })
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // ── Chat proxy  POST / ────────────────────────────────────────────────
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { messages, model = 'gpt-4.1', temperature = 0.7, max_tokens = 1024 } = body
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Missing messages array' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = env.HKBU_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'HKBU API key not configured' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const chatUrl = `${HKBU_BASE_URL}/deployments/${model}/chat/completions?api-version=${HKBU_API_VER}`
    const upstream = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({ messages, temperature, max_tokens, top_p: 1, stream: false }),
    })

    const data = await upstream.json()
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  },
}
