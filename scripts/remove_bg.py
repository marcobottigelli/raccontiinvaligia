#!/usr/bin/env python3
"""
remove_bg.py — Rimozione sfondo batch per le copertine dei libri fotografati.
Usa la libreria rembg (locale, gratuita, nessuna chiave API).

Uso:
    python scripts/remove_bg.py                     # processa data/photos/
    python scripts/remove_bg.py --input path/img    # singola immagine
    python scripts/remove_bg.py --update-db         # carica su Supabase e aggiorna DB

Installazione:
    pip install rembg[gpu] pillow  # con GPU (consigliato)
    pip install rembg pillow       # CPU only

Convenzione nomi file:
    Il nome del file (senza estensione) deve corrispondere all'ISBN del libro.
    Esempio: data/photos/9788804668237.jpg → processed/9788804668237_nobg.png
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

PHOTOS_DIR    = ROOT / "data" / "photos"
PROCESSED_DIR = ROOT / "data" / "photos" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def process_image(input_path: Path, output_path: Path) -> bool:
    """Rimuove lo sfondo da un'immagine e salva il risultato in PNG."""
    try:
        from rembg import remove
        from PIL import Image

        with open(input_path, "rb") as f:
            input_data = f.read()

        output_data = remove(input_data)

        with open(output_path, "wb") as f:
            f.write(output_data)

        return True
    except ImportError:
        print("[ERRORE] rembg non installato. Esegui: pip install rembg pillow")
        sys.exit(1)
    except Exception as e:
        print(f"  [ERRORE] {input_path.name}: {e}")
        return False


def process_directory(input_dir: Path, output_dir: Path, overwrite: bool = False) -> dict:
    """Processa tutte le immagini in una cartella."""
    images = [f for f in input_dir.iterdir() if f.suffix.lower() in SUPPORTED_FORMATS]

    if not images:
        print(f"Nessuna immagine trovata in {input_dir}")
        return {"processed": 0, "skipped": 0, "errors": 0}

    print(f"\n{'─'*55}")
    print(f"  RaccontiInValigia — Rimozione sfondo copertine")
    print(f"{'─'*55}")
    print(f"  Input:  {input_dir}")
    print(f"  Output: {output_dir}")
    print(f"  Immagini trovate: {len(images)}")
    print(f"{'─'*55}\n")

    stats = {"processed": 0, "skipped": 0, "errors": 0}

    for i, img_path in enumerate(images, 1):
        output_path = output_dir / (img_path.stem + "_nobg.png")

        if output_path.exists() and not overwrite:
            print(f"[{i:>4}/{len(images)}] {img_path.name} — già processata, skip")
            stats["skipped"] += 1
            continue

        print(f"[{i:>4}/{len(images)}] {img_path.name} ... ", end="", flush=True)
        success = process_image(img_path, output_path)

        if success:
            size_kb = output_path.stat().st_size // 1024
            print(f"✓ salvata ({size_kb} KB)")
            stats["processed"] += 1
        else:
            stats["errors"] += 1

    print(f"\n{'─'*55}")
    print(f"  ✓ Processate: {stats['processed']}")
    print(f"  ↷ Saltate:    {stats['skipped']}")
    if stats["errors"]:
        print(f"  ! Errori:     {stats['errors']}")
    print(f"{'─'*55}\n")

    return stats


def update_supabase(output_dir: Path, bucket: str = "copertine"):
    """
    Carica le immagini processate su Supabase Storage e aggiorna il campo
    'copertina' nella tabella 'libri'.
    Il nome del file deve corrispondere all'ISBN: {ISBN}_nobg.png
    """
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERRORE] SUPABASE_URL e SUPABASE_KEY mancanti nel file .env")
        return

    try:
        from supabase import create_client
    except ImportError:
        print("[ERRORE] supabase-py non installato. Esegui: pip install supabase")
        return

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    processed_images = list(output_dir.glob("*_nobg.png"))

    print(f"\nAggiornamento Supabase per {len(processed_images)} copertine...")

    for img_path in processed_images:
        # Estrae ISBN dal nome file: {ISBN}_nobg.png
        isbn = img_path.stem.replace("_nobg", "")

        # Controlla se il libro esiste
        result = db.table("libri").select("id").eq("isbn", isbn).execute()
        if not result.data:
            print(f"  {isbn}: libro non trovato in DB — skip")
            continue

        # Carica su Supabase Storage
        storage_path = f"{isbn}/{img_path.name}"
        try:
            with open(img_path, "rb") as f:
                db.storage.from_(bucket).upload(
                    storage_path, f, {"content-type": "image/png", "upsert": "true"}
                )

            # URL pubblica della copertina
            public_url = db.storage.from_(bucket).get_public_url(storage_path)

            # Aggiorna il campo copertina (TEXT, non array)
            db.table("libri").update({"copertina": public_url}).eq("isbn", isbn).execute()
            print(f"  {isbn}: ✓ copertina caricata e DB aggiornato")

        except Exception as e:
            print(f"  {isbn}: ✗ errore — {e}")


def main():
    parser = argparse.ArgumentParser(description="Rimozione sfondo copertine libri RaccontiInValigia")
    parser.add_argument("--input",      default=str(PHOTOS_DIR), help="Cartella o file input")
    parser.add_argument("--output",     default=str(PROCESSED_DIR), help="Cartella output")
    parser.add_argument("--overwrite",  action="store_true", help="Sovrascrive file già processati")
    parser.add_argument("--update-db",  action="store_true", help="Carica su Supabase Storage e aggiorna DB")
    args = parser.parse_args()

    input_path  = Path(args.input)
    output_path = Path(args.output)

    if input_path.is_file():
        # Singola immagine
        out = output_path / (input_path.stem + "_nobg.png") if output_path.is_dir() else output_path
        print(f"Processando {input_path.name}...")
        process_image(input_path, out)
        print(f"Salvata in: {out}")
    elif input_path.is_dir():
        process_directory(input_path, output_path, overwrite=args.overwrite)
    else:
        print(f"[ERRORE] Percorso non valido: {input_path}")
        sys.exit(1)

    if args.update_db:
        update_supabase(output_path)


if __name__ == "__main__":
    main()
