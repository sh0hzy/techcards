"""
Local server for techcards admin panel.

  - Serves all static files (admin.html, js/, style.css, ...)
  - REST API for card/category CRUD backed by individual JSON files in data/

File layout:
  data/
    categories.json
    cards/
      {category_slug}/
        {card_group}/
          index.json       <- main card
          {slug}.json      <- sub-cards

Run:
    python server.py
Then open:
    http://localhost:8000/admin.html
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = 8000
ROOT = Path(__file__).parent          # project root (static files served from here)
DATA = ROOT / "data"
CARDS_DIR = DATA / "cards"


# ── File helpers ──────────────────────────────────────────────────────────────

def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default if default is not None else {}


def write_json(path, data):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def all_cards():
    """Read every card JSON file from data/cards/**/*.json"""
    cards = []
    if CARDS_DIR.exists():
        for f in sorted(CARDS_DIR.rglob("*.json")):
            card = read_json(f)
            if card.get("id"):
                cards.append(card)
    return cards


def find_card_file(card_id):
    """Find the JSON file for a given card id."""
    if CARDS_DIR.exists():
        for f in CARDS_DIR.rglob("*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                if data.get("id") == card_id:
                    return f
            except Exception:
                pass
    return None


def card_file_path(card):
    """
    Determine the file path for a card.
    Uses category_id + slug to build:  data/cards/{category_slug}/{card_slug}/index.json
    or sub-card:                        data/cards/{category_slug}/{parent_slug}/{card_slug}.json
    """
    cat_id = card.get("category_id") or "uncategorized"
    slug = card.get("slug") or card.get("id", "card")
    parent_id = card.get("parent_id")

    # Resolve category slug
    categories = read_json(DATA / "categories.json", default=[])
    cat = next((c for c in categories if c["id"] == cat_id), None)
    cat_slug = cat["slug"] if cat else cat_id

    if parent_id:
        # Sub-card: find parent's folder
        parent_file = find_card_file(parent_id)
        if parent_file:
            # Place sibling to parent's index.json
            return parent_file.parent / f"{slug}.json"
        # Fallback: same category folder
        return CARDS_DIR / cat_slug / slug / "index.json"
    else:
        # Main card: data/cards/{cat_slug}/{card_slug}/index.json
        return CARDS_DIR / cat_slug / slug / "index.json"


# ── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # ── CORS & helpers ────────────────────────────────────────────────────────

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw)

    def _path(self):
        return urlparse(self.path).path

    # ── OPTIONS (preflight) ───────────────────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────

    def do_GET(self):
        p = self._path()

        if p == "/api/cards":
            self._json(all_cards())

        elif p.startswith("/api/cards/"):
            card_id = p[len("/api/cards/"):]
            f = find_card_file(card_id)
            if f:
                self._json(read_json(f))
            else:
                self._json({"error": "not found"}, 404)

        elif p == "/api/categories":
            cats = read_json(DATA / "categories.json", default=[])
            self._json(cats)

        elif p.startswith("/api/"):
            self._json({"error": "unknown endpoint"}, 404)

        else:
            super().do_GET()

    # ── POST ──────────────────────────────────────────────────────────────────

    def do_POST(self):
        p = self._path()

        if p == "/api/cards":
            card = self._body()
            path = card_file_path(card)
            write_json(path, card)
            print(f"  [save] {path.relative_to(ROOT)}")
            self._json({"ok": True, "path": str(path.relative_to(ROOT))})

        elif p == "/api/categories":
            cats = self._body()
            write_json(DATA / "categories.json", cats)
            self._json({"ok": True})

        elif p == "/api/sync/cards":
            # Batch save — admin.js sends full cards array
            cards = self._body()
            if not isinstance(cards, list):
                cards = []
            for card in cards:
                if card.get("id"):
                    path = card_file_path(card)
                    # Only write if file already exists (update) or is a new card
                    write_json(path, card)
            print(f"  [sync] {len(cards)} cards synced to files")
            self._json({"ok": True, "count": len(cards)})

        elif p == "/api/sync/categories":
            cats = self._body()
            write_json(DATA / "categories.json", cats)
            print(f"  [sync] categories saved")
            self._json({"ok": True})

        else:
            self._json({"error": "unknown endpoint"}, 404)

    # ── PUT ───────────────────────────────────────────────────────────────────

    def do_PUT(self):
        p = self._path()
        if p.startswith("/api/cards/"):
            card = self._body()
            # Remove old file if slug changed
            card_id = p[len("/api/cards/"):]
            old_file = find_card_file(card_id)
            new_path = card_file_path(card)
            if old_file and old_file.resolve() != new_path.resolve():
                old_file.unlink(missing_ok=True)
                self._remove_empty_dirs(old_file.parent)
            write_json(new_path, card)
            print(f"  [update] {new_path.relative_to(ROOT)}")
            self._json({"ok": True})
        else:
            self._json({"error": "unknown endpoint"}, 404)

    # ── DELETE ────────────────────────────────────────────────────────────────

    def do_DELETE(self):
        p = self._path()
        if p.startswith("/api/cards/"):
            card_id = p[len("/api/cards/"):]
            f = find_card_file(card_id)
            if f:
                f.unlink(missing_ok=True)
                self._remove_empty_dirs(f.parent)
                print(f"  [delete] {card_id}")
                self._json({"ok": True})
            else:
                self._json({"error": "not found"}, 404)
        else:
            self._json({"error": "unknown endpoint"}, 404)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _remove_empty_dirs(self, folder):
        """Remove folder and parents if empty (up to CARDS_DIR)."""
        try:
            while folder != CARDS_DIR and folder.exists() and not any(folder.iterdir()):
                folder.rmdir()
                folder = folder.parent
        except Exception:
            pass

    def log_message(self, fmt, *args):
        # Only show non-200 responses to keep output clean
        if len(args) >= 2 and args[1] != "200":
            super().log_message(fmt, *args)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    DATA.mkdir(exist_ok=True)
    CARDS_DIR.mkdir(parents=True, exist_ok=True)

    os.chdir(ROOT)
    httpd = HTTPServer(("localhost", PORT), Handler)

    print(f"techcards server  ->  http://localhost:{PORT}/admin.html")
    print(f"Data directory    ->  {DATA}")
    print(f"Press Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
