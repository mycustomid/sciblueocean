"""Immutable, non-fiscal pro forma snapshots for authorized front desk staff."""
import json
import re
import secrets


def migrate(cx):
    cx.execute('''CREATE TABLE IF NOT EXISTS proformas (
        id INTEGER PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
        booking_id INTEGER NOT NULL REFERENCES bookings(id), created_at TEXT NOT NULL,
        created_by TEXT NOT NULL, snapshot TEXT NOT NULL)''')


def create(cx, booking_id, discount_percent, actor, now):
    if isinstance(booking_id, bool) or not isinstance(booking_id, int) or booking_id < 1:
        raise ValueError('Invalid booking')
    row = cx.execute("SELECT id,reference,guest,email,checkin,checkout,guests,nights,estimate_xaf,subtotal_xaf,original_estimate_xaf,discount_percent,discount_xaf,status,room_number FROM bookings WHERE id=? AND property='MIAGUE'", (booking_id,)).fetchone()
    if not row or row['status'] == 'cancelled':
        raise LookupError('Booking not found or cancelled')
    booking = dict(row)
    net = int(booking['estimate_xaf'])
    applied_pct = booking['discount_percent']
    discount = booking['discount_xaf']
    original = booking['original_estimate_xaf']
    if discount_percent is not None and (isinstance(discount_percent, bool) or not isinstance(discount_percent, int) or discount_percent != applied_pct):
        raise ValueError('Appliquez d’abord la remise à la réservation avant de créer le pro forma.')
    if net < 0 or applied_pct not in (0, *range(5, 21)):
        raise ValueError('Invalid stored estimate')
    if original is None:
        if applied_pct != 0 or discount != 0:
            raise ValueError('Invalid stored discount')
        original = net
    subtotal = booking['subtotal_xaf']
    if subtotal is not None and (not isinstance(subtotal, int) or subtotal < 0 or subtotal > original):
        raise ValueError('Invalid accommodation subtotal')
    if applied_pct and subtotal is None:
        raise ValueError('Sous-total hébergement indisponible pour cette réservation ; remise impossible.')
    if discount != ((subtotal or 0) * applied_pct + 50) // 100 or net != original - discount:
        raise ValueError('Montant ou remise enregistrée incohérents.')
    charges = [dict(r) for r in cx.execute('SELECT label,amount_xaf FROM charges WHERE booking_id=? ORDER BY id', (booking_id,))]
    extra = sum(int(item['amount_xaf']) for item in charges)
    reference = 'PF-' + secrets.token_hex(8).upper()
    record = {'reference':reference, 'created_at':now, 'booking':booking, 'discount_percent':applied_pct,
              'estimate_xaf':original, 'subtotal_xaf':subtotal, 'discount_xaf':discount, 'charges':charges,
              'charges_xaf':extra, 'total_xaf':net+extra,
              'notice':'Pro forma indicative, hors taxes non configurées. La remise affichée est déjà enregistrée sur la réservation. Ce document ne confirme aucun paiement et ne constitue pas une facture fiscale.'}
    cx.execute('INSERT INTO proformas(reference,booking_id,created_at,created_by,snapshot) VALUES(?,?,?,?,?)',
               (reference, booking_id, now, actor, json.dumps(record, ensure_ascii=False)))
    cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES(?,?,?,?,?)',
               (actor,'proforma:create','booking',reference,now))
    return record


def get(cx, reference):
    if not isinstance(reference, str) or not re.fullmatch(r'PF-[A-F0-9]{16}', reference):
        raise LookupError('Pro forma not found')
    row = cx.execute('SELECT snapshot FROM proformas WHERE reference=?', (reference,)).fetchone()
    if not row:
        raise LookupError('Pro forma not found')
    return json.loads(row['snapshot'])
