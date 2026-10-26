"""Cameroon XAF charge adapter (non-executing until integrated by a secure backend).

Official docs reviewed 2026-10-26:
https://developer.flutterwave.com/docs/francophone
https://developer.flutterwave.com/docs/webhooks
https://developer.flutterwave.com/reference/charge-via-francophone-mobile-money

Never expose FLW_SECRET_KEY to Astro/static frontend. A signed event is a notification,
not proof of payment: verify the transaction server-to-server before recording 'paid'.
"""
from __future__ import annotations
import hmac
import json
import os
from dataclasses import dataclass
from typing import Callable
from urllib.request import Request, urlopen

BASE_URL = 'https://api.flutterwave.com/v3'
NETWORKS = frozenset({'MTN','ORANGEMONEY'})

class PaymentGatewayError(RuntimeError): pass

@dataclass(frozen=True)
class Charge:
    reference: str
    amount_xaf: int
    email: str
    phone: str
    network: str


def validate_charge(charge: Charge) -> None:
    if not isinstance(charge.amount_xaf, int) or not 100 <= charge.amount_xaf <= 10_000_000:
        raise ValueError('Amount is invalid or outside configured transaction limits')
    if charge.network not in NETWORKS: raise ValueError('Only MTN and ORANGEMONEY are supported in Cameroon')
    if not charge.reference.startswith('BO-PAY-') or len(charge.reference)>80:raise ValueError('Invalid intent reference')
    if '@' not in charge.email or len(charge.email)>160:raise ValueError('Invalid customer email')
    if not charge.phone.startswith('237') or not charge.phone.isdigit() or len(charge.phone) != 12:raise ValueError('Phone must have 237 international country code')


class FlutterwaveXAF:
    def __init__(self,secret_key: str | None = None, webhook_secret: str | None = None,
                 transport: Callable | None = None):
        self.secret_key=secret_key or os.getenv('FLW_SECRET_KEY','')
        self.webhook_secret=webhook_secret or os.getenv('FLW_WEBHOOK_SECRET','')
        self.transport=transport or self._transport
        if not self.secret_key:raise PaymentGatewayError('FLW_SECRET_KEY not configured')
    def _transport(self,method: str,path: str,payload: dict | None = None) -> dict:
        req=Request(BASE_URL+path,method=method,headers={
            'Authorization':'Bearer '+self.secret_key,
            'Content-Type':'application/json','Accept':'application/json'},
            data=json.dumps(payload).encode() if payload is not None else None)
        try:
            with urlopen(req,timeout=12) as response:
                if response.status not in (200,201):raise PaymentGatewayError(f'Gateway HTTP {response.status}')
                return json.loads(response.read(128000))
        except Exception as exc:raise PaymentGatewayError('Gateway unavailable or invalid response') from exc
    def create_mobile_money_charge(self,charge: Charge) -> dict:
        validate_charge(charge)
        payload={'amount':charge.amount_xaf,'currency':'XAF','country':'CM','network':charge.network,
                 'phone_number':charge.phone,'email':charge.email,'tx_ref':charge.reference}
        response=self.transport('POST','/charges?type=mobile_money_franco',payload)
        if not isinstance(response,dict) or response.get('status')!='success':
            raise PaymentGatewayError('Gateway did not accept charge')
        return {'provider':'flutterwave','currency':'XAF','reference':charge.reference,
                'gateway_response':response.get('data') or {},'state':'PENDING'}
    def verify_paid(self,transaction_id: str | int, expected_reference: str, expected_amount: int) -> dict:
        txid=str(transaction_id)
        if not txid.isdecimal():raise ValueError('Invalid provider transaction ID')
        response=self.transport('GET','/transactions/'+txid+'/verify')
        data=response.get('data') or {}
        # exact verification is essential; insufficient/mismatched currency or ref always fails closed.
        if str(data.get('status','')).lower() not in ('successful','success'):
            raise PaymentGatewayError('Transaction is not paid')
        if data.get('tx_ref')!=expected_reference or data.get('currency')!='XAF':
            raise PaymentGatewayError('Reference/currency mismatch')
        if int(data.get('amount') or 0)!=expected_amount:
            raise PaymentGatewayError('Paid amount mismatch')
        return {'provider_transaction_id':txid,'state':'PAID_VERIFIED','reference':expected_reference,'amount_xaf':expected_amount}
    def validate_webhook(self,headers: dict) -> bool:
        if not self.webhook_secret:return False
        supplied=next((v for k,v in headers.items() if k.lower()=='verif-hash'),'')
        return bool(supplied) and hmac.compare_digest(str(supplied),self.webhook_secret)
