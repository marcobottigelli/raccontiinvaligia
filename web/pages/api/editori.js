import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Restituisce tutti gli editori unici con conteggio libri, ordinati per count desc
    const { data, error } = await supabase
      .from('libri')
      .select('casa_editrice')
      .not('casa_editrice', 'is', null)
      .neq('casa_editrice', '')

    if (error) return res.status(500).json({ error: error.message })

    // Aggrega lato server
    const counts = {}
    for (const { casa_editrice } of data) {
      counts[casa_editrice] = (counts[casa_editrice] || 0) + 1
    }

    const result = Object.entries(counts)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'it'))

    return res.status(200).json(result)
  }

  if (req.method === 'PATCH') {
    // Rinomina tutti i libri con vecchio_nome → nuovo_nome
    const { vecchio_nome, nuovo_nome } = req.body
    if (!vecchio_nome || !nuovo_nome) {
      return res.status(400).json({ error: 'vecchio_nome e nuovo_nome obbligatori' })
    }

    const { error } = await supabase
      .from('libri')
      .update({ casa_editrice: nuovo_nome.trim() })
      .eq('casa_editrice', vecchio_nome)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Metodo non consentito' })
}
