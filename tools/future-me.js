// Future Me gallery: password-gated videos of kids' adult selves.
// Files live on the Fly volume (DATA_DIR/future-me), never in git. Set the password with:
//   fly secrets set FUTURE_ME_PASSWORD=... --app hdi
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'future-me');
const NAME = /^[a-z0-9-]+__[a-z0-9-]+\.(mp4|jpg)$/;

const secret = () => process.env.FUTURE_ME_PASSWORD || '';
const token = () => crypto.createHmac('sha256', secret()).update('future-me').digest('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookie = req => ((req.headers.cookie || '').match(/(?:^|;\s*)fm=([a-f0-9]+)/) || [])[1] || '';

function gate(req, res, next) {
  if (!secret()) return res.status(503).json({ error: 'FUTURE_ME_PASSWORD not set on the server' });
  const pw = req.get('x-password');
  if ((pw && same(pw, secret())) || same(cookie(req), token())) return next();
  res.status(401).json({ error: 'password required' });
}

router.post('/login', (req, res) => {
  if (!secret()) return res.status(503).json({ error: 'FUTURE_ME_PASSWORD not set on the server' });
  if (!same(String(req.body?.password || ''), secret())) return res.status(401).json({ error: 'wrong password' });
  res.cookie('fm', token(), { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 30 * 864e5, path: '/api/future-me' });
  res.json({ ok: true });
});

router.post('/upload', gate, express.raw({ type: () => true, limit: '80mb' }), (req, res) => {
  const name = String(req.query.name || '');
  if (!NAME.test(name)) return res.status(400).json({ error: 'name must look like kid__job.mp4 or kid__job.jpg' });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, name), req.body);
  res.json({ ok: true, name, bytes: req.body.length });
});

router.get('/list', gate, (req, res) => {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => NAME.test(f)) : [];
  const items = files.filter(f => f.endsWith('.mp4')).map(f => {
    const [kid, job] = f.slice(0, -4).split('__');
    const poster = `${kid}__${job}.jpg`;
    return { kid, job, video: `file/${f}`, poster: files.includes(poster) ? `file/${poster}` : null };
  });
  res.json(items);
});

router.get('/file/:name', gate, (req, res) => {
  if (!NAME.test(req.params.name)) return res.status(400).end();
  res.sendFile(path.join(DIR, req.params.name), { headers: { 'Cache-Control': 'private, max-age=3600' } }, err => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

module.exports = router;
