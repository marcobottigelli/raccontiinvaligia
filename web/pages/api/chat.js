// api/chat.js — Chatbot AI con contesto libreria
// Legge la chiave OpenAI da impostazioni (servizio = 'openai')
// Costruisce un system prompt con tutti i dati della libreria rilevanti

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

  // ── 2. Query Supabase in parallelo ──────────────────────────────────────────
  const [
    { data: tuttiLettiRaw },
    { data: daLeggereRaw },
    { data: statsRaw },
  ] = await Promise.all([
    // Tutti i libri letti — con anno, voto, genere per profilo gusti e risposte accurate
    supabase.from('libri')
      .select('titolo, autore, casa_editrice, genere, anno_lettura, voto')
      .eq('stato_lettura', 'letto')
      .order('anno_lettura', { ascending: false }),

    // Da leggere — tutti, nessun limite
    supabase.from('libri')
      .select('titolo, autore')
      .eq('stato_lettura', 'da_leggere'),

    // Stats per riepilogo numerico
    supabase.from('libri')
      .select('stato_lettura, anno_lettura'),
  ])

  // Derivati da tuttiLettiRaw
  const tuttiLetti  = tuttiLettiRaw || []
  const cinqueStelle = tuttiLetti.filter(l => l.voto === 5)
  const quattroStelle = tuttiLetti.filter(l => l.voto === 4)

  // ── 3. Calcola statistiche ─────────────────────────────────────────────────
  const stats = statsRaw || []
  const totale   = stats.length
  const nLetti   = stats.filter(l => l.stato_lettura === 'letto').length
  const nLettura = stats.filter(l => l.stato_lettura === 'in_lettura').length
  const nDaLegg  = stats.filter(l => l.stato_lettura === 'da_leggere').length

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

  // ── 4. Formattazione ───────────────────────────────────────────────────────
  function fmt5(l) {
    const autore  = (l.autore || []).join(', ') || '?'
    const editore = l.casa_editrice || null
    const genere  = (l.genere || []).join(', ') || null
    const annoL   = l.anno_lettura ? ` [${l.anno_lettura}]` : ''
    return `"${l.titolo || '?'}" — ${[autore, editore, genere].filter(Boolean).join(', ')}${annoL}`
  }

  function fmt4(l) {
    const autore = (l.autore || []).join(', ') || '?'
    const genere = (l.genere || []).join(', ') || null
    return `"${l.titolo || '?'}" — ${[autore, genere].filter(Boolean).join(', ')}`
  }

  function fmtBase(l) {
    return `"${l.titolo || '?'}" (${(l.autore || []).join(', ') || '?'})`
  }

  // Lista completa letti, raggruppata per anno (più recenti prima) con voto
  const stelle = n => '★'.repeat(n || 0) + '☆'.repeat(Math.max(0, 5 - (n || 0)))
  const lettiPerAnnoMap = {}
  for (const l of tuttiLetti) {
    const anno = l.anno_lettura ? String(l.anno_lettura) : '?'
    if (!lettiPerAnnoMap[anno]) lettiPerAnnoMap[anno] = []
    const autore = (l.autore || []).join(', ') || '?'
    lettiPerAnnoMap[anno].push(`"${l.titolo || '?'}" — ${autore} ${stelle(l.voto)}`)
  }
  const lettiPerAnnoStr = Object.keys(lettiPerAnnoMap)
    .sort((a, b) => Number(b) - Number(a))
    .map(anno => `${anno}:\n${lettiPerAnnoMap[anno].map(r => `  • ${r}`).join('\n')}`)
    .join('\n')

  // ── 5. System prompt ───────────────────────────────────────────────────────
  const systemPrompt = `Sei l'assistente letterario personale di Cristina (raccontiinvaligia.it).
Rispondi sempre in italiano, tono caldo e appassionato.

══ FLUSSO SUGGERIMENTI — segui questo ordine RIGOROSO ══

Quando l'utente chiede consigli su cosa leggere, poni UNA domanda alla volta seguendo questo flusso:

D1 — Preferisci una lettura leggera o impegnativa?
1. Leggera e scorrevole
2. Impegnativa e profonda
3. Non ho preferenze
4. Altro: scrivi tu...

D2 — Che tipo di libro stai cercando?
1. Narrativa
2. Narrativa di viaggio / reportage
3. Saggistica
4. Autobiografia / memoir
5. Altro: scrivi tu...

D2b — [SOLO se l'utente ha scelto "Narrativa di viaggio / reportage" in D2]
Poni questa domanda:
"Hai una destinazione geografica specifica in mente? Scrivila pure qui sotto — altrimenti scegli:"
1. Non importa, scegli tu

D2c — [SOLO se l'utente ha scelto "Autobiografia / memoir" in D2]
Poni questa domanda:
"Di che ambito vorresti leggere? Scegli o scrivi tu:"
1. Musicale / artistico
2. Sportivo
3. Politico / storico
4. Letterario / intellettuale
5. Scientifico / accademico
6. Imprenditoria / business
7. Non ho preferenze
8. Altro: scrivi tu...

D3 — Tema o epoca?
1. Contemporaneo
2. Storico (qualsiasi epoca)
3. Nessuna preferenza
4. Altro: scrivi tu...

D4 — Preferenze sulla lunghezza?
1. Breve (sotto 250 pagine)
2. Non è rilevante per me

Dopo che l'utente ha risposto a TUTTE le domande (D1, D2, eventuale D2b o D2c, D3, D4), proponi i suggerimenti.
NON dare suggerimenti prima di aver completato il flusso.

══ REGOLE PER I SUGGERIMENTI ══

REGOLA ASSOLUTA — DESTINAZIONE:
Se l'utente ha indicato una destinazione geografica in D2b (es. "Messico", "Giappone", "Patagonia"…),
TUTTI i libri suggeriti DEVONO essere ambientati in quella destinazione, parlare di quel paese/luogo,
o avere quella geografia come protagonista. Non suggerire MAI libri che non riguardano quella destinazione.
Un libro su Marrakech NON è un libro sul Messico. Sii preciso.

REGOLA — AUTOBIOGRAFIA:
Se l'utente ha indicato un ambito in D2c (es. "Musicale / artistico"), proponi solo autobiografie
di persone di quell'ambito. Non mescolare ambiti diversi.

PROFILO GUSTI:
Basa le scelte sullo stile, i temi e gli autori dei libri a 5★ e 4★ di Cristina.
Preferisci autori simili, stessa densità narrativa, temi affini.

STRUTTURA RISPOSTA (seguila sempre):
1. Proponi 3-4 libri che Cristina NON ha ancora in libreria
   Per ognuno scrivi:
   **"Titolo"** — Autore
   → Motivazione in 2-3 righe: perché questo libro, legame con le sue preferenze, perché si adatta al mood espresso

2. Se nella lista "DA LEGGERE" ci sono titoli pertinenti (che matchano il mood/destinazione/tema),
   aggiungi una sezione finale così:
   ---
   📚 Hai già in libreria, da non dimenticare:
   • "Titolo" — breve nota sul perché si adatta

REGOLE AGGIUNTIVE:
- Non suggerire MAI libri dalla lista "TUTTI I LIBRI LETTI"
- Puoi suggerire libri dalla lista "DA LEGGERE" SOLO nella sezione finale, mai tra i primi suggerimenti
- Usa la tua conoscenza dei libri: scegli titoli reali, esistenti, di qualità
- Se il vincolo di destinazione è molto specifico e hai pochi titoli certi, meglio 2 ottimi che 4 mediocri
- Ogni motivazione deve menzionare un collegamento concreto con i suoi 5★ o con il mood dichiarato

══ LIBRERIA DI CRISTINA ══

Totale: ${totale} libri | Letti: ${nLetti} | In lettura: ${nLettura} | Da leggere: ${nDaLegg}
Letti per anno: ${anniStr || 'n.d.'}

★★★★★ LIBRI A 5 STELLE (gusti primari — base per i suggerimenti):
${(cinqueStelle || []).map(fmt5).join('\n') || '(nessuno)'}

★★★★ LIBRI A 4 STELLE (gusti secondari):
${(quattroStelle || []).map(fmt4).join('\n') || '(nessuno)'}

TUTTI I LIBRI LETTI — non suggerire MAI questi titoli; usali per rispondere a domande sulla libreria:
${lettiPerAnnoStr || '(nessuno)'}

DA LEGGERE — ${nDaLegg} titoli (menzionali solo nella sezione finale se pertinenti):
${(daLeggereRaw || []).map(fmtBase).join('\n') || '(lista vuota)'}`

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
          ...messages.slice(-14), // più contesto per seguire il flusso domande
        ],
        max_tokens: 1200,
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
