"""State reconciliation for Flutterwave v3 provider testing and subsequent staging port.
Never trust the browser's query-string status or a webhook without checking provider API.
"""
from __future__ import annotations
import sqlite3
from flutterwave_hosted import HostedCheckout, CheckoutOrder, CheckoutError

class PaymentMismatch(ValueError):pass

def reconcile_verified(conn: sqlite3.Connection, transaction_id: str, secret_key: str, callback_url: str):
    """Verify with Flutterwave and idempotently mark matching intent paid.

    Must be invoked on server after validating signed provider webhook. Callback
    can also trigger re-verification, but its data is NEVER itself trusted.
    """
    if not str(transaction_id).isdigit() or len(str(transaction_id))>32:
        raise PaymentMismatch('Invalid transaction ID')
    adapter=HostedCheckout(secret_key)
    provider=adapter._transport('GET','/transactions/'+str(transaction_id)+'/verify')
    data=provider.get('data') if isinstance(provider,dict) else None
    if not isinstance(data,dict):raise PaymentMismatch('Provider verification unavailable')
    ref=data.get('tx_ref')
    if not isinstance(ref,str) or not ref.startswith('BO-PAY-'):raise PaymentMismatch('Unknown intent reference')
    row=conn.execute('''SELECT p.id,p.amount_xaf,p.currency,p.state,p.provider_transaction_id,p.external_reference,
      b.email,b.guest FROM payment_intents p JOIN bookings b ON b.id=p.booking_id
      WHERE p.external_reference=? AND b.property='MIAGUE' ''',(ref,)).fetchone()
    if row is None:raise PaymentMismatch('No matching intent')
    order=CheckoutOrder(row['external_reference'],row['amount_xaf'],row['email'],row['guest'],callback_url)
    if not adapter.verify(transaction_id,order):raise PaymentMismatch('Unverified amount/currency/status/reference')
    if row['state']=='paid':
        if str(row['provider_transaction_id'])!=str(transaction_id):raise PaymentMismatch('Already paid with another transaction')
        return {'state':'paid','already_processed':True,'reference':ref}
    if row['state']!='awaiting_payment':raise PaymentMismatch('Intent is not eligible')
    conn.execute("UPDATE payment_intents SET state='paid',provider_transaction_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='awaiting_payment'",(str(transaction_id),row['id']))
    return {'state':'paid','already_processed':False,'reference':ref}
