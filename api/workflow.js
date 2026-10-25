import { db } from '../data/db.js';
import { noStore, denyUnlessLocalAuthorized, getPayload } from '../lib/policy.js';

export default function handler(req,res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if (denyUnlessLocalAuthorized(req,res)) return;
  try {
    const p=getPayload(req);
    const targetStep=Number(p.targetStep);
    if (!p.recordId || !Number.isInteger(targetStep)) return res.status(400).json({error:'recordId and integer targetStep required'});
    // The local-demo key represents one superuser; a production workflow
    // must validate a distinct authenticated role, delegation and maker/checker policy.
    const record=db.advanceWorkflow(p.recordId,targetStep,'Authorized local demo operator',String(p.note||'Local test').slice(0,250));
    if (!record) return res.status(404).json({error:'Unknown record'});
    return res.status(200).json({status:'updated',mode:'LOCAL_DEMO',record});
  } catch(e) {
    return res.status(e.code==='EIO'||e.code==='EACCES'||e.code==='EROFS'?500:409).json({error:e.message});
  }
}
