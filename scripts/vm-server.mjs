#!/usr/bin/env node
// Tiny static server for the VM-hosted scores cache. Serves /home/nabil/wc2026-data
// on 127.0.0.1:3002, exposed publicly as wc-scores.genomicx.org by its own
// cloudflared tunnel. CORS-open + short cache so the Vercel /api/scores (and, if
// ever wanted, the browser directly) can read it.
import http from 'http';
import fs from 'fs';
import path from 'path';

const DATA_DIR = '/home/nabil/wc2026-data';
const PORT = 3002;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=10');
  const name = (req.url || '').split('?')[0].replace(/^\//, '') || 'scores.json';
  if (!/^[a-z0-9._-]+$/i.test(name) || name.includes('..')) {
    res.writeHead(400); return res.end('bad request');
  }
  fs.readFile(path.join(DATA_DIR, name), (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not found"}'); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('wc-scores static server on 127.0.0.1:' + PORT));
