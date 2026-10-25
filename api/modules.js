import { db } from '../data/db.js';
import { noStore } from '../lib/policy.js';

export default function handler(req,res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const {id}=req.query||{};
  const modules=db.modules.map(({id,num,slug,nameFr,nameEn,framework,descFr,descEn,steps})=>({id,num,slug,nameFr,nameEn,framework,descFr,descEn,steps}));
  if (id) {
    const module=modules.find(m=>m.id===id);
    return module ? res.status(200).json({mode:'SAMPLE_CATALOG',module}) : res.status(404).json({error:'Unknown module'});
  }
  return res.status(200).json({mode:'SAMPLE_CATALOG',totalModules:modules.length,modules});
}
