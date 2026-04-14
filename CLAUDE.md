# RaccontiInValigia — CLAUDE.md

> Istruzioni per Claude Code. Leggere prima di ogni azione. Tutte le regole si applicano per tutta la sessione.

---

## Regola principale

**Dopo ogni modifica a file del progetto, fai automaticamente commit e push su GitHub.**

- Usa `git add` sui file modificati (mai `-A` o `.` per evitare file sensibili)
- Messaggio di commit conciso in italiano o inglese, descrittivo della modifica
- Poi `git push` su `origin main`
- Non chiedere conferma: fallo in autonomia ogni volta

---

## Contesto progetto

App web per la libreria personale di Cristina (raccontiinvaligia.it).

**GitHub**: `git@github.com:marcobottigelli/raccontiinvaligia.git` (SSH, account marcobottigelli)  
**Stack**: Next.js 14 + React 18 + Tailwind CSS + Supabase (PostgreSQL + Storage), deploy Vercel  
**Branding**: rosso `#a90707`, testo `#32373c`, font Montserrat

**DB**: tabella `libri` in Supabase, bucket `copertine` (pubblico)  
**ISBN lookup**: Google Books API → Open Library fallback (nessuna chiave obbligatoria)

> ⚠️ `zoom=0` su Google Books restituisce un placeholder per libri italiani senza preview digitale. Usare sempre `zoom=1`.

---

## Regola auto-verifica suggerimenti libri (assistente AI)

Quando modifichi il system prompt dell'assistente AI (`web/pages/api/chat.js`), assicurati che sia presente il blocco AUTO-VERIFICA. La regola è: prima di proporre ogni singolo titolo, l'AI deve internamente verificare 4 condizioni:

1. **Pertinenza** al genere/destinazione/ambito scelto dall'utente
2. **Coerenza** di stile e temi con i libri a 5★ dell'utente
3. **Esclusione**: il titolo non è nella lista "già letti"
4. **Qualità**: il libro è reale, pubblicato, riconosciuto

Se anche solo 1 controllo fallisce → scartare il titolo e cercarne un altro.
Il formato di output per i suggerimenti usa bullet `•` (mai numerazione 1. 2. 3.) per evitare che i titoli vengano renderizzati come bottoni quick-reply nell'app nativa.
