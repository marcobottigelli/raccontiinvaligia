// api/chat.js — Chatbot AI con contesto libreria
// Legge la chiave OpenAI da impostazioni (servizio = 'openai')
// Costruisce un system prompt con i dati reali della libreria

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { messages } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages mancanti' })

  // ── 1. Legge chiave OpenAI da impostazioni ──────────────────────────────────
  const { data: imp } = await supabase
    .from('impostazioni')
    .select('api_key')
    .eq('servizio', 'openai')
    .maybeSingle()

  if (!imp?.api_key) {
    return res.status(400).json({
      error: 'Chiave OpenAI non configurata. Aggiungila in Impostazioni (servizio: "openai").'
    })
  }

  // ── 2. Carica la libreria da Supabase ───────────────────────────────────────
  const { data: libri } = await supabase
    .from('libri')
    .select('titolo, autore, genere, anno_pubblicazione, stato_lettura, voto, casa_editrice, lingua_originale, anno_lettura')
    .order('voto', { ascending: false, nullsFirst: false })

  const tutti     = libri || []
  const letti     = tutti.filter(l => l.stato_lettura === 'letto')
  const inLettura = tutti.filter(l => l.stato_lettura === 'in_lettura')
  const daLeggere = tutti.filter(l => l.stato_lettura === 'da_leggere')
  const conVoto   = letti.filter(l => l.voto).sort((a, b) => b.voto - a.voto)
  const senzaVoto = letti.filter(l => !l.voto)

  // Raggruppa i letti per anno di lettura
  const lettiPerAnno = {}
  for (const l of letti) {
    const anno = l.anno_lettura ?? 'anno non specificato'
    if (!lettiPerAnno[anno]) lettiPerAnno[anno] = []
    lettiPerAnno[anno].push(l)
  }
  const anniOrdinati = Object.keys(lettiPerAnno).sort((a, b) => b - a)

  function fmtLibro(l) {
    const autore = (l.autore || []).join(', ') || 'autore ignoto'
    const genere = (l.genere || []).join(', ') || null
    const parts  = [autore, genere, l.anno_pubblicazione].filter(Boolean).join(', ')
    const annoLettura = l.anno_lettura ? ` [letto nel ${l.anno_lettura}]` : ''
    return `"${l.titolo || 'Senza titolo'}" — ${parts}${annoLettura}`
  }

  // ── 3. Costruisce il system prompt ──────────────────────────────────────────
  const systemPrompt = `Sei un assistente letterario personale di Cristina, la curatrice del blog raccontiinvaligia.it.
Conosci la sua libreria completa e i suoi gusti di lettura. Rispondi sempre in italiano, con tono caldo e appassionato.
Quando suggerisci libri, dai sempre titolo, autore e una motivazione personalizzata basata sui suoi gusti reali.
Non suggerire MAI libri già presenti nella sua libreria (elencati sotto).

═══ LIBRERIA DI CRISTINA (${tutti.length} libri totali) ═══

📅 LIBRI LETTI PER ANNO:
${anniOrdinati.map(anno => `  ${anno}: ${lettiPerAnno[anno].length} libri`).join('\n') || '  (nessuno)'}

📚 LETTI CON VOTO (dal più amato al meno amato):
${conVoto.length > 0
  ? conVoto.map(l => `  ${'★'.repeat(l.voto)}${'☆'.repeat(5 - l.voto)}  ${fmtLibro(l)}`).join('\n')
  : '  (nessun libro ancora valutato)'}

📖 LETTI SENZA VOTO:
${senzaVoto.length > 0
  ? senzaVoto.map(l => `  • ${fmtLibro(l)}`).join('\n')
  : '  (nessuno)'}

🔖 IN LETTURA ORA:
${inLettura.length > 0
  ? inLettura.map(l => `  • ${fmtLibro(l)}`).join('\n')
  : '  (nessuno)'}

⏳ LISTA DA LEGGERE:
${daLeggere.length > 0
  ? daLeggere.map(l => `  • ${fmtLibro(l)}`).join('\n')
  : '  (lista vuota)'}

═══════════════════════════════════════════════`

  // ── 4. Chiama OpenAI ────────────────────────────────────────────────────────
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${imp.api_key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1200,
        temperature: 0.75,
      }),
    })

    const data = await openaiRes.json()
    if (!openaiRes.ok) {
      const msg = data.error?.message || 'Errore sconosciuto OpenAI'
      return res.status(500).json({ error: msg })
    }

    return res.json({ content: data.choices[0].message.content })
  } catch (e) {
    return res.status(500).json({ error: 'Errore di rete verso OpenAI: ' + e.message })
  }
}
