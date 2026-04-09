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
