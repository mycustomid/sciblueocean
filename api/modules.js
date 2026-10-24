import { db } from '../data/db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query || {};

  if (id) {
    const mod = db.getModule(id);
    if (!mod) {
      return res.status(404).json({ error: `Module '${id}' non trouvé.` });
    }
    return res.status(200).json({
      status: 'success',
      module: mod
    });
  }

  const modules = db.getModules();
  const stats = db.getStats();

  return res.status(200).json({
    status: 'success',
    totalModules: modules.length,
    stats,
    modules
  });
}
