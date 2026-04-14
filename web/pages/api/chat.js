// api/chat.js — Chatbot AI con contesto libreria
// Legge la chiave OpenAI da impostazioni (servizio = 'openai')
// Costruisce un system prompt con i dati reali della libreria

export const config = { maxDuration: 60 } // Vercel timeout esteso a 60s

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

  const tutti       = libri || []
  const letti       = tutti.filter(l => l.stato_lettura === 'letto')
  const inLettura   = tutti.filter(l => l.stato_lettura === 'in_lettura')
  const daLeggere   = tutti.filter(l => l.stato_lettura === 'da_leggere')
  const cinqueStelle = letti.filter(l => l.voto === 5)
  const quattroStelle = letti.filter(l => l.voto === 4)

  // Riepilogo per anno
  const lettiPerAnno = {}
  for (const l of letti) {
    const anno = l.anno_lettura ? String(l.anno_lettura) : 'n.d.'
    lettiPerAnno[anno] = (lettiPerAnno[anno] || 0) + 1
  }
  const anniOrdinati = Object.keys(lettiPerAnno)
    .filter(a => a !== 'n.d.')
    .sort((a, b) => Number(b) - Number(a))

  function fmtLibro(l, compact = false) {
    const autore = (l.autore || []).join(', ') || 'autore ignoto'
    if (compact) return `"${l.titolo || 'Senza titolo'}" (${autore})`
    const editore = l.casa_editrice || null
    const genere  = (l.genere || []).join(', ') || null
    const lingua  = l.lingua_originale && l.lingua_originale !== 'italiano' ? l.lingua_originale : null
    const annoL   = l.anno_lettura ? ` [letto nel ${l.anno_lettura}]` : ''
    return `"${l.titolo || 'Senza titolo'}" — ${[autore, editore, genere, l.anno_pubblicazione, lingua].filter(Boolean).join(', ')}${annoL}`
  }

  // ── 3. Costruisce il system prompt (compatto) ────────────────────────────────
  const systemPrompt = `Sei un assistente letterario personale di Cristina, curatrice di raccontiinvaligia.it.
Rispondi sempre in italiano, tono caldo e appassionato.

══ FLUSSO SUGGERIMENTI ══
Quando l'utente chiede consigli su cosa leggere, fai UNA sola domanda alla volta.
Per ogni domanda dai opzioni numerate — l'ultima è sempre "Altro: scrivi tu..."

D1 — Come ti senti?
1. Rilassata, voglio qualcosa di piacevole
2. Avventurosa, cerco una storia che mi trascini
3. Riflessiva, voglio qualcosa che faccia pensare
4. Curiosa, mi va di imparare qualcosa
5. Nostalgica o malinconica
6. Altro: scrivi tu...

D2 — Lettura leggera o impegnativa?
1. Leggera e scorrevole
2. Impegnativa e profonda
3. Via di mezzo
4. Altro: scrivi tu...

D3 — Che tipo di libro?
1. Narrativa
2. Saggistica
3. Narrativa di viaggio / reportage
4. Memoir / autobiografia
5. Altro: scrivi tu...

D3b — [Solo se ha scelto "Narrativa di viaggio / reportage"]
Hai una destinazione geografica in mente? Scrivila — oppure: "Non importa, scegli tu"

D4 — Tema o epoca?
1. Contemporaneo
2. Novecento / storia recente
3. Storia antica o medievale
4. Nessuna preferenza
5. Altro: scrivi tu...

D5 — [Opzionale] Lunghezza?
1. Breve (sotto 250 pagine)
2. Non importa
3. Salta

Dopo le risposte suggerisci 3-4 titoli:
- Usa i libri a 5★ come riferimento principale per capire i gusti
- Puoi includere libri dalla lista "Da leggere" (scrivi "è già nella tua lista!")
- Non suggerire mai libri già letti o in lettura
- Per ogni titolo: nome, autore, motivazione legata al mood e ai 5★
══════════════════════════

LIBRERIA DI CRISTINA — ${tutti.length} libri (letti per anno: ${anniOrdinati.map(a => `${a}:${lettiPerAnno[a]}`).join(', ') || 'n.d.'})

⭐⭐⭐⭐⭐ 5 STELLE — gusti principali di Cristina:
${cinqueStelle.map(l => `• ${fmtLibro(l)}`).join('\n') || '(nessuno)'}

⭐⭐⭐⭐ 4 STELLE (primi 25):
${quattroStelle.slice(0, 25).map(l => `• ${fmtLibro(l, true)}`).join('\n') || '(nessuno)'}

🔖 IN LETTURA: ${inLettura.map(l => fmtLibro(l, true)).join('; ') || 'nessuno'}

⏳ DA LEGGERE — ${daLeggere.length} titoli (primi 35):
${daLeggere.slice(0, 35).map(l => `• ${fmtLibro(l, true)}`).join('\n') || '(lista vuota)'}`

  // ── 4. Chiama OpenAI ────────────────────────────────────────────────────────
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
          ...messages.slice(-20), // ultimi 20 messaggi per contenere i token
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
