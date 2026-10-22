# Future Me · Ước mơ của em

Kid photo + dream job → a photo of their adult self in that job → a 5-second video. Everything runs on the Mac; no photo leaves the machine unless you run `upload`.

| Step | Model | Licence | Notes |
|---|---|---|---|
| Adult portrait | FLUX.2 klein 4B (reference edit) via [mflux](https://github.com/mflux-community/mflux), pre-quantized 4-bit | Apache-2.0 | 4.6 GB download once |
| Adult portrait, `--model 9b` | FLUX.2 klein 9B, pre-quantized 4-bit | non-commercial | 9.5 GB; usually more realistic, slower |
| Motion, `parallax` (default) | Depth Anything V2 Small + 2.5D camera move | Apache-2.0 | seconds per clip, always works |
| Motion, `ai` (optional) | LTX-2.3 int4 via [ltx-2-mlx](https://github.com/dgrauet/ltx-2-mlx) | see model card | ~12 GB; listed for 16 GB Macs; slow, run overnight |

## Setup (MacBook Air M4, 16 GB)

```sh
brew install uv
cd local-apps/future-me
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements.txt
python test_futureme.py           # 10-second check of the plumbing, prints "ok"
```

## One kid, one job

```sh
python futureme.py make --photo kids/an.jpg --name "An" --gender boy --glasses --job bac-si
# -> out/an__bac-si.jpg (portrait) and out/an__bac-si.mp4 (5 s video)
```
The first run downloads the model. Time this first clip: it tells you how long the batch will take.

Portraits only (fastest way to judge realism and likeness) and a 4B vs 9B comparison:

```sh
python futureme.py batch --csv kids/kids.csv --motion none --model 4b --out out-4b
python futureme.py batch --csv kids/kids.csv --motion none --model 9b --out out-9b
```
Low on disk? Put the model cache on an external drive first: `export HF_HOME=/Volumes/<drive>/hf`.

Or the classroom UI (webcam or upload, dropdown of the 20 jobs, "other" free text, download button):

```sh
python app.py     # opens http://127.0.0.1:7860
```

## Batch: every kid × every job, overnight

Put photos in `kids/` (git-ignored) and copy `kids.example.csv` to `kids/kids.csv`. Leave `jobs` blank for all 20, or list ids (`bac-si phi-hanh-gia`; ids are in `professions.json`).

```sh
caffeinate -i python futureme.py batch --csv kids/kids.csv
```
It makes all portraits first, unloads that model, then all videos, so the two models never share the 16 GB. It is resumable: rerun after a crash or a sleep and it skips finished files. To redo one result, delete its `.jpg`/`.mp4` in `out/`. Try `--seed 8` for a different take.

## AI video mode (optional)

```sh
git clone https://github.com/dgrauet/ltx-2-mlx ~/ltx-2-mlx && (cd ~/ltx-2-mlx && uv sync --all-extras)
export LTX_BIN=~/ltx-2-mlx/.venv/bin/ltx-2-mlx
python futureme.py make --photo kids/an.jpg --name "An" --gender boy --job phi-cong --motion ai
```
This was not runnable in the cloud test environment (no Apple GPU), so try one clip before an overnight batch. If it runs out of memory, close other apps; if it is still too slow, stay with `parallax`.

## Publish to the password-protected gallery

Once, on any machine with flyctl: `fly secrets set FUTURE_ME_PASSWORD='choose-one' --app hdi`

```sh
python futureme.py upload --url https://hdi.fly.dev --password 'choose-one'
```
Videos and photos go to the Fly volume, not git. Gallery: `https://hdi.fly.dev/projects/future-me/`.

## Tuning

- The prompt is in `prompt_for()`; jobs, scenes and AI-video motions are in `projects/future-me/professions.json` (shared with the gallery).
- Likeness vs. "grown-up" look: the prompt asks for about 28 years old. Use a front-facing, well-lit photo with the face filling about a third of the frame.
- Consent: parents' written consent, and ask each child too (Vietnam's PDP Law, in force since 1 Jan 2026). Delete `kids/` and `out/` after the session.
