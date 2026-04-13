// api/isbn-lookup.js — Vercel Function
// ISBN lookup con fetch parallelo Google Books + Open Library per massima velocità e copertura.
// Genere (in italiano) e publisher mancante vengono recuperati via OpenAI in un'unica chiamata.
// Body: { isbn }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

// Recupera la chiave OpenAI da Supabase (stessa tabella usata dal chatbot)
let cachedApiKey = null
async function getOpenAIKey() {
  if (cachedApiKey) return cachedApiKey
  try {
    const { data } = await supabase
      .from('impostazioni')
      .select('api_key')
      .eq('servizio', 'openai')
      .maybeSingle()
    cachedApiKey = data?.api_key || null
  } catch (_) {}
  return cachedApiKey
}

// Chiede a GPT casa_editrice (se mancante) e genere in italiano — una sola chiamata per entrambi.
// Ritorna { casa_editrice: string|null, genere: string|null }
async function aiLookupMeta(titolo, autori, isbn) {
  const apiKey = await getOpenAIKey()
  if (!apiKey || !titolo) return { casa_editrice: null, genere: null }
  try {
    const autoreStr = Array.isArray(autori) ? autori.join(', ') : (autori || '')
    const prompt =
      `Libro: "${titolo}"${autoreStr ? ` di ${autoreStr}` : ''} (ISBN ${isbn}).\n` +
      `Rispondi SOLO con un oggetto JSON con questi due campi:\n` +
      `- "casa_editrice": nome della casa editrice italiana (es. "Iperborea", "Mondadori", "Einaudi")\n` +
      `- "genere": genere letterario in italiano (es. "Narrativa", "Romanzo", "Thriller", "Giallo", "Fantascienza", "Saggistica", "Poesia", "Fantasy", "Horror", "Biografia")\n` +
      `Usa null per i campi di cui non sei sicuro. Nessun testo fuori dal JSON.`
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return { casa_editrice: null, genere: null }
    const data = await r.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    return {
      casa_editrice: parsed.casa_editrice || null,
      genere:        parsed.genere        || null,
    }
  } catch (_) {
    return { casa_editrice: null, genere: null }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { isbn } = req.body
  if (!isbn) return res.status(400).json({ error: 'isbn mancante' })

  const cleanIsbn = isbn.replace(/[-\s]/g, '')
  const TIMEOUT = 6000

  // ── Fetch Google Books + Open Library in parallelo ──────────────────────────
  const gbUrl = process.env.GOOGLE_BOOKS_API_KEY
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&key=${process.env.GOOGLE_BOOKS_API_KEY}`
    : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`

  const olBooksUrl =
    `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`

  const [gbSettled, olSettled] = await Promise.allSettled([
    fetch(gbUrl,      { headers: { 'User-Agent': 'RaccontiInValigia/1.0' }, signal: AbortSignal.timeout(TIMEOUT) }),
    fetch(olBooksUrl, { headers: { 'User-Agent': 'RaccontiInValigia/1.0' }, signal: AbortSignal.timeout(TIMEOUT) }),
  ])

  // Deserializza le risposte
  let gbData    = null
  let olBook    = null   // oggetto singolo libro da OL Books API

  if (gbSettled.status === 'fulfilled' && gbSettled.value.ok) {
    try { gbData = await gbSettled.value.json() } catch (_) {}
  }

  if (olSettled.status === 'fulfilled' && olSettled.value.ok) {
    try {
      const olRaw = await olSettled.value.json()
      olBook = olRaw[`ISBN:${cleanIsbn}`] || null
    } catch (_) {}
  }

  // ── 1. Fonte primaria: Google Books ──────────────────────────────────────────
  if (gbData?.totalItems > 0 && gbData.items?.[0]?.volumeInfo) {
    const v = gbData.items[0].volumeInfo

    // Copertina: prendi la più grande disponibile
    let copertina = null
    if (v.imageLinks) {
      copertina = v.imageLinks.large
        || v.imageLinks.medium
        || v.imageLinks.thumbnail
        || null
      if (copertina) {
        copertina = copertina
          .replace('&edge=curl', '')
          .replace(/^http:\/\//, 'https://')
      }
    }

    const anno = v.publishedDate
      ? parseInt(v.publishedDate.substring(0, 4)) || null
      : null

    // Publisher da API, poi AI come fallback. Genere sempre da AI (in italiano).
    const apiPublisher = v.publisher || olBook?.publishers?.[0]?.name || null
    const aiMeta = await aiLookupMeta(v.title, v.authors, cleanIsbn)
    const casaEditrice = apiPublisher || aiMeta.casa_editrice
    const genere = aiMeta.genere ? [aiMeta.genere] : []

    return res.json({
      source:             'google-books',
      titolo:             v.title              || null,
      autore:             v.authors            || [],
      casa_editrice:      casaEditrice,
      anno_pubblicazione: anno,
      descrizione:        v.description        || null,
      copertina,
      genere,
      lingua_originale:   v.language           || null,
      pagine:             v.pageCount          || null,
    })
  }

  // ── 2. Fallback: Open Library Books API ──────────────────────────────────────
  if (olBook?.title) {
    const autori = (olBook.authors || []).map(a => a.name).filter(Boolean)
    const apiPublisher = olBook.publishers?.[0]?.name || null
    const aiMeta = await aiLookupMeta(olBook.title, autori, cleanIsbn)
    const casaEditrice = apiPublisher || aiMeta.casa_editrice
    const anno = olBook.publish_date
      ? parseInt(String(olBook.publish_date).match(/\d{4}/)?.[0]) || null
      : null

    // Copertina OL
    let copertina = null
    try {
      const coverRes = await fetch(
        `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
        { method: 'HEAD', signal: AbortSignal.timeout(3000) }
      )
      if (coverRes.ok) copertina = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`
    } catch (_) {}

    return res.json({
      source:             'open-library',
      titolo:             olBook.title        || null,
      autore:             autori,
      casa_editrice:      casaEditrice,
      anno_pubblicazione: anno,
      descrizione:        null,
      copertina,
      genere:             aiMeta.genere ? [aiMeta.genere] : [],
      lingua_originale:   null,
      pagine:             olBook.number_of_pages || null,
    })
  }

  // ── 3. Ultimo fallback: endpoint edizione OL /isbn/{isbn}.json ────────────────
  try {
    const r = await fetch(
      `https://openlibrary.org/isbn/${cleanIsbn}.json`,
      { headers: { 'User-Agent': 'RaccontiInValigia/1.0' }, signal: AbortSignal.timeout(5000) }
    )
    if (r.ok) {
      const data = await r.json()
      if (data.title) {
        // Risolve gli autori (array di { key: '/authors/OL123A' })
        let autori = []
        if (Array.isArray(data.authors)) {
          const resolved = await Promise.all(
            data.authors.slice(0, 3).map(async (a) => {
              try {
                const ar = await fetch(
                  `https://openlibrary.org${a.key}.json`,
                  { signal: AbortSignal.timeout(3000) }
                )
                if (ar.ok) {
                  const ad = await ar.json()
                  return ad.name || ad.personal_name || null
                }
              } catch (_) {}
              return null
            })
          )
          autori = resolved.filter(Boolean)
        }

        let copertina = null
        try {
          const cr = await fetch(
            `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
            { method: 'HEAD', signal: AbortSignal.timeout(3000) }
          )
          if (cr.ok) copertina = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`
        } catch (_) {}

        let anno = null
        if (data.publish_date) {
          const m = String(data.publish_date).match(/\d{4}/)
          if (m) anno = parseInt(m[0])
        }

        let lingua = null
        if (data.languages?.[0]?.key) {
          lingua = data.languages[0].key.split('/').pop()
        }

        let descrizione = null
        if (data.description) {
          descrizione = typeof data.description === 'string'
            ? data.description
            : data.description.value || null
        }

        const apiPublisher3 = data.publishers?.[0] || null
        const aiMeta3 = await aiLookupMeta(data.title, autori, cleanIsbn)
        return res.json({
          source:             'open-library',
          titolo:             data.title              || null,
          autore:             autori,
          casa_editrice:      apiPublisher3 || aiMeta3.casa_editrice,
          anno_pubblicazione: anno,
          descrizione,
          copertina,
          genere:             aiMeta3.genere ? [aiMeta3.genere] : [],
          lingua_originale:   lingua,
          pagine:             data.number_of_pages   || null,
        })
      }
    }
  } catch (e) {
    console.error('[OL edition] errore:', e.message)
  }

  return res.status(404).json({ error: 'not_found' })
}
