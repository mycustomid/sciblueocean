"""Manager-maintained labels for the existing 25 Miague rooms.

Callers must enforce manager-only access and CSRF before invoking write_room.
Stable room numbers remain authoritative for assignment and conflict checks.
"""
import re
from datetime import datetime, timezone

ROOM_RE = re.compile(r'MIAGUE-(?:0[1-9]|1[0-9]|2[0-5])\Z')

def migrate(cx):
    cx.execute('''CREATE TABLE IF NOT EXISTS room_catalog (
        room_number TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )''')

def list_rooms(cx):
    stored = {row['room_number']: dict(row) for row in cx.execute(
        'SELECT room_number,display_name,updated_at FROM room_catalog')}
    return [stored.get(f'MIAGUE-{n:02d}', {
        'room_number': f'MIAGUE-{n:02d}', 'display_name': f'Chambre {n:02d}',
        'updated_at': None}) for n in range(1, 26)]

def write_room(cx, payload, actor):
    number = str(payload.get('room_number', ''))
    name = str(payload.get('display_name', '')).strip()
    if not ROOM_RE.fullmatch(number):
        raise ValueError('Unknown room')
    if not 1 <= len(name) <= 80 or any(ord(c) < 32 for c in name):
        raise ValueError('Room name must contain 1 to 80 characters')
    now = datetime.now(timezone.utc).isoformat()
    cx.execute('''INSERT INTO room_catalog(room_number, display_name, updated_at)
                  VALUES(?,?,?) ON CONFLICT(room_number) DO UPDATE SET
                  display_name=excluded.display_name, updated_at=excluded.updated_at''',
               (number, name, now))
    cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES(?,?,?,?,?)',
               (actor, 'room:rename', 'room', number, now))
    return {'room_number':number, 'display_name':name, 'updated_at':now}
