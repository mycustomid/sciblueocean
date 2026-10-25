// RC5: API transport policy. NOT a production identity provider.
// An explicitly enabled local-demo server may be mutated by its operator.
// Vercel and every unset/default environment are read-only.
import crypto from 'node:crypto';

export const localWritesEnabled = () => process.env.ERP_MODE === 'local-demo'
  && process.env.ERP_ENABLE_LOCAL_WRITES === '1'
  && !process.env.VERCEL
  && Boolean(process.env.ERP_ADMIN_TOKEN && process.env.ERP_ADMIN_TOKEN.length >= 24);

export function hasOperatorToken(req) {
  const raw = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer (.+)$/i.exec(raw);
  const actual = match?.[1] || '';
  const expected = process.env.ERP_ADMIN_TOKEN || '';
  if (!expected || !actual) return false;
  const a = crypto.createHash('sha256').update(actual).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

export function denyUnlessLocalAuthorized(req, res) {
  if (!localWritesEnabled()) {
    res.status(503).json({ error: 'Server writes disabled. Use client-side demonstration mode; production needs durable DB and identity.', mode: 'DEMO_READ_ONLY' });
    return true;
  }
  if (!hasOperatorToken(req)) {
    res.status(401).json({ error: 'Valid local-demo operator token required.' });
    return true;
  }
  return false;
}

export function requireReadAuthorization(req, res) {
  if (!localWritesEnabled() || !hasOperatorToken(req)) {
    res.status(403).json({ error: 'Record inspection is disabled on the public demo API.' });
    return true;
  }
  return false;
}

export function getPayload(req) {
  if (typeof req.body === 'string') {
    if (req.body.length > 16384) throw new RangeError('Payload exceeds 16 KB');
    return JSON.parse(req.body);
  }
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Expected JSON object');
  if (JSON.stringify(payload).length > 16384) throw new RangeError('Payload exceeds 16 KB');
  return payload;
}
