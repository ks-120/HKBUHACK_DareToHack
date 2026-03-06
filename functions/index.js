const functions = require('firebase-functions')
const fetch = require('node-fetch')

const HKBU_BASE_URL = 'https://genai.hkbu.edu.hk/api/v0/rest'
const HKBU_API_VER  = '2024-12-01-preview'

exports.hkbuChat = functions.https.onRequest((req, res) => {
  // CORS headers – allow your Firebase Hosting domain + localhost
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { messages, model = 'gpt-4.1', temperature = 0.7, max_tokens = 1024 } = req.body
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Missing messages array' })
    return
  }

  const apiKey = functions.config().hkbu?.api_key || process.env.HKBU_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'HKBU API key not configured on server' })
    return
  }

  const url = `${HKBU_BASE_URL}/deployments/${model}/chat/completions?api-version=${HKBU_API_VER}`

  fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({ messages, temperature, max_tokens, top_p: 1, stream: false }),
  })
    .then(upstream => upstream.json().then(data => ({ status: upstream.status, data })))
    .then(({ status, data }) => res.status(status).json(data))
    .catch(err => res.status(500).json({ error: err.message }))
})
