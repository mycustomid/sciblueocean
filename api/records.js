import { db } from '../data/db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { module, status, step } = req.query || {};
    let records = db.getRecords(module);

    if (status) {
      records = records.filter(r => r.status === status);
    }
    if (step) {
      records = records.filter(r => r.step === Number(step));
    }

    return res.status(200).json({
      status: 'success',
      count: records.length,
      records
    });
  }

  if (req.method === 'POST') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!payload || !payload.moduleId || !payload.desc) {
        return res.status(400).json({
          error: 'Champs obligatoires manquants: moduleId et desc sont requis.'
        });
      }

      const newRec = db.addRecord(payload);
      return res.status(201).json({
        status: 'created',
        message: `Transaction ${newRec.id} enregistrée avec succès dans le module ${newRec.moduleId}.`,
        record: newRec
      });
    } catch (err) {
      return res.status(400).json({
        error: 'Payload JSON invalide: ' + err.message
      });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée.' });
}
