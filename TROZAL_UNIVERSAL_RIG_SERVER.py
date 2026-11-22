# TROZAL MOTION — Local Universal Object Segmenter
# Copyright (c) Meta Platforms, Inc. and affiliates for SAM 2 upstream components.
# This server only binds to loopback and allows explicit TROZAL origins.
import base64
import io
import os
import sys
import threading
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
ALLOWED_ORIGINS = [
    "https://irzalbudiman2-cell.github.io",
    "https://trozal-motion-web-prores.vercel.app",
    "https://raw.githack.com",
    "http://127.0.0.1:11435",
    "http://localhost:11435",
]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS,
                                  "methods": ["GET", "POST", "OPTIONS"],
                                  "allow_headers": ["Content-Type"]}})

_predictor = None
_device = "unloaded"
_model_lock = threading.Lock()


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
        model = build_sam2(CONFIG, str(CHECKPOINT), device=device, apply_postprocessing=False)
        model.eval()
        _predictor = SAM2ImagePredictor(model)
        _device = device
        return _predictor


def _image_from_payload(value):
    if not isinstance(value, str):
        raise ValueError("Field image harus berupa data URL base64.")
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    raw = base64.b64decode(encoded, validate=True)
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    original_size = image.size
    scale = min(1.0, MAX_SIDE / max(image.size))
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
        if _device != "cuda" or ("out of memory" not in str(exc).lower() and "cuda" not in str(exc).lower()):
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


@app.post("/api/segment/auto")
def segment_auto():
    body = request.get_json(force=True)
    image, original_size = _image_from_payload(body.get("image"))
    width, height = image.size
    # A sparse positive-point grid asks SAM for candidate components without
    # requiring a class-specific detector. Duplicates are merged by mask IoU.
    axes_x = [0.16, 0.33, 0.50, 0.67, 0.84]
    axes_y = [0.18, 0.38, 0.58, 0.78]
    candidates = []
    grid = [[[gx * width, gy * height]] for gy in axes_y for gx in axes_x]
    try:
        predictor = _set_image(image)
        for points in grid:
            masks, scores = _predict_loaded(predictor, points, [1])
            for mask, score in zip(masks, scores):
                binary = np.asarray(mask).squeeze() > 0
                ratio = float(binary.mean())
                if ratio < 0.002 or ratio > 0.78 or float(score) < 0.62:
                    continue
                if any(_iou(binary, item["binary"]) > 0.86 for item in candidates):
                    continue
                candidates.append({"binary": binary, "score": float(score)})
    except Exception as exc:
        if _device != "cuda" or ("out of memory" not in str(exc).lower() and "cuda" not in str(exc).lower()):
            raise
        import torch
        torch.cuda.empty_cache()
        candidates = []
        predictor = _set_image(image, force_cpu=True)
        for points in grid:
            masks, scores = _predict_loaded(predictor, points, [1])
            for mask, score in zip(masks, scores):
                binary = np.asarray(mask).squeeze() > 0
                ratio = float(binary.mean())
                if ratio < 0.002 or ratio > 0.78 or float(score) < 0.62:
                    continue
                if any(_iou(binary, item["binary"]) > 0.86 for item in candidates):
                    continue
                candidates.append({"binary": binary, "score": float(score)})
    candidates.sort(key=lambda item: (item["score"], float(item["binary"].mean())), reverse=True)
    records = []
    for index, item in enumerate(candidates[:MAX_MASKS], 1):
        record = _mask_record(item["binary"], item["score"], width, height, index)
        if record:
            records.append(record)
    return jsonify({
        "ok": True, "engine": "SAM 2.1 Hiera Tiny",
        "width": width, "height": height,
        "originalWidth": original_size[0], "originalHeight": original_size[1],
        "device": _device, "segments": records,
    })


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
    image, _ = _image_from_payload(body.get("image"))
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
