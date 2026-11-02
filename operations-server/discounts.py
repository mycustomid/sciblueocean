"""Atomic reservation discounts based on the original accommodation subtotal."""


def migrate(cx):
    cx.execute('''CREATE TABLE IF NOT EXISTS booking_discount_audit (
        id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES bookings(id),
        actor TEXT NOT NULL, previous_percent INTEGER NOT NULL, new_percent INTEGER NOT NULL,
        previous_amount_xaf INTEGER NOT NULL, new_amount_xaf INTEGER NOT NULL,
        original_estimate_xaf INTEGER NOT NULL, created_at TEXT NOT NULL)''')


def apply(cx, booking_id, percent, actor, now):
    if isinstance(booking_id, bool) or not isinstance(booking_id, int) or booking_id < 1:
        raise ValueError('Invalid booking')
    if isinstance(percent, bool) or not isinstance(percent, int) or percent not in (0, *range(5, 21)):
        raise ValueError('La remise doit être 0 ou comprise entre 5 et 20 pour cent.')
    row = cx.execute('''SELECT id,reference,status,estimate_xaf,subtotal_xaf,
            original_estimate_xaf,discount_percent,discount_xaf
        FROM bookings WHERE id=? AND property='MIAGUE' ''', (booking_id,)).fetchone()
    if not row:
        raise LookupError('Réservation introuvable.')
    item = dict(row)
    if item['status'] not in ('pending','confirmed','checked_in'):
        raise RuntimeError('La remise ne peut pas modifier une réservation annulée ou terminée.')
    if cx.execute('SELECT 1 FROM payment_intents WHERE booking_id=? LIMIT 1', (booking_id,)).fetchone():
        raise RuntimeError('Une intention de paiement existe déjà : la remise ne peut pas être modifiée.')
    subtotal = item['subtotal_xaf']
    if subtotal is None:
        raise RuntimeError('Sous-total hébergement historique indisponible ; remise impossible.')
    if not isinstance(subtotal, int) or subtotal < 0:
        raise RuntimeError('Sous-total hébergement invalide.')
    old_pct, old_discount = item['discount_percent'], item['discount_xaf']
    original = item['original_estimate_xaf']
    current = item['estimate_xaf']
    if original is None:
        if old_pct != 0 or old_discount != 0:
            raise RuntimeError('Données de remise incohérentes.')
        original = current
    if (not isinstance(original,int) or original < subtotal or
            old_pct not in (0,*range(5,21)) or old_discount != (subtotal*old_pct+50)//100 or
            current != original-old_discount):
        raise RuntimeError('Montant ou remise enregistrée incohérents.')
    new_discount = (subtotal * percent + 50) // 100
    new_total = original - new_discount
    if percent == old_pct:
        return {'id':booking_id, 'reference':item['reference'], 'discount_percent':percent,
                'discount_xaf':new_discount,'estimate_xaf':new_total}
    cx.execute('''UPDATE bookings SET original_estimate_xaf=?, discount_percent=?, discount_xaf=?, estimate_xaf=?, updated_at=? WHERE id=?''',
               (original,percent,new_discount,new_total,now,booking_id))
    cx.execute('''INSERT INTO booking_discount_audit(booking_id,actor,previous_percent,new_percent,previous_amount_xaf,new_amount_xaf,original_estimate_xaf,created_at)
                  VALUES(?,?,?,?,?,?,?,?)''',(booking_id,actor,old_pct,percent,old_discount,new_discount,original,now))
    cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES(?,?,?,?,?)',
               (actor,'booking:discount','booking',item['reference'],now))
    return {'id':booking_id,'reference':item['reference'],'discount_percent':percent,
            'discount_xaf':new_discount,'estimate_xaf':new_total}
