// api/chat.js — Chatbot AI con contesto libreria
// Legge la chiave OpenAI da impostazioni (servizio = 'openai')
// Costruisce un system prompt con tutti i dati della libreria rilevanti

export const config = { maxDuration: 60 }

// ─────────────────────────────────────────────────────────────────────────────
// REGOLA DI AUTO-VERIFICA — richiamata nel system prompt per ogni titolo proposto
// Modifica qui per cambiare i criteri di selezione dei suggerimenti.
// ─────────────────────────────────────────────────────────────────────────────
const REGOLA_AUTO_VERIFICA = `
══ REGOLA DI AUTO-VERIFICA — OBBLIGATORIA PER OGNI TITOLO ══

Un titolo viene proposto SOLO SE soddisfa CONTEMPORANEAMENTE entrambe le condizioni:

CONDIZIONE A — CRITERI SELEZIONATI (tutti devono essere soddisfatti):
  □ Il libro appartiene al genere indicato (narrativa, viaggio, saggistica, autobiografia…)?
  □ Se è stata indicata una destinazione geografica: il libro riguarda QUELLA destinazione specifica?
     (Es: "Messico" → il libro è ambientato in Messico o tratta del Messico — non di altri paesi)
  □ Se è stato indicato un ambito biografico: il protagonista è di quell'ambito?
  □ Il libro rispetta le preferenze di lettura (leggera/impegnativa) e di epoca indicate?

CONDIZIONE B — GUSTI PERSONALI (deve essere soddisfatta):
  □ Il libro risuona con lo stile, i temi o la sensibilità dei libri a 5★ di Cristina?
     Confronta esplicitamente: autore simile, densità narrativa analoga, temi affini, stesso tipo di emozione.

→ Se ENTRAMBE le condizioni A e B sono soddisfatte: aggiungi il titolo.
→ Se anche solo UNA condizione non è soddisfatta: scarta il titolo e trovane un altro.
→ Obiettivo: 8-10 titoli. Se applicando questi criteri riesci a trovarne solo 5 di alta qualità, proponi 5.
   MAI scendere sotto 5. MAI allentare i criteri per arrivare a 10: qualità > quantità.
   NON proporre titoli di cui non sei certo al 100% — meglio fermarsi a 5 titoli certi che inventarne.

Applica questa verifica a CIASCUN titolo individualmente, in sequenza, prima di includerlo nell'elenco.
`

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

