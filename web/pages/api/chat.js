// api/chat.js — Chatbot AI con contesto libreria
// Legge la chiave OpenAI da impostazioni (servizio = 'openai')
// Costruisce un system prompt minimale con solo i dati rilevanti

export const config = { maxDuration: 60 }

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

  // ── 1. Legge chiave OpenAI ──────────────────────────────────────────────────
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

  // ── 2. Query Supabase mirate in parallelo ───────────────────────────────────
  const [{ data: cinqueStelle }, { data: daLeggereRaw }, { data: statsRaw }] = await Promise.all([
    // Solo libri a 5★ — base per capire i gusti
    supabase.from('libri')
      .select('titolo, autore, casa_editrice, genere, anno_lettura')
      .eq('stato_lettura', 'letto')
      .eq('voto', 5),

    // Da leggere — solo titolo e autore, max 25
    supabase.from('libri')
      .select('titolo, autore')
      .eq('stato_lettura', 'da_leggere')
      .limit(25),

    // Stats per riepilogo
    supabase.from('libri')
      .select('stato_lettura, anno_lettura'),
  ])

  // ── 3. Calcola statistiche ──────────────────────────────────────────────────
  const stats = statsRaw || []
  const totale    = stats.length
  const nLetti    = stats.filter(l => l.stato_lettura === 'letto').length
  const nLettura  = stats.filter(l => l.stato_lettura === 'in_lettura').length
  const nDaLegg   = stats.filter(l => l.stato_lettura === 'da_leggere').length

  const lettiPerAnno = {}
  for (const l of stats) {
    if (l.stato_lettura === 'letto' && l.anno_lettura) {
      const a = String(l.anno_lettura)
      lettiPerAnno[a] = (lettiPerAnno[a] || 0) + 1
    }
  }
  const anniStr = Object.keys(lettiPerAnno)
    .sort((a, b) => Number(b) - Number(a))
    .map(a => `${a}:${lettiPerAnno[a]}`)
    .join(', ')

  // ── 4. Formattazione libri ──────────────────────────────────────────────────
  function fmt5(l) {
    const autore  = (l.autore || []).join(', ') || '?'
    const editore = l.casa_editrice || null
    const genere  = (l.genere || []).join(', ') || null
    const annoL   = l.anno_lettura ? ` [${l.anno_lettura}]` : ''
    return `"${l.titolo || '?'}" — ${[autore, editore, genere].filter(Boolean).join(', ')}${annoL}`
  }

  function fmtDL(l) {
    return `"${l.titolo || '?'}" (${(l.autore || []).join(', ') || '?'})`
  }

  // ── 5. System prompt compatto ───────────────────────────────────────────────
  const systemPrompt = `Sei l'assistente letterario personale di Cristina (raccontiinvaligia.it).
Rispondi in italiano, tono caldo e appassionato.

══ FLUSSO SUGGERIMENTI ══
Quando l'utente chiede consigli su cosa leggere, fai UNA sola domanda alla volta.
Per ogni domanda presenta opzioni numerate — l'ultima è sempre "Altro: scrivi tu..."

D1 — Come ti senti in questo momento?
1. Rilassata, voglio qualcosa di piacevole
2. Avventurosa o curiosa, cerco ispirazione
3. Riflessiva o nostalgica
4. Altro: scrivi tu...

D2 — Lettura leggera o impegnativa?
1. Leggera e scorrevole
2. Impegnativa e profonda
3. Via di mezzo
4. Altro: scrivi tu...

D3 — Che tipo di libro?
1. Narrativa
2. Narrativa di viaggio / reportage
3. Saggistica
4. Autobiografia / memoir
5. Altro: scrivi tu...

D3b — [Solo se ha scelto "Narrativa di viaggio / reportage"]
Hai una destinazione geografica in mente? Scrivila — oppure rispondi: "Non importa, scegli tu"

D4 — Tema o epoca?
1. Contemporaneo
2. Storico (qualsiasi epoca)
3. Nessuna preferenza
4. Altro: scrivi tu...

D5 — [Opzionale, sempre ultima] Preferenze sulla lunghezza?
1. Preferisco qualcosa di breve (sotto 250 pagine)
2. Salta, non è rilevante per me

Dopo le risposte suggerisci 3-4 titoli:
- Basa i gusti SUI LIBRI A 5★ elencati sotto (stile, temi, autori, editori)
- Puoi includere titoli dalla lista "Da leggere" (scrivi "è già nella tua lista!")
- Non suggerire mai libri già letti o in lettura
- Per ogni titolo: nome, autore, motivazione legata al mood e ai 5★
══════════════════════════

LIBRERIA — ${totale} libri | letti: ${nLetti} | in lettura: ${nLettura} | da leggere: ${nDaLegg}
Letti per anno: ${anniStr || 'n.d.'}

5★ LIBRI DI CRISTINA — base per i suggerimenti:
${(cinqueStelle || []).map(fmt5).join('\n') || '(nessuno)'}

DA LEGGERE — ${nDaLegg} titoli (primi 25):
${(daLeggereRaw || []).map(fmtDL).join('\n') || '(lista vuota)'}`

  // ── 6. Chiama OpenAI ────────────────────────────────────────────────────────
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${imp.api_key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10),
        ],
        max_tokens: 600,
        temperature: 0.7,
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
