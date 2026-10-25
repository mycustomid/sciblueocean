// BLUE LINE CAPITAL GROUP — High-Performance Native Node.js Backend Server (ESM)
// Serves static frontend (dist/) & demo REST API (/api/*) with Zero Dependencies

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';

import healthHandler from './api/health.js';
import modulesHandler from './api/modules.js';
import recordsHandler from './api/records.js';
import workflowHandler from './api/workflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); if (body.length > 16384) { reject(new Error('Payload too large')); req.destroy(); } });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

function adaptVercelHandler(handler) {
  return async (req, res, parsedUrl) => {
    req.query = parsedUrl.query;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try { req.body = await parseBody(req); } catch { res.statusCode = 413; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({error:'Payload too large or invalid'})); return; }
    }
    res.status = code => {
      res.statusCode = code;
      return res;
    };
    res.json = data => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data, null, 2));
    };
    return handler(req, res);
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');

  // 1. API Endpoints
  if (pathname === '/api/health' || pathname === '/api/health/') {
    return adaptVercelHandler(healthHandler)(req, res, parsedUrl);
  }
  if (pathname === '/api/modules' || pathname === '/api/modules/') {
    return adaptVercelHandler(modulesHandler)(req, res, parsedUrl);
  }
  if (pathname === '/api/records' || pathname === '/api/records/') {
    return adaptVercelHandler(recordsHandler)(req, res, parsedUrl);
  }
  if (pathname === '/api/workflow' || pathname === '/api/workflow/') {
    return adaptVercelHandler(workflowHandler)(req, res, parsedUrl);
  }

  // Unknown API routes never fall through to HTML.
  if (pathname.startsWith('/api/')) {res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unknown API route'}));return;}
  // 2. Static assets: explicit containment against path traversal.
  let relative;
  try { relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname); }
  catch {res.writeHead(400);res.end('Invalid URL');return;}
  if (relative.includes('\0') || relative.split(/[\\/]/).includes('..')) {res.writeHead(403);res.end('Forbidden');return;}
  relative = relative.replace(/^\/+/, '');
  const candidate = root => {
    const abs=path.resolve(root, relative);
    return abs.startsWith(root + path.sep) ? abs : null;
  };
  let targetFile = candidate(DIST_DIR);
  if (!targetFile || !fs.existsSync(targetFile)) targetFile = candidate(PUBLIC_DIR);
  if (!targetFile) {res.writeHead(403);res.end('Forbidden');return;}
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
    targetFile = path.join(targetFile, 'index.html');
  }

  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    return fs.createReadStream(targetFile).pipe(res);
  }

  // Fallback to SPA index.html only for client-side routes (no file extension)
  const reqExt = path.extname(relative);
  if (!reqExt || reqExt === '.html') {
    const fallback = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(fallback).pipe(res);
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
});

server.listen(PORT, HOST, () => {
  console.log(`[BLUE LINE BACKEND] Running on http://${HOST}:${PORT}`);
  console.log(`[BLUE LINE BACKEND] API routes active: /api/health, /api/modules, /api/records, /api/workflow`);
});
