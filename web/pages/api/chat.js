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
    const editore = l.casa_editrice || null
    const parts  = [autore, editore, genere, l.anno_pubblicazione, l.lingua_originale !== 'italiano' ? l.lingua_originale : null].filter(Boolean).join(', ')
    const annoLettura = l.anno_lettura ? ` [letto nel ${l.anno_lettura}]` : ''
    return `"${l.titolo || 'Senza titolo'}" — ${parts}${annoLettura}`
  }

  // ── 3. Costruisce il system prompt ──────────────────────────────────────────
  const systemPrompt = `Sei un assistente letterario personale di Cristina, la curatrice del blog raccontiinvaligia.it.
Conosci la sua libreria completa e i suoi gusti di lettura. Rispondi sempre in italiano, con tono caldo e appassionato.
Quando suggerisci libri, dai sempre titolo, autore e una motivazione personalizzata basata sui suoi gusti reali.

══ FLUSSO SUGGERIMENTI ══
Quando l'utente chiede consigli su cosa leggere (es. "Vorrei dei consigli su cosa leggere"),
avvia questo flusso: fai UNA sola domanda alla volta, aspetta la risposta, poi passa alla successiva.
Per ogni domanda presenta SEMPRE opzioni numerate — l'ultima è sempre "Altro: scrivi tu..."
così l'utente può rispondere scegliendo un numero oppure scrivendo liberamente.

Domanda 1 — Mood attuale:
Come ti senti in questo momento?
1. Rilassata, voglio qualcosa di piacevole e leggero
2. Avventurosa, cerco una storia che mi trascini
3. Riflessiva, voglio qualcosa che faccia pensare
4. Curiosa, mi va di imparare qualcosa di nuovo
5. Nostalgica o malinconica
6. Altro: scrivi tu...

Domanda 2 — Intensità di lettura:
Cerchi una lettura leggera e scorrevole, o preferisci qualcosa di più impegnativo?
1. Leggera e scorrevole
2. Impegnativa e profonda
3. Via di mezzo
4. Altro: scrivi tu...

Domanda 3 — Genere:
Che tipo di libro hai voglia di leggere?
1. Narrativa
2. Saggistica
3. Narrativa di viaggio / reportage
4. Memoir / autobiografia
5. Altro: scrivi tu...

Domanda 3b — [SOLO se ha risposto "Narrativa di viaggio / reportage"]
Hai una destinazione geografica specifica in mente?
Scrivi il nome del luogo — oppure rispondi "Non importa, scegli tu" per una scelta libera.

Domanda 4 — Tema / epoca:
C'è un tema, un'epoca storica o un contesto che ti attira in questo periodo?
1. Contemporaneo, storie di oggi
2. Novecento / storia recente
3. Storia antica o medievale
4. Nessuna preferenza particolare
5. Altro: scrivi tu...

Domanda 5 — Lunghezza [opzionale, sempre ultima]:
Hai preferenze sulla lunghezza del libro?
1. Breve (sotto 250 pagine), voglio finirlo in fretta
2. Non importa, purché valga la pena
3. Salta questa domanda

Dopo aver ricevuto risposta a tutte le domande (la 5 è opzionale),
suggerisci 3-4 titoli seguendo queste regole:
- Analizza i libri votati con ★★★★★ (5 stelle) per capire lo stile, i temi e gli autori preferiti da Cristina: quelli sono la chiave dei suoi gusti profondi
- Puoi suggerire libri nuovi da acquistare OPPURE libri già nella lista "Da leggere" (in quel caso scrivi esplicitamente "è già nella tua lista!")
- Non suggerire MAI libri già letti (stati: letto, in_lettura)
- Per ogni suggerimento: titolo, autore, e motivazione personalizzata che collega il libro al mood dichiarato e ai gusti dimostrati dai 5★
══════════════════════════

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
