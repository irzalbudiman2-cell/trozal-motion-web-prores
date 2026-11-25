# TROZAL MOTION — Local Universal Object Segmenter
# Copyright (c) Meta Platforms, Inc. and affiliates for SAM 2 upstream components.
# This server only binds to loopback and allows explicit TROZAL origins.
import base64
import io
import os
import re
import sys
import threading
import time
from pathlib import Path
from contextlib import nullcontext

import numpy as np
from PIL import Image
from flask import Flask, jsonify, request
from flask_cors import CORS

ROOT = Path(__file__).resolve().parent
SAM2_ROOT = ROOT / "sam2-runtime"
CHECKPOINT = ROOT / "checkpoints" / "sam2.1_hiera_tiny.pt"
CONFIG = "configs/sam2.1/sam2.1_hiera_t.yaml"
MAX_SIDE = int(os.environ.get("TROZAL_RIG_MAX_SIDE", "1024"))
MAX_MASKS = int(os.environ.get("TROZAL_RIG_MAX_MASKS", "14"))
PORT = int(os.environ.get("TROZAL_RIG_PORT", "11436"))
# Allow the stable app origins plus Vercel preview deployments. Vercel assigns
# a new hostname to preview builds, so a fixed allowlist silently breaks
# browser-to-loopback requests after a deployment.
VERCEL_ORIGIN = re.compile(r"^https://trozal-motion-web-prores(?:-[a-z0-9-]+)*-trozal-id\.vercel\.app$", re.IGNORECASE)
ALLOWED_ORIGINS = [
    "https://irzalbudiman2-cell.github.io",
    "https://trozal-motion-web-prores.vercel.app",
    "https://trozal-motion-web-prores-git-ollama-direct-web-7718e1-trozal-id.vercel.app",
    "https://raw.githack.com",
    "http://127.0.0.1:11435",
    "http://localhost:11435",
    VERCEL_ORIGIN,
]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS,
                                  "methods": ["GET", "POST", "OPTIONS"],
                                  "allow_headers": ["Content-Type"],
                                  "max_age": 600}})


@app.after_request
def allow_local_network_preflight(response):
    # Chromium may send this header when a hosted page calls a loopback API.
    # Flask-CORS still restricts Access-Control-Allow-Origin to ALLOWED_ORIGINS.
    origin = request.headers.get("Origin", "")
    if request.headers.get("Access-Control-Request-Private-Network", "").lower() == "true":
        origin_allowed = origin in ALLOWED_ORIGINS or bool(VERCEL_ORIGIN.fullmatch(origin))
        if origin_allowed:
            response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


_predictor = None
_device = "unloaded"
_model_lock = threading.Lock()
_segment_progress_lock = threading.Lock()
_segment_progress = {
    "requestId": "",
    "phase": "idle",
    "progress": 0,
    "completed": 0,
    "total": 0,
    "message": "Menunggu perintah segmentasi.",
    "device": "unloaded",
    "error": "",
    "_started": None,
    "_updated": time.monotonic(),
}


def _set_segment_progress(request_id, phase, progress=0, completed=0,
                          total=0, message="", error=""):
    safe_request_id = str(request_id or "")[:96]
    with _segment_progress_lock:
        previous_request_id = _segment_progress.get("requestId")
        _segment_progress.update({
            "requestId": safe_request_id,
            "phase": str(phase),
            "progress": max(0, min(100, int(progress))),
            "completed": max(0, int(completed)),
            "total": max(0, int(total)),
            "message": str(message or ""),
            "device": _device,
            "error": str(error or ""),
            "_updated": time.monotonic(),
        })
        if phase in ("decoding", "loading_model", "sampling", "cpu_fallback", "finalizing"):
            if _segment_progress.get("_started") is None or previous_request_id != safe_request_id:
                _segment_progress["_started"] = time.monotonic()
        elif phase in ("completed", "error", "cancelled", "idle"):
            _segment_progress["_started"] = None


def _segment_progress_snapshot():
    with _segment_progress_lock:
        snapshot = {key: value for key, value in _segment_progress.items() if not key.startswith("_")}
        started = _segment_progress.get("_started")
        snapshot["active"] = snapshot.get("phase") in (
            "decoding", "loading_model", "sampling", "cpu_fallback", "finalizing"
        )
        snapshot["elapsedSeconds"] = round(time.monotonic() - started, 1) if started else 0
        return snapshot


def _load_predictor(force_cpu=False):
    global _predictor, _device
    with _model_lock:
        if _predictor is not None and (not force_cpu or _device == "cpu"):
            return _predictor
        if not CHECKPOINT.is_file():
            raise RuntimeError("Checkpoint SAM 2.1 Tiny belum ada. Jalankan TROZAL_UNIVERSAL_RIG_SETUP.bat.")
        if not SAM2_ROOT.joinpath("sam2").is_dir():
            raise RuntimeError("Folder sam2-runtime belum terpasang. Jalankan TROZAL_UNIVERSAL_RIG_SETUP.bat.")
        sys.path.insert(0, str(SAM2_ROOT))
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        use_cuda = torch.cuda.is_available() and not force_cpu and os.environ.get("TROZAL_RIG_DEVICE", "auto") != "cpu"
        device = "cuda" if use_cuda else "cpu"
        # Record the attempted device before model construction. SAM can fail
        # inside its CUDA position-encoding kernels before a predictor exists;
        # the caller must still recognize that as a CUDA failure and retry CPU.
        _device = device
        try:
            model = build_sam2(CONFIG, str(CHECKPOINT), device=device, apply_postprocessing=False)
            model.eval()
            _predictor = SAM2ImagePredictor(model)
        except Exception:
            _predictor = None
            raise
        return _predictor



