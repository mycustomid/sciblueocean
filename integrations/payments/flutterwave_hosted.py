"""Flutterwave v3 hosted checkout adapter for a backend that owns verified reservations.

This module makes real HTTP requests ONLY when called by an authenticated,
server-side payment service. Do not use from static Astro pages, a public
booking-reference-only endpoint, or the loopback demo without strict test gating.

API contract: https://developer.flutterwave.com/v3.0/docs/flutterwave-standard-1
Webhook v3: https://developer.flutterwave.com/v3.0.0/docs/webhooks
"""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import hmac
import json
from urllib.request import Request, urlopen
from urllib.parse import urlparse

FLW_API = 'https://api.flutterwave.com/v3'

class CheckoutError(Exception): pass

@dataclass(frozen=True)
class CheckoutOrder:
    reference: str
    amount_xaf: int
    customer_email: str
    customer_name: str
    callback_url: str


def validate(order: CheckoutOrder) -> None:
    if not isinstance(order.amount_xaf,int) or isinstance(order.amount_xaf,bool) or not 100<=order.amount_xaf<=100000000:
        raise CheckoutError('Amount must be a positive XAF integer from server-side confirmed booking')
    if not order.reference.startswith('BO-PAY-') or len(order.reference)>96:
        raise CheckoutError('Expected generated payment intent reference')
    if not order.customer_email or '@' not in order.customer_email or len(order.customer_email)>160:
        raise CheckoutError('Customer email required')
    u=urlparse(order.callback_url)
    if u.scheme!='https' or not u.netloc or u.username or u.password:
        raise CheckoutError('HTTPS callback URL is required')


def transaction_matches(verified:dict, order:CheckoutOrder) -> bool:
    """Never infer payment from redirect URL or webhook payload."""
    data=verified.get('data') if isinstance(verified,dict) else None
    if not isinstance(data,dict):return False
    try:amount=float(data.get('amount'))
    except (TypeError,ValueError):return False
    return (data.get('status') in ('successful','success') and
            data.get('tx_ref')==order.reference and
            data.get('currency')=='XAF' and
            amount==order.amount_xaf)


def verify_webhook_hash_v3(header_value:str, configured_secret:str) -> bool:
    """Flutterwave v3 webhook uses exact verif-hash; v4 has DIFFERENT HMAC contract."""
    return bool(header_value and configured_secret) and hmac.compare_digest(header_value,configured_secret)

class HostedCheckout:
    def __init__(self,secret_key:str,transport=None):
        if not secret_key or '\n' in secret_key:raise CheckoutError('Secret key missing/invalid')
        self._key=secret_key
        self._transport=transport or self._request
    def _request(self,method,path,payload=None):
        req=Request(FLW_API+path,method=method,headers={'Authorization':'Bearer '+self._key,'Content-Type':'application/json','Accept':'application/json'},data=json.dumps(payload).encode('utf8') if payload else None)
        try:
            with urlopen(req,timeout=15) as resp:
                if resp.status not in (200,201):raise CheckoutError('Gateway request unsuccessful')
                return json.loads(resp.read(100000))
        except CheckoutError:raise
        except Exception as e:raise CheckoutError('Provider API unavailable') from e
    def create(self,order:CheckoutOrder)->str:
        validate(order)
        payload={'tx_ref':order.reference,'amount':str(order.amount_xaf),'currency':'XAF','redirect_url':order.callback_url,
            'customer':{'email':order.customer_email,'name':order.customer_name},
            'customizations':{'title':'SCI Blue Ocean · Direct Booking','description':'Confirmed accommodation booking in Douala'},
            'meta':{'source':'sci-blue-ocean'}}
        response=self._transport('POST','/payments',payload)
        link=response.get('data',{}).get('link') if isinstance(response,dict) else None
        if response.get('status')!='success' or not isinstance(link,str):raise CheckoutError('No checkout link returned')
        parsed=urlparse(link)
        if parsed.scheme!='https' or not (parsed.hostname=='checkout.flutterwave.com' or (parsed.hostname or '').endswith('.flutterwave.com')):
            raise CheckoutError('Provider returned an untrusted checkout URL')
        return link
    def verify(self,transaction_id:int|str,order:CheckoutOrder)->bool:
        validate(order)
        tx=str(transaction_id)
        if not tx.isdecimal() or len(tx)>32:raise CheckoutError('Invalid transaction ID')
        return transaction_matches(self._transport('GET','/transactions/'+tx+'/verify'),order)


def deterministic_event_key(event:dict)->str:
    """Dedup on provider event / reference / state before posting ledger entries."""
    data=event.get('data') or {}
    parts=[str(event.get('event','')),str(data.get('id','')),str(data.get('status',''))]
    return hashlib.sha256('|'.join(parts).encode()).hexdigest()
