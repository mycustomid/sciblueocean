"""Server-authoritative demo pricing, XAF integers only; no synthetic legal tax.

Designed for isolated localhost demonstrations, NOT a deployed PMS.
Per-night overrides are explicitly configured by an authorized manager.
Any charge/tax not configured in the system is NOT represented as zero tax liability.
"""
from datetime import date, timedelta

BASE_RATE_XAF = 40000  # Public reference price: Miague from 40,000 FCFA/night
MAX_NIGHTS = 180


def migrate(cx):
    cx.executescript('''
        CREATE TABLE IF NOT EXISTS rate_overrides (
            day TEXT PRIMARY KEY, rate_xaf INTEGER NOT NULL CHECK(rate_xaf BETWEEN 1000 AND 10000000),
            reason TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS inventory_blocks (
            id INTEGER PRIMARY KEY, from_date TEXT NOT NULL, to_date TEXT NOT NULL,
            reason TEXT NOT NULL, created_at TEXT NOT NULL,
            CHECK(to_date > from_date));
        CREATE TABLE IF NOT EXISTS conversion_events (
            id INTEGER PRIMARY KEY, event TEXT NOT NULL, property TEXT NOT NULL,
            locale TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pricing_settings (
            key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    ''')
    cx.execute('INSERT OR IGNORE INTO pricing_settings(key,value) VALUES (?,?)', ('mandatory_fee_xaf', 0))
    cx.execute('INSERT OR IGNORE INTO pricing_settings(key,value) VALUES (?,?)', ('verified_tax_xaf', 0))
    cx.execute('INSERT OR IGNORE INTO pricing_settings(key,value) VALUES (?,?)', ('tax_config_verified', 0))


def date_window(checkin, checkout, today=None):
    try:
        a, b = date.fromisoformat(checkin), date.fromisoformat(checkout)
    except (ValueError, TypeError):
        raise ValueError('Invalid check-in/check-out date format')
    if a < (today or date.today()):
        raise ValueError('Check-in date cannot be in the past')
    count = (b - a).days
    if count < 1 or count > MAX_NIGHTS:
        raise ValueError('Choose a stay of 1 to 180 nights')
    return a, b, count


def blocked(cx, checkin, checkout):
    return bool(cx.execute('SELECT 1 FROM inventory_blocks WHERE from_date<? AND to_date>? LIMIT 1',
                           (checkout, checkin)).fetchone())


def occupied(cx, checkin, checkout, excluded=None):
    q = '''SELECT 1 FROM bookings WHERE property='MIAGUE'
        AND status IN ('confirmed','checked_in') AND checkin<? AND checkout>?'''
    args = [checkout, checkin]
    if excluded is not None:
        q += ' AND id<>?'
        args.append(excluded)
    return bool(cx.execute(q+' LIMIT 1', args).fetchone())


def price_quote(cx, checkin, checkout, guests=1, property_id='miague', today=None):
    if property_id not in ('miague', 'miague-studio'):
        raise ValueError('Only Miague studio is bookable. Ebène/Amara accept expressions of interest.')
    a, _, n = date_window(checkin, checkout, today=today)
    try:
        count = int(guests)
    except (TypeError, ValueError):
        raise ValueError('Guests must be an integer')
    if not 1 <= count <= 6:
        raise ValueError('Demo form supports 1–6 guests; actual studio capacity requires property confirmation')
    overrides = {row[0]: row[1] for row in cx.execute('SELECT day,rate_xaf FROM rate_overrides WHERE day>=? AND day<?',
                                                       (checkin, checkout)).fetchall()}
    days = [{'date': (a + timedelta(days=i)).isoformat(),
             'rate_xaf': overrides.get((a + timedelta(days=i)).isoformat(), BASE_RATE_XAF)} for i in range(n)]
    subtotal = sum(item['rate_xaf'] for item in days)
    cfg = dict(cx.execute('SELECT key,value FROM pricing_settings').fetchall())
    mandatory_fee = cfg.get('mandatory_fee_xaf', 0)
    verified_tax = cfg.get('verified_tax_xaf', 0) if cfg.get('tax_config_verified', 0) else 0
    estimated = subtotal + mandatory_fee + verified_tax
    availability = not blocked(cx,checkin,checkout) and not occupied(cx,checkin,checkout)
    return {
        'property':'miague','currency':'XAF','checkin':checkin,'checkout':checkout,'guests':count,
        'nights':n, 'nightly_rates':days, 'subtotal_xaf':subtotal,
        'mandatory_fees_xaf':mandatory_fee, 'configured_tax_xaf':verified_tax,
        'tax_status':'verified_configuration' if cfg.get('tax_config_verified', 0) else 'NOT_CONFIGURED',
        'total_estimate_xaf':estimated,'available':availability,
        'quote_status':'INDICATIVE_DEMO_NOT_FINAL','final_total_confirmed':False,
        'inventory_source':'ISOLATED_DEMO_SQLITE_NOT_LIVE_PMS',
        'notice':'Final guest capacity, taxes, policies and pricing require property confirmation.'}
