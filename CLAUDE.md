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

La regola è definita come costante `REGOLA_AUTO_VERIFICA` in cima a `web/pages/api/chat.js`.
**Modifica sempre lì**, non nel corpo del system prompt — il prompt la inserisce con `${REGOLA_AUTO_VERIFICA}`.

La regola impone che ogni titolo soddisfi CONTEMPORANEAMENTE:
- **Condizione A** — tutti i criteri selezionati dall'utente (genere, destinazione, ambito, epoca, lunghezza)
- **Condizione B** — coerenza con i gusti personali (stile/temi dei libri a 5★)

Obiettivo: 8-10 titoli. Minimo 5 se i criteri sono restrittivi. Mai allentare i criteri per fare numero.
Il formato usa bullet `•` (mai numerazione 1. 2. 3.) per evitare che i titoli diventino bottoni nell'app.
