import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

// ── Helper: log server-side, messaggio generico al client ─────────────────────
function dbError(res, error, status = 500) {
  console.error('[libri]', error?.message || error)
  return res.status(status).json({ error: 'Operazione non riuscita' })
}

// ── Validazione ISBN: solo cifre, 10 o 13 caratteri ──────────────────────────
function isValidIsbn(str) {
  return /^\d{10,13}$/.test(str)
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { id, filter, search, limit: limitRaw, isbn_exact } = req.query

    // GET ?isbn_exact=... → controlla se ISBN esiste già
    if (isbn_exact) {
      const clean = isbn_exact.replace(/[-\s]/g, '')
      if (!isValidIsbn(clean)) return res.status(400).json({ error: 'ISBN non valido' })
      const { data } = await supabase
        .from('libri')
        .select('id,titolo,isbn')
        .eq('isbn', clean)
        .maybeSingle()
      return res.status(200).json(data || null)
    }

    if (id) {
      const { data, error } = await supabase
        .from('libri')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return res.status(404).json({ error: 'Libro non trovato' })
      return res.status(200).json(data)
    }

    // Limit: tra 1 e 1000, default 500
    const limit = Math.min(Math.max(1, parseInt(limitRaw, 10) || 500), 1000)

    let query = supabase
      .from('libri')
      .select('id,isbn,titolo,autore,casa_editrice,anno_pubblicazione,copertina,genere,lingua_originale,pagine,stato_lettura,voto,anno_lettura,data_source,wordpress_status,note_personali,created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filter === 'da_leggere')      query = query.eq('stato_lettura', 'da_leggere')
    if (filter === 'in_lettura')      query = query.eq('stato_lettura', 'in_lettura')
    if (filter === 'letto')           query = query.eq('stato_lettura', 'letto')
    if (filter === 'dati_mancanti')   query = query.eq('data_source', 'pending')
    if (filter === 'senza_copertina') query = query.is('copertina', null)
    if (filter === 'anno_corrente')   query = query.eq('anno_lettura', new Date().getFullYear())

    if (search) {
      // Sanitizza: rimuove caratteri pericolosi per la query string Supabase
      const safeSearch = search.replace(/[%_\\]/g, '\\$&').slice(0, 200)
      query = query.or(`isbn.ilike.%${safeSearch}%,titolo.ilike.%${safeSearch}%`)
    }

    const { data, error } = await query
    if (error) return dbError(res, error)

    let result = data || []
    if (search) {
      const q = search.toLowerCase().slice(0, 200)
      result = result.filter(l =>
        (l.isbn && l.isbn.includes(q)) ||
        (l.titolo && l.titolo.toLowerCase().includes(q)) ||
        (l.autore && l.autore.some(a => a.toLowerCase().includes(q)))
      )
    }

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const { isbn, ...fields } = req.body
    if (!isbn) return res.status(400).json({ error: 'isbn obbligatorio' })
    if (fields.casa_editrice) fields.casa_editrice = fields.casa_editrice.trim()
    const { data, error } = await supabase
      .from('libri')
      .insert({ isbn, ...fields })
      .select()
      .single()
    if (error) return dbError(res, error)
    return res.status(201).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id obbligatorio' })
    if (updates.casa_editrice) updates.casa_editrice = updates.casa_editrice.trim()
    const { data, error } = await supabase
      .from('libri')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return dbError(res, error)
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obbligatorio' })
    const { error } = await supabase.from('libri').delete().eq('id', id)
    if (error) return dbError(res, error)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Metodo non consentito' })
}
