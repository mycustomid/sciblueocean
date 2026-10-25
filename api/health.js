import { noStore, localWritesEnabled } from '../lib/policy.js';
export default function handler(req,res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({
    status: 'HEALTHY',
    service: 'Blue Line ERP — demonstration API',
    version: 'RC5',
    mode: localWritesEnabled() ? 'LOCAL_DEMO_WRITABLE' : 'DEMO_READ_ONLY',
    persistence: localWritesEnabled() ? 'LOCAL_FILESYSTEM_NONCONCURRENT' : 'NO_SERVER_WRITES',
    productionReady: false,
    modules: 9,
    timestamp: new Date().toISOString()
  });
}
