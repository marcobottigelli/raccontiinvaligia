import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

// ── Helper: log server-side, restituisce messaggio generico al client ──────────
function dbError(res, error, status = 500) {
  console.error('[impostazioni]', error?.message || error)
  return res.status(status).json({ error: 'Operazione non riuscita' })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // NON restituire mai api_key al client — è write-only
    const { data, error } = await supabase
      .from('impostazioni')
      .select('id, servizio, note, aggiornato_il')
      .order('servizio')
    if (error) return dbError(res, error)
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { servizio, api_key, note } = req.body
    if (!servizio?.trim()) return res.status(400).json({ error: 'servizio obbligatorio' })
    if (!api_key?.trim()) return res.status(400).json({ error: 'api_key obbligatoria' })
    const { data, error } = await supabase
      .from('impostazioni')
      .insert([{ servizio: servizio.trim(), api_key: api_key.trim(), note: note?.trim() || null }])
      .select('id, servizio, note, aggiornato_il')
      .single()
    if (error) return dbError(res, error)
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { id, servizio, api_key, note } = req.body
    if (!id) return res.status(400).json({ error: 'id obbligatorio' })
    const updates = {
      servizio: servizio?.trim(),
      note: note?.trim() || null,
      aggiornato_il: new Date().toISOString(),
    }
    // Aggiorna api_key SOLO se fornita non vuota — evita di sovrascrivere con stringa vuota
    if (api_key?.trim()) updates.api_key = api_key.trim()
    const { data, error } = await supabase
      .from('impostazioni')
      .update(updates)
      .eq('id', id)
      .select('id, servizio, note, aggiornato_il')
      .single()
    if (error) return dbError(res, error)
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obbligatorio' })
    const { error } = await supabase.from('impostazioni').delete().eq('id', id)
    if (error) return dbError(res, error)
    return res.status(204).end()
  }

  res.status(405).json({ error: 'Method not allowed' })
}
