#!/usr/bin/env python3
"""
import_isbns.py — Legge data/isbn_list.txt e popola il database Supabase
con i dati dei libri recuperati via Google Books API e Open Library (fallback).

Uso:
    python scripts/import_isbns.py
    python scripts/import_isbns.py --dry-run       # solo mostra cosa farebbe
    python scripts/import_isbns.py --file path/to/other.txt
    python scripts/import_isbns.py --delay 1.0     # pausa tra le chiamate API (sec)
"""

import os
import sys
import time
import argparse
import requests
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# ─── Carica .env ──────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_KEY        = os.getenv("SUPABASE_KEY")
GOOGLE_BOOKS_KEY    = os.getenv("GOOGLE_BOOKS_API_KEY", "")

HEADERS = {"User-Agent": "RaccontiInValigia/1.0"}


# ─── Lookup Google Books ───────────────────────────────────────────────────────

def lookup_google_books(isbn: str) -> Optional[dict]:
    """Cerca il libro su Google Books API."""
    try:
        url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
        if GOOGLE_BOOKS_KEY:
            url += f"&key={GOOGLE_BOOKS_KEY}"

        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        data = resp.json()
        if not data.get("totalItems") or not data.get("items"):
            return None

        v = data["items"][0].get("volumeInfo", {})
        if not v.get("title"):
            return None

        # Copertina: zoom=0 per immagine più grande
        copertina = None
        if v.get("imageLinks"):
            img = v["imageLinks"]
            copertina = img.get("large") or img.get("medium") or img.get("thumbnail")
            if copertina:
                copertina = copertina.replace("zoom=1", "zoom=0").replace("&edge=curl", "")

        # Anno pubblicazione
        anno = None
        if v.get("publishedDate"):
            try:
                anno = int(v["publishedDate"][:4])
            except ValueError:
                pass

        return {
            "titolo":             v.get("title"),
            "autore":             v.get("authors", []),
            "casa_editrice":      v.get("publisher"),
            "anno_pubblicazione": anno,
            "descrizione":        v.get("description"),
            "copertina":          copertina,
            "genere":             v.get("categories", []),
            "lingua_originale":   v.get("language"),
            "pagine":             v.get("pageCount"),
            "data_source":        "api",
        }
    except Exception as e:
        print(f"  [Google Books] errore per {isbn}: {e}")
        return None


# ─── Lookup Open Library ───────────────────────────────────────────────────────

