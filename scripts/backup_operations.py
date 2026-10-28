"""Back up the local operational SQLite database without shell code quoting."""
import sqlite3
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:3])
if source.resolve() == destination.resolve() or destination.exists():
    raise SystemExit('Refusing to overwrite database or existing backup')
with sqlite3.connect(source) as original, sqlite3.connect(destination) as backup:
    original.backup(backup)
    result = backup.execute('PRAGMA integrity_check').fetchone()[0]
    if result != 'ok':
        raise SystemExit('Backup integrity check failed')
print('Backup integrity: ok')
