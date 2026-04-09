-- ─────────────────────────────────────────────────────────────
-- RaccontiInValigia — Schema database Supabase
-- Esegui questo SQL nell'editor SQL di Supabase:
-- https://supabase.com → tuo progetto → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ENUM per stato lettura
CREATE TYPE stato_lettura_enum AS ENUM ('da_leggere', 'in_lettura', 'letto');

-- ENUM per stato WordPress recensione
CREATE TYPE wordpress_status_enum AS ENUM ('non_pubblicata', 'bozza', 'pubblicata');

-- Tabella principale libri
CREATE TABLE IF NOT EXISTS libri (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificativo
  isbn                      TEXT UNIQUE NOT NULL,

  -- Dati bibliografici
  titolo                    TEXT,
  autore                    TEXT[],              -- array: supporta più autori
  casa_editrice             TEXT,
  anno_pubblicazione        INTEGER,
  descrizione               TEXT,
  copertina                 TEXT,                -- URL o path Supabase Storage (singola)
  genere                    TEXT[],              -- array: più generi/categorie
  lingua_originale          TEXT,
  pagine                    INTEGER,

  -- Stato lettura di Cristina
  stato_lettura             stato_lettura_enum DEFAULT 'da_leggere',

  -- Note personali
  note_personali            TEXT,

  -- Provenienza dati
  data_source               TEXT DEFAULT 'pending',  -- 'api' | 'manual' | 'pending'

  -- Recensione / WordPress (future-ready — per ora vuoti)
  recensione_testo          TEXT,                -- HTML lungo della recensione
  recensione_pubblicata_at  TIMESTAMPTZ,
  wordpress_post_id         TEXT,
  wordpress_status          wordpress_status_enum DEFAULT 'non_pubblicata',

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- Indici utili per le query del dashboard
CREATE INDEX IF NOT EXISTS idx_libri_isbn             ON libri(isbn);
CREATE INDEX IF NOT EXISTS idx_libri_stato_lettura    ON libri(stato_lettura);
CREATE INDEX IF NOT EXISTS idx_libri_wordpress_status ON libri(wordpress_status);
CREATE INDEX IF NOT EXISTS idx_libri_data_source      ON libri(data_source);
CREATE INDEX IF NOT EXISTS idx_libri_autore           ON libri USING GIN(autore);
CREATE INDEX IF NOT EXISTS idx_libri_genere           ON libri USING GIN(genere);

-- Aggiorna updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER libri_updated_at
  BEFORE UPDATE ON libri
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- View comoda per il dashboard: statistiche aggregate
CREATE OR REPLACE VIEW libreria_stats AS
SELECT
  COUNT(*)                                                         AS totale,
  COUNT(*) FILTER (WHERE stato_lettura = 'letto')                  AS letti,
  COUNT(*) FILTER (WHERE stato_lettura = 'in_lettura')             AS in_lettura,
  COUNT(*) FILTER (WHERE stato_lettura = 'da_leggere')             AS da_leggere,
  COUNT(*) FILTER (WHERE data_source = 'api')                      AS con_dati_api,
  COUNT(*) FILTER (WHERE data_source = 'pending')                  AS dati_mancanti,
  COUNT(*) FILTER (WHERE copertina IS NOT NULL)                    AS con_copertina,
  COUNT(*) FILTER (WHERE copertina IS NULL)                        AS senza_copertina,
  COUNT(*) FILTER (WHERE wordpress_status = 'pubblicata')          AS recensioni_pubblicate,
  COUNT(*) FILTER (WHERE wordpress_status = 'bozza')               AS recensioni_bozza,
  COUNT(*) FILTER (WHERE wordpress_status = 'non_pubblicata'
                     AND stato_lettura = 'letto')                  AS letti_senza_recensione
FROM libri;

-- RLS (Row Level Security) — disabilitato per uso interno
-- Abilita se esponi l'app pubblicamente:
-- ALTER TABLE libri ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Storage bucket da creare manualmente in Supabase:
--   Nome: copertine
--   Tipo: Public (per URL pubbliche stabili)
-- ─────────────────────────────────────────────────────────────
