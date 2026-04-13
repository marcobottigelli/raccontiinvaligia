// api/isbn-lookup.js — Vercel Function
// ISBN lookup con fetch parallelo Google Books + Open Library per massima velocità e copertura.
// Body: { isbn }

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

    // Publisher: GB spesso manca per edizioni italiane → supplementa da OL Books API
    // olBook.publishers è [{name: "Mondadori"}, ...] secondo la spec OL /api/books jscmd=data
    const casaEditrice = v.publisher
      || olBook?.publishers?.[0]?.name
      || null

    // Genere: usa il primo risultato di Google Books, togliendo il sottogenere dopo "/"
    // es. "Fiction / Literary" → "Fiction", "Juvenile Fiction / Adventure" → "Juvenile Fiction"
    const genere = v.categories?.length
      ? [v.categories[0].split('/')[0].trim()]
      : []

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
    const casaEditrice = olBook.publishers?.[0]?.name || null
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
      genere:             [],
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

        return res.json({
          source:             'open-library',
          titolo:             data.title              || null,
          autore:             autori,
          casa_editrice:      data.publishers?.[0]   || null,
          anno_pubblicazione: anno,
          descrizione,
          copertina,
          genere:             [],
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
