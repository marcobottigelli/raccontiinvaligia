# RaccontiInValigia — Libreria di Cristina

App web per gestire il catalogo personale di libri di Cristina, con integrazione futura per pubblicare recensioni su [raccontiinvaligia.it](https://raccontiinvaligia.it).

---

## Stack

- **Frontend**: Next.js 14 + React 18 + Tailwind CSS
- **Database**: Supabase (PostgreSQL + Storage)
- **Lookup ISBN**: Google Books API → Open Library (fallback, entrambi gratuiti)
- **Rimozione sfondo copertine**: rembg (locale, gratuito)
- **Deploy**: Vercel

---

## Setup

### 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto chiamato `raccontiinvaligia`
2. Apri **SQL Editor** ed esegui il contenuto di `scripts/schema.sql`
3. Vai in **Storage** → crea un bucket chiamato `copertine` (tipo: **Public**)
4. Copia le chiavi API da **Settings → API**

### 2. Configura le credenziali

```bash
# Crea i file .env dalla copia dei file di esempio
cp .env.example .env
cp web/.env.local.example web/.env.local
```

Modifica `.env` (per gli script Python):
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=<service_role key>
```

Modifica `web/.env.local` (per Next.js):
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=<anon key>
```

### 3. Installa le dipendenze

```bash
# Python
pip install -r requirements.txt

# Node.js
cd web && npm install
```

### 4. Avvia in locale

```bash
cd web && npm run dev
# Apri http://localhost:3000
```

---

## Workflow

### Aggiungere libri da interfaccia

1. Vai in **Libreria** → clicca **+ Aggiungi libro**
2. Inserisci l'ISBN e clicca **Cerca**
3. I dati vengono recuperati automaticamente da Google Books o Open Library
4. Modifica i campi se necessario e clicca **Salva libro**

### Importazione batch (Python)

Aggiungi gli ISBN a `data/isbn_list.txt` (uno per riga), poi:

```bash
python scripts/import_isbns.py --dry-run   # anteprima senza scrivere
python scripts/import_isbns.py             # importazione reale
```

### Aggiungere copertine fotografate

1. Fotografa il libro e salva in `data/photos/{ISBN}.jpg`
2. Esegui la rimozione sfondo:
   ```bash
   python scripts/remove_bg.py
   ```
3. Carica su Supabase e aggiorna il DB:
   ```bash
   python scripts/remove_bg.py --update-db
   ```

---

## Deploy su Vercel

1. Crea un nuovo progetto su [vercel.com](https://vercel.com)
2. Collega il repository GitHub `marcobottigelli/raccontiinvaligia`
3. Imposta **Root Directory**: `web`
4. Aggiungi le variabili d'ambiente (stesse di `web/.env.local`) nelle impostazioni Vercel
5. Deploy automatico ad ogni push su `main`

---

## Struttura

```
RaccontiInValigia/
├── api/
│   └── isbn-lookup.js      # Vercel Function: proxy lookup ISBN (Google Books → Open Library)
├── scripts/
│   ├── schema.sql          # Schema Supabase da eseguire nell'SQL Editor
│   ├── import_isbns.py     # Import batch ISBN → Supabase
│   └── remove_bg.py        # Rimozione sfondo copertine → Supabase Storage
├── web/
│   ├── pages/
│   │   ├── index.js        # Dashboard statistiche
│   │   ├── libri.js        # Catalogo libri con ricerca e filtri
│   │   ├── libro/[id].js   # Scheda dettaglio e modifica libro
│   │   └── api/libri.js    # CRUD API
│   ├── components/
│   │   └── Layout.js
│   └── lib/
│       └── supabase.js
├── data/
│   ├── isbn_list.txt       # Lista ISBN per import batch
│   └── photos/             # Foto copertine (processed/ ignorata da git)
├── .env.example
└── requirements.txt
```

---

## Roadmap

- [x] Catalogo libri con lookup ISBN automatico
- [x] Gestione stato lettura (Da leggere / In lettura / Letto)
- [x] Dashboard statistiche
- [x] Copertine con rimozione sfondo
- [ ] Assistente AI per scrivere recensioni (OpenAI)
- [ ] Pubblicazione recensioni su WordPress via REST API
