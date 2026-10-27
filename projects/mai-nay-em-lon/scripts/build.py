#!/usr/bin/env python3
"""Build dist/ba-vong-tron.html from src/app.html and run the checks.

  python3 scripts/build.py          # build + checks
  python3 scripts/build.py --shots  # also render screenshots (needs Node + Playwright)

Checks: inline logo, `node --check` on the script, emoji uniqueness across dictionaries + reserved UI emoji.
"""
import pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'src/app.html').read_text(encoding='utf-8')
logo = (ROOT / 'assets/logo.b64').read_text().strip()
out = src.replace('__LOGO__', logo)
assert '__LOGO__' not in out
(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist/ba-vong-tron.html').write_text(out, encoding='utf-8')
(ROOT / 'index.html').write_text(out, encoding='utf-8')  # served by aiplayground at /projects/mai-nay-em-lon/

# 1. JS syntax
js = re.search(r'<script>(.*)</script>', out, re.S).group(1)
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write(js)
subprocess.run(['node', '--check', f.name], check=True)

# 2. Emoji uniqueness: every topic / help / job emoji is used once, and none collides with UI-reserved ones
ems = []
for d in ['T0', 'H0', 'J0']:
    body = re.search(d + r' = \{(.*?)\};', js, re.S).group(1)
    ems += [v.split(' ')[0] for v in re.findall(r"'([^']+)'", body)]
RESERVED = ['❤️', '⭐', '🤝', '🌿', '🌤️', '🖌️', '🎵', '🤸', '🎒', '💼', '🖍️']
allem = ems + RESERVED
dups = sorted({e for e in allem if allem.count(e) > 1})
assert not dups, f'duplicate emoji: {dups}'
print(f'OK: built dist/ba-vong-tron.html, {len(ems)} dictionary emoji, all unique')

if '--shots' in sys.argv:
    page = ROOT / 'dist/_preview.html'
    page.write_text('<!doctype html><meta charset="utf-8">' + out, encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'scripts/shot.js'), str(page), *[a for a in sys.argv[1:] if a.isdigit()]], check=True)
