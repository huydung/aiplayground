// Render screenshots of given step indexes and report page errors + the step map.
// node scripts/shot.js dist/_preview.html 0 20 33 67   → docs/screenshots/sNN.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [file, ...steps] = process.argv.slice(2);
  const out = path.join(__dirname, '..', 'docs', 'screenshots');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.resolve(file));
  await p.waitForTimeout(1500);
  console.log('steps', await p.evaluate(() => STEPS.length));
  for (const i of steps.map(Number)) {
    await p.evaluate(i => go(i), i);
    await p.waitForTimeout(1400); // circle tween is 1100ms
    await p.screenshot({ path: path.join(out, `s${String(i).padStart(2, '0')}.png`) });
  }
  console.log(await p.evaluate(() => STEPS.map((s, i) => `${i}:${s.kind}:${s.id || s.ch}`).join('\n')));
  console.log('errors', errs);
  await b.close();
  if (errs.length) process.exit(1);
})();