def _is_cuda_runtime_error(error):
    """Recognize CUDA runtime failures, including unsupported GPU kernels."""
    message = str(error or "").lower()
    return any(token in message for token in (
        "cuda", "no kernel image", "cublas", "cudnn", "device-side assert",
        "invalid device function", "kernel launch"
    ))


def _image_from_payload(value, max_side=MAX_SIDE):
    if not isinstance(value, str):
        raise ValueError("Field image harus berupa data URL base64.")
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    raw = base64.b64decode(encoded, validate=True)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    original_size = image.size
    scale = min(1.0, max_side / max(image.size))
    if scale < 1:
        image = image.resize((max(1, round(image.width * scale)),
                              max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
    return image, original_size


def _png_data_url(array, mode="L"):
    image = Image.fromarray(array.astype(np.uint8), mode=mode)
    buff = io.BytesIO()
    image.save(buff, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buff.getvalue()).decode("ascii")


def _mask_record(mask, score, width, height, identifier):
    mask = np.asarray(mask).astype(bool)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    area = int(mask.sum())
    return {
        "id": "sam-" + str(identifier),
        "score": round(float(score), 4),
        "area": area,
        "areaRatio": round(area / float(width * height), 6),
        "bbox": [x0, y0, x1 - x0, y1 - y0],
        "mask": _png_data_url(mask.astype(np.uint8) * 255),
    }


def _iou(a, b):
    intersection = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(intersection / union) if union else 0.0


def _set_image(image, force_cpu=False):
    predictor = _load_predictor(force_cpu=force_cpu)
    predictor.set_image(np.asarray(image))
    return predictor


def _predict_loaded(predictor, points, labels):
    import torch
    with torch.inference_mode():
        if _device == "cuda":
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                return predictor.predict(
                    point_coords=np.asarray(points, dtype=np.float32),
                    point_labels=np.asarray(labels, dtype=np.int32),
                    multimask_output=True,
                )[:2]
        return predictor.predict(
            point_coords=np.asarray(points, dtype=np.float32),
            point_labels=np.asarray(labels, dtype=np.int32),
            multimask_output=True,
        )[:2]


def _predict_masks(image, points, labels):
    predictor = _set_image(image)
    try:
        masks, scores = _predict_loaded(predictor, points, labels)
    except Exception as exc:
        if _device != "cuda" or not _is_cuda_runtime_error(exc):
            raise
        import torch
        torch.cuda.empty_cache()
        predictor = _set_image(image, force_cpu=True)
        masks, scores = _predict_loaded(predictor, points, labels)
    return masks, scores


@app.after_request
def allow_loopback_private_network(response):
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Vary"] = "Origin"
    return response


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "engine": "SAM 2.1 Hiera Tiny",
        "model_loaded": _predictor is not None,
        "device": _device,
        "checkpoint": CHECKPOINT.is_file(),
        "max_side": MAX_SIDE,
    })


@app.get("/api/segment/status")
def segment_status():
    return jsonify({"ok": True, **_segment_progress_snapshot()})


