import { db } from '../data/db.js';
import { noStore, denyUnlessLocalAuthorized, requireReadAuthorization, getPayload } from '../lib/policy.js';

export default function handler(req, res) {
  noStore(res);
  if (req.method === 'GET') {
    if (requireReadAuthorization(req,res)) return;
    const { module, status, step } = req.query || {};
    if (module && !db.modules.some(m => m.id === module)) return res.status(400).json({error:'Unknown module'});
    let records = db.getRecords(module);
    if (status) records = records.filter(r=>r.status===status);
    if (step!==undefined) records = records.filter(r=>r.step===Number(step));
    return res.status(200).json({mode:'LOCAL_DEMO',count:records.length,records});
  }
  if (req.method === 'POST') {
    if (denyUnlessLocalAuthorized(req,res)) return;
    try {
      const p=getPayload(req);
      const record=db.addRecord(p);
      return res.status(201).json({status:'created',mode:'LOCAL_DEMO',record});
    } catch(e) {
      return res.status(e.code==='EIO'||e.code==='EACCES'||e.code==='EROFS'?500:400).json({error:e.message});
    }
  }
  return res.status(405).json({error:'Method not allowed'});
}
