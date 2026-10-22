#!/usr/bin/env python3
"""Ledgerlight local server.

Serves the app from ./public and keeps every record in ./data/finance.db (SQLite).
Uses only the Python standard library, so there is nothing to install.

    python3 server.py            # http://localhost:8765
    python3 server.py --port 9000
"""
import json
import os
import sqlite3
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
DATA = os.path.join(ROOT, "data")
BACKUPS = os.path.join(DATA, "backups")
DB_PATH = os.path.join(DATA, "finance.db")

COLLECTIONS = (
    "meta", "accounts", "categories", "transactions", "budgets", "bills",
    "goals", "debts", "holdings", "rules", "documents",
)

os.makedirs(BACKUPS, exist_ok=True)
_lock = threading.Lock()


def connect():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute(
        """CREATE TABLE IF NOT EXISTS records (
               collection TEXT NOT NULL,
               id         TEXT NOT NULL,
               position   INTEGER NOT NULL,
               data       TEXT NOT NULL,
               updated_at REAL NOT NULL,
               PRIMARY KEY (collection, id)
           )"""
    )
    con.execute("CREATE INDEX IF NOT EXISTS idx_records_col ON records(collection, position)")
    return con


def read_state():
    con = connect()
    try:
        rows = con.execute("SELECT collection, data FROM records ORDER BY collection, position").fetchall()
    finally:
        con.close()
    if not rows:
        return None
    state = {c: [] for c in COLLECTIONS}
    for col, data in rows:
        state.setdefault(col, []).append(json.loads(data))
    # meta is stored as a single-row collection
    state["meta"] = state["meta"][0] if state.get("meta") else {}
    return state


def write_collection(con, name, items):
    if name == "meta":
        items = [dict(items, id="meta")] if isinstance(items, dict) else []
    now = time.time()
    con.execute("DELETE FROM records WHERE collection=?", (name,))
    con.executemany(
        "INSERT INTO records (collection, id, position, data, updated_at) VALUES (?,?,?,?,?)",
        [(name, str(it.get("id", i)), i, json.dumps(it, separators=(",", ":")), now) for i, it in enumerate(items)],
    )


def backup(reason="manual"):
    if not os.path.exists(DB_PATH):
        return None
    stamp = time.strftime("%Y-%m-%d_%H-%M-%S")
    dest = os.path.join(BACKUPS, "finance_%s_%s.db" % (stamp, reason))
    src = sqlite3.connect(DB_PATH)
    dst = sqlite3.connect(dest)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    # keep the 20 most recent backups
    files = sorted(f for f in os.listdir(BACKUPS) if f.endswith(".db"))
    for old in files[:-20]:
        os.remove(os.path.join(BACKUPS, old))
    return os.path.basename(dest)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("%s  %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"null")

    def do_GET(self):
        if self.path == "/api/health":
            return self._json(200, {"ok": True, "db": os.path.relpath(DB_PATH, ROOT)})
        if self.path == "/api/state":
            with _lock:
                return self._json(200, {"state": read_state()})
        if self.path == "/api/backups":
            files = sorted((f for f in os.listdir(BACKUPS) if f.endswith(".db")), reverse=True)
            return self._json(200, {"backups": files})
        return super().do_GET()

    def do_PUT(self):
        # PUT /api/collections/<name>  body: [records]   (meta takes an object)
        if self.path.startswith("/api/collections/"):
            name = self.path.rsplit("/", 1)[-1]
            if name not in COLLECTIONS:
                return self._json(400, {"error": "Unknown collection: %s" % name})
            items = self._body()
            with _lock:
                con = connect()
                with con:
                    write_collection(con, name, items)
                con.close()
            return self._json(200, {"ok": True, "saved": name})
        if self.path == "/api/state":
            state = self._body() or {}
            with _lock:
                backup("before-replace")
                con = connect()
                with con:
                    for name in COLLECTIONS:
                        write_collection(con, name, state.get(name, {} if name == "meta" else []))
                con.close()
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/api/backup":
            with _lock:
                name = backup("manual")
            return self._json(200, {"ok": True, "file": name})
        return self._json(404, {"error": "Not found"})

    def do_DELETE(self):
        if self.path == "/api/state":
            with _lock:
                backup("before-clear")
                con = connect()
                with con:
                    con.execute("DELETE FROM records")
                con.close()
            return self._json(200, {"ok": True})
        return self._json(404, {"error": "Not found"})


def main():
    port = 8765
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    connect().close()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = "http://localhost:%d/" % port
    print("\n  Ledgerlight is running at %s" % url)
    print("  Database: %s" % DB_PATH)
    print("  Close this window or press Ctrl+C to stop.\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("\n  Stopped.")


if __name__ == "__main__":
    main()
