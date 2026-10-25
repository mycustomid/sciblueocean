"""Pure opt-in sample contract, NOT a specific gateway integration.
Providers have different signature canonicalization; must adapt to official documentation.
Never use an unsigned browser redirect to mark a reservation paid.
"""
import hashlib
import hmac

class WebhookRejected(ValueError):pass

def verify_hmac_sha256(payload:bytes,signature:str,secret:bytes)->bool:
 """Sample HMAC-SHA256 verifier. Use ONLY if the chosen provider specifies this exact algorithm."""
 if not isinstance(payload,bytes) or not isinstance(secret,bytes) or len(secret)<16:raise WebhookRejected('Invalid webhook verifier configuration')
 if len(signature)!=64 or any(c not in '0123456789abcdefABCDEF' for c in signature):return False
 expected=hmac.new(secret,payload,hashlib.sha256).hexdigest()
 return hmac.compare_digest(signature.lower(),expected)

def parse_payment_lifecycle(event):
 """Deterministic provider-independent state mapping; never automatically settles funds."""
 permitted={'created','pending','success','failed','expired','refunded'}
 if not isinstance(event,dict) or event.get('status') not in permitted:raise WebhookRejected('Unknown provider state')
 if not event.get('provider_event_id') or not event.get('reference'):raise WebhookRejected('Missing deduplication/reference fields')
 return {'provider_event_id':str(event['provider_event_id']),'reference':str(event['reference']),'proposed_state':str(event['status']),'requires_server_reconciliation':True}