// Sanitizza una stringa per l'inserimento nel system prompt (anti prompt-injection)
function sanitize(str) {
  if (!str) return ''
  return String(str).replace(/[\r\n]+/g, ' ').replace(/[^\x20-\x7E\u00C0-\u024F]/g, c => c).slice(0, 300)
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://raccontiinvaligia.vercel.app'

export default async function handler(req, res) {
  const origin = req.headers.origin
  if (!origin || origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { messages } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages mancanti' })

  // Nome utente — sanitizzato (mai più di 50 char, nessun tag HTML)
  const rawName = req.body.userName
  const userName = (typeof rawName === 'string' && rawName.length <= 50)
    ? rawName.replace(/[<>"'`]/g, '').trim() || 'Cristina'
    : 'Cristina'

  // Libri forniti dal client (RIV-Books multi-utente) — override su fetch Supabase
  const clientBooks = Array.isArray(req.body.books) && req.body.books.length > 0
    ? req.body.books : null

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

  // ── 2. Query Supabase (solo se il client non ha già fornito i libri) ─────────
  let tuttiLettiRaw, daLeggereRaw, statsRaw

  if (clientBooks) {
    // Usa i dati forniti dal client (utente multi-user di RIV-Books)
    tuttiLettiRaw = clientBooks.filter(b => b.stato_lettura === 'letto')
    daLeggereRaw  = clientBooks.filter(b => b.stato_lettura === 'da_leggere')
    statsRaw      = clientBooks
  } else {
    // Fetch da Supabase (RaccontiInValigia — Cristina, single-user)
    const [gb, db, sb] = await Promise.all([
      supabase.from('libri')
        .select('titolo, autore, casa_editrice, genere, anno_lettura, voto')
        .eq('stato_lettura', 'letto')
        .order('anno_lettura', { ascending: false }),
      supabase.from('libri')
        .select('titolo, autore')
        .eq('stato_lettura', 'da_leggere'),
      supabase.from('libri')
        .select('stato_lettura, anno_lettura'),
    ])
    tuttiLettiRaw = gb.data
    daLeggereRaw  = db.data
    statsRaw      = sb.data
  }

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
  // Sanitizza ogni campo prima di inserirlo nel prompt (anti prompt-injection)
  function fmt5(l) {
    const autore  = (l.autore || []).map(sanitize).join(', ') || '?'
    const editore = sanitize(l.casa_editrice) || null
    const genere  = (l.genere || []).map(sanitize).join(', ') || null
    const annoL   = l.anno_lettura ? ` [${l.anno_lettura}]` : ''
    return `"${sanitize(l.titolo) || '?'}" — ${[autore, editore, genere].filter(Boolean).join(', ')}${annoL}`
  }

  function fmt4(l) {
    const autore = (l.autore || []).map(sanitize).join(', ') || '?'
    const genere = (l.genere || []).map(sanitize).join(', ') || null
    return `"${sanitize(l.titolo) || '?'}" — ${[autore, genere].filter(Boolean).join(', ')}`
  }

  function fmtBase(l) {
    return `"${sanitize(l.titolo) || '?'}" (${(l.autore || []).map(sanitize).join(', ') || '?'})`
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
  const systemPrompt = `Sei l'assistente letterario personale di ${userName}.
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
2. Altro: scrivi tu...

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

D2c_sub — [SOLO per alcuni ambiti scelti in D2c — vedi sotto]

Se ha scelto "Musicale / artistico":
"Che genere o disciplina ti interessa? Scegli o scrivi tu:"
1. Rock / pop / indie
2. Jazz / blues / soul / R&B
3. Musica classica / lirica / opera
4. Cinema / teatro / danza
5. Arte visiva / pittura / scultura
6. Non ho preferenze
7. Altro: scrivi tu...

Se ha scelto "Sportivo":
"Che sport ti interessa? Scegli o scrivi tu:"
1. Calcio
2. Ciclismo / atletica / maratona
3. Tennis / sport individuali
4. Basket / sport americani
5. Sport estremi / avventura
6. Non ho preferenze
7. Altro: scrivi tu...

Se ha scelto "Imprenditoria / business":
"Che settore ti interessa? Scegli o scrivi tu:"
1. Finanza / investimenti (es. Warren Buffett, Ray Dalio)
2. Tech / startup / innovazione (es. Musk, Jobs)
3. Moda / lusso / retail
4. Industria / manifattura
5. Non ho preferenze
6. Altro: scrivi tu...

Se ha scelto "Politico / storico", "Letterario / intellettuale", "Scientifico / accademico"
o "Non ho preferenze": salta D2c_sub e vai direttamente a D3.

D2d — [SOLO se l'utente ha scelto "Saggistica" in D2]
Poni questa domanda:
"Che tipo di saggistica stai cercando? Scegli o scrivi tu:"
1. Filosofia / pensiero
2. Storia / politica
3. Scienza / natura / ambiente
4. Psicologia / mente / comportamento
5. Economia / società / geopolitica
6. Arte / cultura / critica letteraria
7. Viaggi / esplorazioni / geografie umane
8. Non ho preferenze
9. Altro: scrivi tu...

D3 — Tema o epoca?
1. Contemporaneo
2. Storico (qualsiasi epoca)
3. Nessuna preferenza
4. Altro: scrivi tu...

D4 — OBBLIGATORIA, sempre, qualunque sia il ramo seguito. Non saltarla mai.
Poni questa domanda esattamente così (2 opzioni numerate + testo intro):
"C'è qualche ulteriore informazione che vuoi aggiungere alla ricerca? Ad esempio: un autore che ami o che non sopporti, un'ambientazione specifica, un libro simile a uno che ti è piaciuto molto…"
1. No grazie, procedi
2. Altro: scrivi qui i tuoi dettagli...

Se l'utente clicca "No grazie, procedi" o scrive qualcosa di equivalente (niente, vai, procedi…): passa direttamente ai suggerimenti.
Se l'utente scrive dettagli nel campo libero o clicca l'opzione 2: usali per affinare la selezione, poi passa ai suggerimenti.

Flusso completo (branch paralleli da D2, non sequenziali):
D1 → D2 → ┬─ [se Narrativa] ──────────────────────────────────────────── D3 → D4
           ├─ [se Narrativa di viaggio] → D2b ──────────────────────────── D3 → D4
           ├─ [se Saggistica] → D2d ────────────────────────────────────── D3 → D4
           ├─ [se Autobiografia] → D2c → [D2c_sub se musicale/sport/biz] → D3 → D4
           └─ [se Altro] ──────────────────────────────────────────────── D3 → D4
Poni UNA domanda alla volta. NON saltare domande. D4 è l'ultima domanda SEMPRE — non dare suggerimenti prima di averla posta.

${REGOLA_AUTO_VERIFICA}

══ REGOLE PER I SUGGERIMENTI ══

REGOLA ASSOLUTA — DESTINAZIONE:
Se l'utente ha indicato una destinazione geografica in D2b (es. "Messico", "Giappone", "Patagonia"…),
TUTTI i libri suggeriti DEVONO essere ambientati in quella destinazione o riguardarla direttamente.
Un libro su Marrakech NON è un libro sul Messico. Sii preciso e letterale.

REGOLA — AUTOBIOGRAFIA:
Se l'utente ha indicato un ambito in D2c (es. "Musicale / artistico"), proponi solo autobiografie
di persone di quell'ambito. Non mescolare ambiti diversi.

PROFILO GUSTI:
Basa le scelte sullo stile, i temi e gli autori dei libri a 5★ e 4★ di ${userName}.
Preferisci autori simili, stessa densità narrativa, temi affini.

STRUTTURA RISPOSTA (seguila sempre):

Proponi 8-10 libri (minimo 5 se i criteri sono molto restrittivi) che Cristina NON ha ancora in libreria.
Per ognuno usa esattamente questo formato:

• "Titolo" — Autore
  📖 [Una frase che descrive il libro: di cosa parla, ambientazione, tono]
  ✓ Perché te lo propongo: [collegamento specifico con le risposte date e/o con i libri a 5★]

Dopo i suggerimenti principali, controlla la lista "DA LEGGERE" fornita sopra:
- Se trovi titoli EFFETTIVAMENTE PRESENTI in quella lista che siano pertinenti alle preferenze espresse, aggiungi:
---
📚 Hai già in libreria, da non dimenticare:
• "Titolo esatto dalla lista" — breve nota sul perché si adatta
- Se NON trovi nessun titolo pertinente nella lista DA LEGGERE, scrivi invece:
---
📚 Non ho trovato nulla di già disponibile in libreria che si adatti alle tue preferenze.

REGOLE AGGIUNTIVE:
- Non suggerire MAI libri dalla lista "TUTTI I LIBRI LETTI"
- Usa SOLO il formato • bullet per i suggerimenti (mai liste numerate 1. 2. 3.)
- Puoi citare libri dalla lista "DA LEGGERE" SOLO nella sezione finale — e SOLO se compaiono verbatim in quella lista
- NON inventare, NON parafrasare, NON citare titoli che non siano presenti ESATTAMENTE nella lista DA LEGGERE
- Se il vincolo è molto specifico e hai pochi titoli certi, meglio 5 ottimi che 10 mediocri

══ LIBRERIA DI ${userName.toUpperCase()} ══

Totale: ${totale} libri | Letti: ${nLetti} | In lettura: ${nLettura} | Da leggere: ${nDaLegg}
Letti per anno: ${anniStr || 'n.d.'}

★★★★★ LIBRI A 5 STELLE (gusti primari di ${userName} — base per i suggerimenti):
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
        max_tokens: 2500,
        temperature: 0.7,
      }),
    })

    let data
    try {
      data = await openaiRes.json()
    } catch (_) {
      return res.status(500).json({ error: 'Risposta non valida da OpenAI' })
    }
    if (!openaiRes.ok) {
      console.error('[chat] OpenAI error:', data.error?.message)
      return res.status(500).json({ error: 'Errore del servizio AI. Riprova tra qualche secondo.' })
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return res.status(500).json({ error: 'Risposta AI vuota' })

    return res.json({ content })
  } catch (e) {
    console.error('[chat] fetch error:', e.message)
    return res.status(500).json({ error: 'Errore di connessione verso OpenAI' })
  }
}
