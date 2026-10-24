import { db } from '../data/db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const stats = db.getStats();
  return res.status(200).json({
    status: 'HEALTHY',
    service: 'Blue Line Capital Group — 9-Product ERP Backend Engine',
    version: '3.0.0-PROD',
    database: {
      driver: 'Persistent Atomic JSON Store',
      status: 'ONLINE',
      totalRecords: stats.totalRecords
    },
    stats,
    timestamp: new Date().toISOString()
  });
}