@app.post("/api/segment/auto")
def segment_auto():
    body = request.get_json(force=True)
    request_id = str(body.get("requestId") or "")
    _set_segment_progress(request_id, "decoding", 1, 0, 20,
                          "Membaca dan menyiapkan gambar sumber…")
    try:
        image, original_size = _image_from_payload(body.get("image"))
        width, height = image.size
        # A sparse positive-point grid asks SAM for candidate components without
        # requiring a class-specific detector. Duplicates are merged by mask IoU.
        axes_x = [0.16, 0.33, 0.50, 0.67, 0.84]
        axes_y = [0.18, 0.38, 0.58, 0.78]
        grid = [[[gx * width, gy * height]] for gy in axes_y for gx in axes_x]
        total = len(grid)
        candidates = []

        def scan(predictor):
            for index, points in enumerate(grid):
                _set_segment_progress(
                    request_id, "sampling", 8 + int(index / max(1, total) * 82),
                    index, total,
                    "SAM 2.1 menganalisis area " + str(index + 1) + "/" + str(total) + "…"
                )
                masks, scores = _predict_loaded(predictor, points, [1])
                for mask, score in zip(masks, scores):
                    binary = np.asarray(mask).squeeze() > 0
                    ratio = float(binary.mean())
                    if ratio < 0.002 or ratio > 0.78 or float(score) < 0.62:
                        continue
                    if any(_iou(binary, item["binary"]) > 0.86 for item in candidates):
                        continue
                    candidates.append({"binary": binary, "score": float(score)})
                _set_segment_progress(
                    request_id, "sampling", 8 + int((index + 1) / max(1, total) * 82),
                    index + 1, total,
                    "SAM 2.1 menyelesaikan area " + str(index + 1) + "/" + str(total) + "…"
                )

        try:
            _set_segment_progress(request_id, "loading_model", 4, 0, total,
                                  "Memuat model SAM 2.1 Tiny pada perangkat terpilih…")
            predictor = _set_image(image)
            scan(predictor)
        except Exception as exc:
            if _device != "cuda" or not _is_cuda_runtime_error(exc):
                raise
            import torch
            torch.cuda.empty_cache()
            candidates = []
            _set_segment_progress(request_id, "cpu_fallback", 6, 0, total,
                                  "VRAM tidak mencukupi · mengulang segmentasi dengan CPU…")
            predictor = _set_image(image, force_cpu=True)
            scan(predictor)

        _set_segment_progress(request_id, "finalizing", 93, total, total,
                              "Menggabungkan mask dan membuang kandidat duplikat…")
        candidates.sort(key=lambda item: (item["score"], float(item["binary"].mean())), reverse=True)
        records = []
        for index, item in enumerate(candidates[:MAX_MASKS], 1):
            record = _mask_record(item["binary"], item["score"], width, height, index)
            if record:
                records.append(record)
        _set_segment_progress(
            request_id, "completed", 100, total, total,
            "Segmentasi selesai · " + str(len(records)) + " mask ditemukan."
        )
        return jsonify({
            "ok": True, "engine": "SAM 2.1 Hiera Tiny",
            "width": width, "height": height,
            "originalWidth": original_size[0], "originalHeight": original_size[1],
            "device": _device, "segments": records,
            "requestId": request_id,
        })
    except Exception as exc:
        _set_segment_progress(request_id, "error", 0, 0, 20,
                              "Segmentasi SAM 2.1 gagal.", str(exc))
        raise


@app.post("/api/segment/point")
def segment_point():
    body = request.get_json(force=True)
    image, original_size = _image_from_payload(body.get("image"))
    width, height = image.size
    points = body.get("points") or []
    if not points:
        raise ValueError("Tambahkan minimal satu titik positif.")
    labels = body.get("labels") or [1] * len(points)
    if len(labels) != len(points):
        raise ValueError("Jumlah label titik tidak sesuai.")
    scaled_points = []
    for p in points[:16]:
        scaled_points.append([
            max(0, min(width - 1, float(p[0]))),
            max(0, min(height - 1, float(p[1]))),
        ])
    masks, scores = _predict_masks(image, scaled_points, labels[:len(scaled_points)])
    index = int(np.argmax(scores))
    record = _mask_record(masks[index], scores[index], width, height, "point")
    if not record:
        raise ValueError("SAM tidak menemukan area objek dari titik tersebut.")
    return jsonify({"ok": True, "width": width, "height": height,
                    "originalWidth": original_size[0], "originalHeight": original_size[1],
                    "device": _device, "segment": record})


@app.post("/api/inpaint")
def inpaint():
    body = request.get_json(force=True)
    inpaint_max_side = int(os.environ.get("TROZAL_RIG_INPAINT_MAX_SIDE", "2048"))
    image, _ = _image_from_payload(body.get("image"), max_side=inpaint_max_side)
    width, height = image.size
    mask_urls = body.get("masks") or []
    if not mask_urls:
        raise ValueError("Mask objek kosong.")
    union = np.zeros((height, width), dtype=np.uint8)
    for value in mask_urls[:MAX_MASKS]:
        mask_image, _ = _image_from_payload(value)
        mask_image = mask_image.resize((width, height), Image.Resampling.NEAREST).convert("L")
        union = np.maximum(union, np.asarray(mask_image, dtype=np.uint8))
    try:
        import cv2
        source = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
        kernel = np.ones((5, 5), np.uint8)
        dilated = cv2.dilate(union, kernel, iterations=1)
        filled = cv2.inpaint(source, dilated, 7, cv2.INPAINT_TELEA)
        filled = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)
        result = Image.fromarray(filled, "RGB")
    except Exception as exc:
        raise RuntimeError("OpenCV inpainting tidak tersedia: " + str(exc))
    buff = io.BytesIO()
    result.save(buff, format="PNG", optimize=True)
    return jsonify({"ok": True, "background": "data:image/png;base64," +
                    base64.b64encode(buff.getvalue()).decode("ascii"),
                    "width": width, "height": height})


@app.errorhandler(Exception)
def handle_error(error):
    from werkzeug.exceptions import HTTPException
    if isinstance(error, HTTPException):
        return jsonify({"ok": False, "error": error.description}), error.code
    return jsonify({"ok": False, "error": str(error)}), 500


if __name__ == "__main__":
    print("TROZAL Universal Object Rig server")
    print("Local-only API: http://127.0.0.1:%d" % PORT)
    print("SAM 2.1 Tiny checkpoint:", CHECKPOINT)
    print("Model is loaded only when the first segmentation request arrives.")
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
