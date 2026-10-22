"""Future Me: kid photo + profession -> adult-self portrait -> 5 s video. Runs fully local.

  python futureme.py make  --photo kids/an.jpg --name an --gender boy --job bac-si
  python futureme.py batch --csv kids.csv            # every kid x their jobs (blank = all 20)
  python futureme.py upload --url https://hdi.fly.dev --password ...   # optional, push out/ to the gallery

Step 1 (portrait): FLUX.2 klein 4B edit via mflux (MLX, Apache-2.0).
Step 2 (motion):  "parallax" = depth-based 2.5D camera move (seconds, always works)
                  "ai"       = LTX-2.3 int4 image-to-video via ltx-2-mlx (slow, overnight)
"""
import argparse, csv, json, os, subprocess, sys, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

HERE = Path(__file__).parent
JOBS = {j["id"]: j for j in json.loads((HERE / "professions.json").read_text(encoding="utf-8"))}
W, H, FPS, SECONDS = 576, 768, 24, 5  # 3:4 portrait; dims divisible by 64 for LTX-2
ADULT = {"boy": "man", "girl": "woman"}


def slug(name):
    """'Ngọc Linh' -> 'ngoc-linh' (file names and gallery tabs)."""
    import re, unicodedata
    s = unicodedata.normalize("NFKD", name.replace("đ", "d").replace("Đ", "D")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "be"


def prompt_for(job, gender, glasses, custom=None):
    who = ADULT[gender]
    scene = custom or JOBS[job]["scene"]
    keep = "glasses, " if glasses else ""
    return (f"Show this same {gender} grown up to about 28 years old, a Vietnamese {who} working as {scene}. "
            f"Keep the same face shape, eye shape, nose, smile, {keep}skin tone and hair color so they are clearly "
            f"recognizable as the same person, now an adult. Only one person in the photo. "
            f"Photorealistic photo, waist-up, looking at the camera, natural light, sharp focus.")


# Pre-quantized 4-bit builds from the mflux team: small downloads, fit a 16 GB Mac.
MODELS = {
    "4b": ("mflux-community/flux2-klein-4b-mflux-q4", "flux2_klein_4b"),  # 4.6 GB, Apache-2.0
    "9b": ("mflux-community/flux2-klein-9b-mflux-q4", "flux2_klein_9b"),  # 9.5 GB, non-commercial licence
}
_klein, _klein_key = None, None
def portrait(photo, job, gender, glasses, seed=7, model="4b", steps=4, custom=None, size=(W, H)):
    global _klein, _klein_key
    if _klein_key != model:
        from mflux.models.common.config import ModelConfig
        from mflux.models.flux2.variants import Flux2KleinEdit
        repo, cfg = MODELS[model]
        _klein = None
        _klein = Flux2KleinEdit(model_path=os.environ.get("KLEIN_PATH", repo), model_config=getattr(ModelConfig, cfg)())
        _klein_key = model
    img = _klein.generate_image(seed=seed, prompt=prompt_for(job, gender, glasses, custom),
                                image_paths=[str(photo)], num_inference_steps=steps,
                                width=size[0], height=size[1])
    return img.image


_depth = None
def depth_map(img):
    global _depth
    if _depth is None:
        from transformers import pipeline
        _depth = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
    d = np.asarray(_depth(img)["depth"].resize(img.size), dtype=np.float32)
    return (d - d.min()) / (np.ptp(d) + 1e-6)  # 1 = near


def parallax_frames(img, depth, n=FPS * SECONDS, shift=0.035, zoom=0.06):
    """Ken-Burns push-in + depth-weighted sway; near pixels move more than far ones."""
    import cv2
    src = np.asarray(img.convert("RGB"))
    h, w = depth.shape
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h * 0.4  # zoom towards the face area
    near = cv2.GaussianBlur(depth, (0, 0), 3)
    for i in range(n):
        t = i / (n - 1)
        ease = 0.5 - 0.5 * np.cos(np.pi * t)
        s = 1 + zoom * ease + 0.02 * near * ease          # foreground grows slightly faster
        dx = shift * w * np.sin(2 * np.pi * t) * (near - 0.5)
        dy = 0.4 * shift * h * np.sin(np.pi * t) * (near - 0.5)
        mx = cx + (xs - cx) / s - dx
        my = cy + (ys - cy) / s - dy
        yield cv2.remap(src, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def write_mp4(frames, path, fps=FPS):
    import imageio_ffmpeg
    w = imageio_ffmpeg.write_frames(str(path), (W, H), fps=fps, codec="libx264", quality=8,
                                    pix_fmt_out="yuv420p", output_params=["-movflags", "+faststart"],
                                    macro_block_size=16)
    w.send(None)
    for f in frames:
        w.send(np.ascontiguousarray(f))
    w.close()


def ai_video(image_path, job, out, seed=7, model="dgrauet/ltx-2.3-mlx-q4"):
    # ponytail: shells out to ltx-2-mlx (separate uv project); swap for its Python API if we ever need in-process.
    motion = JOBS[job]["motion"] if job in JOBS else "smiles and looks around, slow camera push-in"
    cmd = [os.environ.get("LTX_BIN", "ltx-2-mlx"), "generate", "--distilled", "--model", model,
           "-p", f"A photorealistic video of this adult. {motion}. Natural, smooth motion, the face stays the same.",
           "-i", str(image_path), "-o", str(out), "-H", str(H), "-W", str(W), "-f", str(FPS * SECONDS + 1),
           "-s", str(seed), "--low-ram"]
    subprocess.run(cmd, check=True)


def free_portrait_model():
    """16 GB Mac: klein (~8 GB at q8) and LTX-2 int4 (~12 GB) must not be resident together."""
    global _klein, _klein_key
    _klein, _klein_key = None, None
    import gc; gc.collect()
    import mlx.core as mx; mx.clear_cache()


def make(photo, name, gender, job, glasses=False, motion="parallax", out_dir="out", seed=7, custom=None,
         stages=("portrait", "video"), model="4b"):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    name = slug(name)
    stem = out / f"{name}__{job}"
    jpg, mp4 = stem.with_suffix(".jpg"), stem.with_suffix(".mp4")
    child = out / f"{name}__child.jpg"  # "now" photo shown next to the futures in the gallery
    if not child.exists():
        ImageOps.fit(ImageOps.exif_transpose(Image.open(photo)).convert("RGB"), (384, 384)).save(child, quality=88)
    # resumable: existing files are kept, so rerun after a crash/sleep
    if "portrait" in stages and not jpg.exists():
        portrait(photo, job, gender, glasses, seed=seed, model=model, custom=custom).save(jpg, quality=92)
        print("portrait", jpg, flush=True)
    if "video" not in stages or mp4.exists():
        return mp4
    if motion == "ai":
        ai_video(jpg, job, mp4, seed)
    else:
        img = Image.open(jpg).convert("RGB").resize((W, H))
        write_mp4(parallax_frames(img, depth_map(img)), mp4)
    print("done", mp4)
    return mp4


def upload(out_dir, url, password):
    for f in sorted(Path(out_dir).glob("*__*.*")):
        if f.suffix not in (".mp4", ".jpg"):
            continue
        req = urllib.request.Request(f"{url.rstrip('/')}/api/future-me/upload?name={f.name}", data=f.read_bytes(),
                                     method="POST", headers={"x-password": password, "content-type": "application/octet-stream"})
        print(urllib.request.urlopen(req).read().decode(), f.name)


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("make"); m.add_argument("--photo", required=True); m.add_argument("--name", required=True)
    m.add_argument("--gender", choices=ADULT, required=True); m.add_argument("--job", required=True)
    m.add_argument("--glasses", action="store_true")
    b = sub.add_parser("batch"); b.add_argument("--csv", required=True)
    for s in (m, b):
        s.add_argument("--motion", choices=["parallax", "ai", "none"], default="parallax",
                       help="none = portraits only (fastest way to judge likeness)")
        s.add_argument("--out", default="out"); s.add_argument("--seed", type=int, default=7)
        s.add_argument("--model", choices=["4b", "9b"], default="4b")
    u = sub.add_parser("upload"); u.add_argument("--out", default="out")
    u.add_argument("--url", required=True); u.add_argument("--password", required=True)
    a = p.parse_args()
    if a.cmd == "make":
        make(a.photo, a.name, a.gender, a.job, a.glasses, a.motion, a.out, a.seed,
             stages=("portrait",) if a.motion == "none" else ("portrait", "video"), model=a.model)
    elif a.cmd == "batch":
        rows = list(csv.DictReader(open(a.csv, encoding="utf-8")))
        base = Path(a.csv).parent
        # kids.csv: photo,name,gender,glasses,jobs  (jobs: "bac-si ca-si" or blank = all 20)
        todo = [(base / r["photo"], r["name"], r["gender"], job, r.get("glasses", "").lower() in ("1", "yes", "true"))
                for r in rows for job in ((r.get("jobs") or "").split() or JOBS)]
        for stage in ("portrait",) if a.motion == "none" else ("portrait", "video"):
            for photo, name, gender, job, glasses in todo:
                make(photo, name, gender, job, glasses, a.motion, a.out, a.seed, stages=(stage,), model=a.model)
            free_portrait_model()
    else:
        upload(a.out, a.url, a.password)


if __name__ == "__main__":
    sys.exit(main())