def lookup_open_library(isbn: str) -> Optional[dict]:
    """Cerca il libro su Open Library — fallback gratuito."""
    try:
        resp = requests.get(
            f"https://openlibrary.org/isbn/{isbn}.json",
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        if not data.get("title"):
            return None

        # Autori: risolvi i key /authors/OL123A (max 3, con timeout)
        autori = []
        for a in (data.get("authors") or [])[:3]:
            key = a.get("key", "")
            try:
                ar = requests.get(
                    f"https://openlibrary.org{key}.json",
                    headers=HEADERS,
                    timeout=3,
                )
                if ar.ok:
                    ad = ar.json()
                    name = ad.get("name") or ad.get("personal_name")
                    if name:
                        autori.append(name)
            except Exception:
                pass

        # Anno
        anno = None
        publish_date = data.get("publish_date", "")
        import re
        m = re.search(r"\d{4}", publish_date)
        if m:
            anno = int(m.group())

        # Lingua
        lingua = None
        if data.get("languages") and data["languages"][0].get("key"):
            lingua = data["languages"][0]["key"].split("/")[-1]  # es. 'ita'

        # Descrizione
        descrizione = data.get("description")
        if isinstance(descrizione, dict):
            descrizione = descrizione.get("value")

        # Genere (prime 3 voci)
        genere = (data.get("subjects") or [])[:3]

        # Copertina Open Library
        copertina = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"

        return {
            "titolo":             data.get("title"),
            "autore":             autori,
            "casa_editrice":      (data.get("publishers") or [None])[0],
            "anno_pubblicazione": anno,
            "descrizione":        descrizione,
            "copertina":          copertina,
            "genere":             genere,
            "lingua_originale":   lingua,
            "pagine":             data.get("number_of_pages"),
            "data_source":        "api",
        }
    except Exception as e:
        print(f"  [Open Library] errore per {isbn}: {e}")
        return None


# ─── Lookup principale ────────────────────────────────────────────────────────

def lookup_isbn(isbn: str) -> dict:
    """Prova Google Books, poi Open Library come fallback."""
    result = lookup_google_books(isbn)
    if result:
        return result
    result = lookup_open_library(isbn)
    if result:
        return result
    # Non trovato — restituisce record vuoto da compilare manualmente
    return {
        "titolo":             None,
        "autore":             [],
        "casa_editrice":      None,
        "anno_pubblicazione": None,
        "descrizione":        None,
        "copertina":          None,
        "genere":             [],
        "lingua_originale":   None,
        "pagine":             None,
        "data_source":        "pending",
    }


# ─── Caricamento ISBN da file ─────────────────────────────────────────────────

def load_isbns(filepath: Path) -> list[str]:
    """Legge il file ISBN, ignora righe vuote e commenti (#)."""
    if not filepath.exists():
        print(f"[ERRORE] File non trovato: {filepath}")
        sys.exit(1)
    isbns = []
    for line in filepath.read_text().splitlines():
        line = line.strip().replace("-", "").replace(" ", "")
        if not line or line.startswith("#"):
            continue
        isbns.append(line)
    return isbns


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Importa ISBN nel database RaccontiInValigia")
    parser.add_argument("--file",    default=str(ROOT / "data" / "isbn_list.txt"))
    parser.add_argument("--dry-run", action="store_true", help="Non scrive su Supabase")
    parser.add_argument("--delay",   type=float, default=0.5, help="Pausa tra le chiamate API (sec)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERRORE] SUPABASE_URL e SUPABASE_KEY mancanti nel file .env")
        sys.exit(1)

    isbns = load_isbns(Path(args.file))
    if not isbns:
        print("Nessun ISBN trovato nel file.")
        sys.exit(0)

    print(f"\n{'─'*55}")
    print(f"  RaccontiInValigia — Import ISBN")
    print(f"{'─'*55}")
    print(f"  File: {args.file}")
    print(f"  ISBN da processare: {len(isbns)}")
    print(f"  Dry run: {'SI' if args.dry_run else 'NO'}")
    print(f"  Google Books API key: {'SI' if GOOGLE_BOOKS_KEY else 'NO (rate limit ~1000/day)'}")
    print(f"{'─'*55}\n")

    if not args.dry_run:
        db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    stats = {"found": 0, "not_found": 0, "skipped": 0, "error": 0}

    for i, isbn in enumerate(isbns, 1):
        print(f"[{i:>4}/{len(isbns)}] ISBN {isbn} ... ", end="", flush=True)

        if not args.dry_run:
            # Controlla se già presente con dati
            existing = db.table("libri").select("id,data_source").eq("isbn", isbn).execute()
            if existing.data:
                ds = existing.data[0].get("data_source", "pending")
                if ds != "pending":
                    print(f"già in DB ({ds}) — skip")
                    stats["skipped"] += 1
                    continue

        book_data = lookup_isbn(isbn)
        status = "✓ trovato" if book_data["data_source"] == "api" else "✗ non trovato"

        if book_data["data_source"] == "api":
            stats["found"] += 1
        else:
            stats["not_found"] += 1

        titolo_display = book_data.get("titolo") or "(titolo mancante)"
        print(f"{status} — {titolo_display}")

        if not args.dry_run:
            try:
                row = {"isbn": isbn, **book_data}
                db.table("libri").upsert(row, on_conflict="isbn").execute()
            except Exception as e:
                print(f"       [DB ERRORE] {e}")
                stats["error"] += 1

        time.sleep(args.delay)

    print(f"\n{'─'*55}")
    print(f"  Completato!")
    print(f"  ✓ Trovati via API:      {stats['found']}")
    print(f"  ✗ Da compilare manuale: {stats['not_found']}")
    print(f"  ↷ Già in DB (skip):    {stats['skipped']}")
    if stats["error"]:
        print(f"  ! Errori DB:           {stats['error']}")
    print(f"{'─'*55}\n")


if __name__ == "__main__":
    main()
