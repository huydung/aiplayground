"""Classroom UI: photo + profession -> adult-self video. Opens http://127.0.0.1:7860 (local only)."""
from pathlib import Path

import gradio as gr

import futureme as fm

CHOICES = [(f"{j['vi']} · {j['en']}", j["id"]) for j in fm.JOBS.values()] + [("Nghề khác (tự gõ) · Other", "khac")]


def run(photo, name, gender, glasses, job, custom, motion, seed):
    if not photo:
        raise gr.Error("Chọn ảnh của bé trước · Add a photo first")
    if job == "khac" and not custom.strip():
        raise gr.Error("Gõ mô tả nghề · Describe the job")
    slug = "".join(c if c.isascii() and c.isalnum() else "-" for c in (name or "be").lower()).strip("-") or "be"
    for ext in (".jpg", ".mp4"):  # the UI always regenerates (batch mode is the one that resumes)
        Path("out", f"{slug}__{job}{ext}").unlink(missing_ok=True)
    mp4 = fm.make(photo, slug, gender, job, glasses, motion, "out", int(seed),
                  custom=custom.strip() if job == "khac" else None)
    return str(mp4.with_suffix(".jpg")), str(mp4)


with gr.Blocks(title="Ước Mơ Của Em") as ui:
    gr.Markdown("## Ước mơ của em · Future Me\nẢnh và video được tạo hoàn toàn trên máy này, không gửi lên mạng.")
    with gr.Row():
        with gr.Column():
            photo = gr.Image(type="filepath", sources=["upload", "webcam"], label="Ảnh của bé · Photo")
            name = gr.Textbox(label="Tên · Name", placeholder="an")
            gender = gr.Radio([("Bé trai", "boy"), ("Bé gái", "girl")], value="boy", label="Giới tính")
            glasses = gr.Checkbox(label="Giữ kính · Keep glasses")
            job = gr.Dropdown(CHOICES, value="bac-si", label="Nghề mơ ước · Dream job")
            custom = gr.Textbox(label="Nghề khác (tiếng Anh cho kết quả tốt hơn)",
                                placeholder="a marine biologist diving near a coral reef")
            motion = gr.Radio([("Nhanh (vài giây)", "parallax"), ("AI video (lâu, ~15–30 phút)", "ai")],
                              value="parallax", label="Chuyển động · Motion")
            seed = gr.Number(7, precision=0, label="Seed (đổi số để ra kết quả khác)")
            go = gr.Button("Tạo · Create", variant="primary")
        with gr.Column():
            still = gr.Image(label="Tương lai · Future", type="filepath")
            video = gr.Video(label="Video 5 giây (bấm ⬇ để lưu)")
    go.click(run, [photo, name, gender, glasses, job, custom, motion, seed], [still, video])

if __name__ == "__main__":
    ui.queue(default_concurrency_limit=1).launch(server_name="127.0.0.1")
