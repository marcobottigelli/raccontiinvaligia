import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET /api/libri?filter=in_lettura&search=eco
    // GET /api/libri?id=uuid  → singolo libro
    const { id, filter, search, limit = 500, isbn_exact } = req.query

    // GET /api/libri?isbn_exact=978... → controlla se ISBN esiste già
    if (isbn_exact) {
      const { data } = await supabase
        .from('libri')
        .select('id,titolo,isbn')
        .eq('isbn', isbn_exact.replace(/[-\s]/g, ''))
        .maybeSingle()
      return res.status(200).json(data || null)
    }

    if (id) {
      const { data, error } = await supabase
        .from('libri')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return res.status(404).json({ error: error.message })
      return res.status(200).json(data)
    }

    let query = supabase
      .from('libri')
      .select('id,isbn,titolo,autore,casa_editrice,anno_pubblicazione,copertina,genere,lingua_originale,pagine,stato_lettura,voto,data_source,wordpress_status,note_personali,created_at')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    // Filtri per tab
    if (filter === 'da_leggere')    query = query.eq('stato_lettura', 'da_leggere')
    if (filter === 'in_lettura')    query = query.eq('stato_lettura', 'in_lettura')
    if (filter === 'letto')         query = query.eq('stato_lettura', 'letto')
    if (filter === 'dati_mancanti') query = query.eq('data_source', 'pending')
    if (filter === 'senza_copertina') query = query.is('copertina', null)

    // Ricerca testuale su titolo e ISBN (autore è array, ricerca lato client)
    if (search) {
      query = query.or(`isbn.ilike.%${search}%,titolo.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    let result = data || []

    // Ricerca autore lato client (array field)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(libro =>
        (libro.isbn && libro.isbn.includes(q)) ||
        (libro.titolo && libro.titolo.toLowerCase().includes(q)) ||
        (libro.autore && libro.autore.some(a => a.toLowerCase().includes(q)))
      )
    }

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    // POST /api/libri — crea nuovo libro
    const { isbn, ...fields } = req.body
    if (!isbn) return res.status(400).json({ error: 'isbn obbligatorio' })

    const { data, error } = await supabase
      .from('libri')
      .insert({ isbn, ...fields })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PATCH') {
    // PATCH /api/libri — aggiorna libro esistente
    const { id, ...updates } = req.body
    if (!id) return res.status(400).json({ error: 'id obbligatorio' })

    const { data, error } = await supabase
      .from('libri')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    // DELETE /api/libri?id=uuid
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obbligatorio' })

    const { error } = await supabase
      .from('libri')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Metodo non consentito' })
}
