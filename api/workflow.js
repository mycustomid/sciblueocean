import { db } from '../data/db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { recordId, targetStep, operatorName, note } = payload || {};

    if (!recordId || targetStep === undefined) {
      return res.status(400).json({ error: 'recordId et targetStep (1-4) sont requis.' });
    }

    const updated = db.advanceWorkflow(recordId, targetStep, operatorName, note);
    if (!updated) {
      return res.status(404).json({ error: `Dossier '${recordId}' non trouvé dans la base.` });
    }

    return res.status(200).json({
      status: 'success',
      message: `Dossier ${recordId} promu à l'Étape ${updated.step} (${updated.status}).`,
      record: updated
    });
  } catch (err) {
    return res.status(400).json({ error: 'Erreur de traitement: ' + err.message });
  }
}
