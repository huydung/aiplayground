"""Fast check of the batch flow with the heavy models stubbed out:  python test_futureme.py"""
import subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from PIL import Image

import futureme as fm

calls = []
fm.portrait = lambda photo, job, gender, glasses, **k: calls.append(job) or Image.new("RGB", (fm.W, fm.H), "orange")
fm.depth_map = lambda img: np.tile(np.linspace(0, 1, fm.W, dtype=np.float32), (fm.H, 1))

with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    Image.new("RGB", (400, 300), "blue").save(d / "kid.jpg")
    (d / "kids.csv").write_text("photo,name,gender,glasses,jobs\nkid.jpg,an,boy,yes,bac-si ca-si\n")
    sys.argv = ["futureme.py", "batch", "--csv", str(d / "kids.csv"), "--out", str(d / "out")]
    fm.main()
    names = sorted(p.name for p in (d / "out").iterdir())
    assert names == ["an__bac-si.jpg", "an__bac-si.mp4", "an__ca-si.jpg", "an__ca-si.mp4", "an__child.jpg"], names
    import imageio_ffmpeg
    frames, secs = imageio_ffmpeg.count_frames_and_secs(str(d / "out/an__bac-si.mp4"))
    assert (frames, round(secs)) == (fm.FPS * fm.SECONDS, fm.SECONDS), (frames, secs)
    fm.main()  # rerun must resume, not regenerate
    assert calls == ["bac-si", "ca-si"], calls
    assert "glasses" in fm.prompt_for("bac-si", "boy", True) and "woman" in fm.prompt_for("ca-si", "girl", False)
print("ok")
