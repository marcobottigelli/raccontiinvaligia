// api/isbn-lookup.js — Vercel Function
// Proxy per ISBN lookup — aggira CORS e prova più fonti in sequenza:
// 1. Google Books API (nessuna chiave, ~1000 req/day gratuiti)
// 2. Open Library Books API (completamente gratuito, nessuna chiave)
// Body: { isbn }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { isbn } = req.body
  if (!isbn) return res.status(400).json({ error: 'isbn mancante' })

  // Normalizza ISBN (rimuovi trattini e spazi)
  const cleanIsbn = isbn.replace(/[-\s]/g, '')

  // Helper: Open Library Books API — restituisce publisher affidabile
  async function fetchOLPublisher() {
    try {
      const r = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
        { headers: { 'User-Agent': 'RaccontiInValigia/1.0' }, signal: AbortSignal.timeout(4000) }
      )
      if (!r.ok) return null
      const data = await r.json()
      const book = data[`ISBN:${cleanIsbn}`]
      return book?.publishers?.[0]?.name || null
    } catch (_) {
      return null
    }
  }

  // 1. Google Books API
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`

    const r = await fetch(url, { headers: { 'User-Agent': 'RaccontiInValigia/1.0' } })
    if (r.ok) {
      const data = await r.json()
      if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
        const v = data.items[0].volumeInfo

        // Copertina: prendi la più grande disponibile
        let copertina = null
        if (v.imageLinks) {
          copertina = v.imageLinks.large
            || v.imageLinks.medium
            || v.imageLinks.thumbnail
            || null
          // zoom=0 su Google Books restituisce placeholder per libri senza preview digitale
          // (comune per edizioni italiane). zoom=1 è la thumbnail reale che funziona per tutti.
          if (copertina) {
            copertina = copertina
              .replace('&edge=curl', '')
              .replace(/^http:\/\//, 'https://')
          }
        }

        // Anno pubblicazione: prendi solo i 4 digit dell'anno
        const anno = v.publishedDate
          ? parseInt(v.publishedDate.substring(0, 4)) || null
          : null

        // Publisher: Google Books spesso non ce l'ha per edizioni italiane.
        // Se manca, prova Open Library Books API che ha dati editoriali più completi.
        const casaEditrice = v.publisher || await fetchOLPublisher()

        return res.json({
          source:             'google-books',
          titolo:             v.title || null,
          autore:             v.authors || [],
          casa_editrice:      casaEditrice,
          anno_pubblicazione: anno,
          descrizione:        v.description || null,
          copertina,
          genere:             [],  // categorie BISAC di Google Books spesso sbagliate per libri italiani
          lingua_originale:   v.language || null,
          pagine:             v.pageCount || null,
        })
      }
    }
  } catch (e) {
    console.error('[Google Books] errore:', e.message)
  }

  // 2. Open Library Books API (endpoint strutturato, publisher affidabile)
  try {
    const r = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
      { headers: { 'User-Agent': 'RaccontiInValigia/1.0' } }
    )
    if (r.ok) {
      const data = await r.json()
      const book = data[`ISBN:${cleanIsbn}`]
      if (book?.title) {
        const autori = (book.authors || []).map(a => a.name).filter(Boolean)
        const casaEditrice = book.publishers?.[0]?.name || null
        const anno = book.publish_date
          ? parseInt(book.publish_date.match(/\d{4}/)?.[0]) || null
          : null

        // Copertina Open Library — verifica che esista davvero (?default=false → 404 se assente)
        let copertina = null
        try {
          const coverRes = await fetch(
            `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
            { method: 'HEAD', signal: AbortSignal.timeout(3000) }
          )
          if (coverRes.ok) {
            copertina = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`
          }
        } catch (_) {}

        return res.json({
          source:             'open-library',
          titolo:             book.title || null,
          autore:             autori,
          casa_editrice:      casaEditrice,
          anno_pubblicazione: anno,
          descrizione:        book.notes || null,
          copertina,
          genere:             [],
          lingua_originale:   null,
          pagine:             book.number_of_pages || null,
        })
      }
    }
  } catch (e) {
    console.error('[Open Library Books API] errore:', e.message)
  }

  // 3. Open Library edition endpoint (ultimo fallback)
  try {
    const r = await fetch(
      `https://openlibrary.org/isbn/${cleanIsbn}.json`,
      { headers: { 'User-Agent': 'RaccontiInValigia/1.0' } }
    )
    if (r.ok) {
      const data = await r.json()
      if (data.title) {
        // Risolve gli autori (array di { key: '/authors/OL123A' })
        let autori = []
        if (data.authors && Array.isArray(data.authors)) {
          const authorPromises = data.authors.slice(0, 3).map(async (a) => {
            try {
              const key = a.key || ''
              const authorRes = await fetch(
                `https://openlibrary.org${key}.json`,
                { signal: AbortSignal.timeout(3000) }
              )
              if (authorRes.ok) {
                const authorData = await authorRes.json()
                return authorData.name || authorData.personal_name || null
              }
            } catch { }
            return null
          })
          const resolved = await Promise.all(authorPromises)
          autori = resolved.filter(Boolean)
        }

        // Copertina Open Library — verifica che esista davvero (?default=false → 404 se assente)
        let copertina = null
        try {
          const coverRes = await fetch(
            `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
            { method: 'HEAD', signal: AbortSignal.timeout(3000) }
          )
          if (coverRes.ok) {
            copertina = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`
          }
        } catch (_) {}

        // Anno pubblicazione
        let anno = null
        if (data.publish_date) {
          const match = data.publish_date.match(/\d{4}/)
          if (match) anno = parseInt(match[0])
        }

        // Lingua
        let lingua = null
        if (data.languages && data.languages[0]?.key) {
          lingua = data.languages[0].key.split('/').pop() // es. 'ita'
        }

        // Descrizione
        let descrizione = null
        if (data.description) {
          descrizione = typeof data.description === 'string'
            ? data.description
            : data.description.value || null
        }

        return res.json({
          source:             'open-library',
          titolo:             data.title || null,
          autore:             autori,
          casa_editrice:      data.publishers?.[0] || null,
          anno_pubblicazione: anno,
          descrizione,
          copertina,
          genere:             [],
          lingua_originale:   lingua,
          pagine:             data.number_of_pages || null,
        })
      }
    }
  } catch (e) {
    console.error('[Open Library edition] errore:', e.message)
  }

  return res.status(404).json({ error: 'not_found' })
}
