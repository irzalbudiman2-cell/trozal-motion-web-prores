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
POSE_CHECKPOINT = ROOT / "checkpoints" / "pose_landmarker_lite.task"
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
    origin_allowed = origin in ALLOWED_ORIGINS or bool(VERCEL_ORIGIN.fullmatch(origin))
    # Return the Private Network Access opt-in on every allowed preflight.
    # Newer Chromium builds may not expose the legacy request header in the
    # same way, but still require the server to explicitly permit loopback.
    if origin_allowed and request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Vary"] = "Origin"
    elif origin_allowed and request.headers.get("Access-Control-Request-Private-Network", "").lower() == "true":
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



def _torch_runtime_info():
    """Diagnostics for NVIDIA CUDA, AMD ROCm, and CPU."""
    try:
        import torch
        available = bool(torch.cuda.is_available())
        info = {"torch": str(torch.__version__),
                "cudaRuntime": str(torch.version.cuda) if torch.version.cuda else None,
                "hipRuntime": str(getattr(torch.version, "hip", None)) if getattr(torch.version, "hip", None) else None,
                "acceleratorAvailable": available, "backend": "cpu",
                "gpuName": None, "computeCapability": None,
                "torchArchitectures": [], "selectedDevice": _device}
        if available:
            info["gpuName"] = str(torch.cuda.get_device_name(0))
            is_amd = bool(getattr(torch.version, "hip", None))
            info["backend"] = "amd-rocm" if is_amd else "nvidia-cuda"
            if not is_amd:
                try:
                    major, minor = torch.cuda.get_device_capability(0)
                    info["computeCapability"] = f"{major}.{minor}"
                    info["torchArchitectures"] = list(torch.cuda.get_arch_list())
                except Exception as exc:
                    info["diagnosticWarning"] = str(exc)
        return info
    except Exception as exc:
        return {"backend": "unavailable", "acceleratorAvailable": False,
                "diagnosticError": str(exc), "selectedDevice": _device}


def _select_accelerator(torch, force_cpu=False):
    """Select a usable NVIDIA CUDA or AMD ROCm device; otherwise CPU."""
    profile = os.environ.get("TROZAL_RIG_DEVICE", "auto").strip().lower()
    if force_cpu or profile == "cpu" or not torch.cuda.is_available():
        return "cpu"
    if profile not in ("auto", "cuda", "nvidia", "amd", "rocm"):
        raise RuntimeError("TROZAL_RIG_DEVICE harus auto, cuda, nvidia, amd, rocm, atau cpu.")
    is_amd = bool(getattr(torch.version, "hip", None))
    if profile in ("amd", "rocm") and not is_amd:
        raise RuntimeError("Profil AMD dipilih, tetapi PyTorch ROCm tidak terdeteksi.")
    if profile in ("nvidia", "cuda") and is_amd:
        raise RuntimeError("Profil NVIDIA dipilih, tetapi runtime PyTorch aktif adalah ROCm/AMD.")
    if not is_amd:
        major, minor = torch.cuda.get_device_capability(0)
        arch = f"sm_{major}{minor}"
        built_arches = set(torch.cuda.get_arch_list())
        if arch not in built_arches:
            return "cpu"
    return "cuda"


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

        device = _select_accelerator(torch, force_cpu=force_cpu)
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
    try:
        # Include model loading and image encoding in the guarded block: CUDA
        # kernel failures can happen before predictor.predict() is reached.
        predictor = _set_image(image)
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
        "runtime": _torch_runtime_info(),
        "deviceProfile": os.environ.get("TROZAL_RIG_DEVICE", "auto"),
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


def _estimate_pose(image):
    """Run local MediaPipe Pose Landmarker; return normalized 33-joint landmarks."""
    if not POSE_CHECKPOINT.is_file():
        raise RuntimeError("Model pose lokal belum tersedia. Jalankan TROZAL_UNIVERSAL_RIG_SETUP.bat untuk mengunduh pose_landmarker_lite.task.")
    try:
        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
    except Exception as exc:
        raise RuntimeError("MediaPipe Pose belum terpasang di lingkungan lokal: " + str(exc))
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(POSE_CHECKPOINT)),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.35,
        min_pose_presence_confidence=0.35,
        min_tracking_confidence=0.35,
        output_segmentation_masks=False,
    )
    rgb = np.ascontiguousarray(np.asarray(image.convert("RGB"), dtype=np.uint8))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp_image)
    if not result.pose_landmarks:
        return {"detected": False, "landmarks": [], "width": image.width, "height": image.height}
    landmarks = []
    for point in result.pose_landmarks[0]:
        landmarks.append({
            "x": float(point.x), "y": float(point.y), "z": float(point.z),
            "visibility": float(getattr(point, "visibility", 1.0)),
            "presence": float(getattr(point, "presence", 1.0)),
        })
    return {"detected": True, "landmarks": landmarks,
            "width": image.width, "height": image.height}


@app.post("/api/pose/estimate")
def pose_estimate():
    body = request.get_json(force=True)
    image, original_size = _image_from_payload(body.get("image"), max_side=1280)
    pose = _estimate_pose(image)
    pose["originalWidth"] = original_size[0]
    pose["originalHeight"] = original_size[1]
    pose["engine"] = "MediaPipe Pose Landmarker Lite · local"
    return jsonify({"ok": True, "pose": pose})





def _capsule_roi(width, height, start, end, radius):
    """Conservative limb corridor around a pose bone, used to crop SAM candidates."""
    yy, xx = np.ogrid[:height, :width]
    ax, ay = float(start[0]), float(start[1])
    bx, by = float(end[0]), float(end[1])
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq < 1:
        return (xx - ax) ** 2 + (yy - ay) ** 2 <= radius * radius
    t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / length_sq, 0, 1)
    nearest_x, nearest_y = ax + t * dx, ay + t * dy
    return (xx - nearest_x) ** 2 + (yy - nearest_y) ** 2 <= radius * radius


def _pose_part_roi(width, height, kind, points, radius):
    if kind == "torso":
        from PIL import ImageDraw
        canvas = Image.new("L", (width, height), 0)
        draw = ImageDraw.Draw(canvas)
        polygon = [(int(x), int(y)) for x, y in points]
        draw.polygon(polygon, fill=255)
        return np.asarray(canvas, dtype=np.uint8) > 0
    if kind == "head":
        cx, cy = points[0]
        yy, xx = np.ogrid[:height, :width]
        return (xx - cx) ** 2 + (yy - cy) ** 2 <= radius * radius
    return _capsule_roi(width, height, points[0], points[1], radius)


@app.post("/api/pose/segment-parts")
def pose_segment_parts():
    """Create independently addressable human body layers from Pose landmarks + SAM 2.1 masks."""
    body = request.get_json(force=True)
    request_id = str(body.get("requestId") or "character-parts")
    _set_segment_progress(request_id, "decoding", 1, 0, 11,
                          "Membaca gambar untuk Character Part Segmentation…")
    try:
        image, original_size = _image_from_payload(body.get("image"), max_side=MAX_SIDE)
        width, height = image.size
        pose = _estimate_pose(image)
        if not pose.get("detected"):
            return jsonify({"ok": False, "error": "Pose manusia tidak terdeteksi. Pastikan seluruh tubuh terlihat dan gambar cukup jelas."}), 422
        lm = pose["landmarks"]
        def point(index):
            item = lm[index]
            return (float(item["x"]) * width, float(item["y"]) * height)
        def visible(*indices):
            return all(float(lm[i].get("visibility", 1)) >= 0.18 and
                       float(lm[i].get("presence", 1)) >= 0.12 for i in indices)
        shoulder_span = max(12.0, float(np.linalg.norm(np.subtract(point(11), point(12)))))
        hip_span = max(10.0, float(np.linalg.norm(np.subtract(point(23), point(24)))))
        specs = [
            ("head", "Kepala", "head", (0,), "torso", "bob", 0),
            ("torso", "Badan / Torso", "torso", (11, 12, 24, 23), "", "bob", 23),
            ("upperArmL", "Lengan Atas Kiri", "limb", (11, 13), "torso", "swing", 11),
            ("forearmL", "Lengan Bawah Kiri", "limb", (13, 15), "upperArmL", "hinge", 13),
            ("handL", "Tangan Kiri", "limb", (15, 19), "forearmL", "swing", 15),
            ("upperArmR", "Lengan Atas Kanan", "limb", (12, 14), "torso", "swing", 12),
            ("forearmR", "Lengan Bawah Kanan", "limb", (14, 16), "upperArmR", "hinge", 14),
            ("handR", "Tangan Kanan", "limb", (16, 20), "forearmR", "swing", 16),
            ("thighL", "Paha Kiri", "limb", (23, 25), "torso", "swing", 23),
            ("shinL", "Betis Kiri", "limb", (25, 27), "thighL", "hinge", 25),
            ("footL", "Kaki Kiri", "limb", (27, 31), "shinL", "rotate", 27),
            ("thighR", "Paha Kanan", "limb", (24, 26), "torso", "swing", 24),
            ("shinR", "Betis Kanan", "limb", (26, 28), "thighR", "hinge", 26),
            ("footR", "Kaki Kanan", "limb", (28, 32), "shinR", "rotate", 28),
        ]
        _set_segment_progress(request_id, "loading_model", 5, 0, len(specs),
                              "Memuat SAM 2.1 Tiny untuk pemisahan anggota tubuh…")
        predictor = _set_image(image)
        records = []
        for index, (identifier, name, kind, indices, parent, motion, pivot_index) in enumerate(specs):
            if not visible(*indices):
                continue
            coords = [point(i) for i in indices]
            if kind == "head":
                center = point(0)
                radius = max(10.0, shoulder_span * 0.34)
                roi = _pose_part_roi(width, height, "head", [center], radius)
                positive = [center]
                negatives = [point(11), point(12), point(23)]
            elif kind == "torso":
                shoulder_l, shoulder_r, hip_r, hip_l = coords
                pad = max(5.0, shoulder_span * 0.07)
                polygon = [
                    (shoulder_l[0] - pad, shoulder_l[1] - pad),
                    (shoulder_r[0] + pad, shoulder_r[1] - pad),
                    (hip_r[0] + pad, hip_r[1] + pad),
                    (hip_l[0] - pad, hip_l[1] + pad),
                ]
                roi = _pose_part_roi(width, height, "torso", polygon, 0)
                center = (sum(p[0] for p in polygon) / 4, sum(p[1] for p in polygon) / 4)
                positive = [center, ((shoulder_l[0]+hip_l[0])/2, (shoulder_l[1]+hip_l[1])/2),
                            ((shoulder_r[0]+hip_r[0])/2, (shoulder_r[1]+hip_r[1])/2)]
                negatives = [point(0), point(13), point(14), point(25), point(26)]
            else:
                a, b = coords
                length = float(np.linalg.norm(np.subtract(a, b)))
                if length < max(8.0, shoulder_span * 0.045):
                    continue
                if identifier.startswith(("upperArm", "forearm")):
                    radius = max(7.0, shoulder_span * (0.105 if identifier.startswith("upperArm") else 0.085))
                elif identifier.startswith(("thigh", "shin")):
                    radius = max(8.0, hip_span * (0.17 if identifier.startswith("thigh") else 0.12))
                elif identifier.startswith("hand"):
                    radius = max(7.0, shoulder_span * 0.11)
                else:
                    radius = max(7.0, hip_span * 0.12)
                roi = _pose_part_roi(width, height, "limb", coords, radius)
                positive = [(a[0] * 0.35 + b[0] * 0.65, a[1] * 0.35 + b[1] * 0.65),
                            (a[0] * 0.68 + b[0] * 0.32, a[1] * 0.68 + b[1] * 0.32)]
                dx, dy = b[0] - a[0], b[1] - a[1]
                norm = max(1.0, float(np.hypot(dx, dy)))
                nx, ny = -dy / norm, dx / norm
                mid = ((a[0]+b[0])/2, (a[1]+b[1])/2)
                negatives = [(mid[0] + nx * radius * 1.8, mid[1] + ny * radius * 1.8),
                             (mid[0] - nx * radius * 1.8, mid[1] - ny * radius * 1.8)]
            points, labels = [], []
            for x, y in positive:
                points.append([max(0, min(width - 1, x)), max(0, min(height - 1, y))]); labels.append(1)
            for x, y in negatives:
                points.append([max(0, min(width - 1, x)), max(0, min(height - 1, y))]); labels.append(0)
            try:
                masks, scores = _predict_loaded(predictor, points, labels)
            except Exception as exc:
                if _device != "cuda" or not _is_cuda_runtime_error(exc):
                    raise
                import torch
                torch.cuda.empty_cache()
                predictor = _set_image(image, force_cpu=True)
                masks, scores = _predict_loaded(predictor, points, labels)
            candidates = []
            for mask, score in zip(masks, scores):
                binary = np.asarray(mask).squeeze() > 0
                clipped = np.logical_and(binary, roi)
                area = int(clipped.sum())
                if area < max(8, int(width * height * 0.00008)):
                    continue
                candidates.append((float(score), area, clipped))
            if not candidates:
                _set_segment_progress(request_id, "sampling", 10 + int((index + 1) / len(specs) * 82),
                                      index + 1, len(specs), "SAM melewati bagian yang tidak memiliki mask meyakinkan: " + name)
                continue
            candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
            score, area, mask = candidates[0]
            record = _mask_record(mask, score, width, height, identifier)
            if not record:
                continue
            record.update({
                # Keep anatomical IDs stable and identical to the parent references.
                # The SAM mask identifier remains available separately for diagnostics.
                "id": identifier, "maskId": record["id"],
                "name": name, "category": "character", "motion": motion,
                "parent": parent, "pivotX": round(point(pivot_index)[0] / width, 6),
                "pivotY": round(point(pivot_index)[1] / height, 6),
            })
            records.append(record)
            _set_segment_progress(request_id, "sampling", 10 + int((index + 1) / len(specs) * 82),
                                  index + 1, len(specs), "Memisahkan komponen tubuh: " + name)
        _set_segment_progress(request_id, "completed", 100, len(specs), len(specs),
                              "Pemisahan tubuh selesai · " + str(len(records)) + " layer terdeteksi.")
        return jsonify({
            "ok": True, "engine": "MediaPipe Pose + SAM 2.1 Tiny · Character Parts",
            "width": width, "height": height, "originalWidth": original_size[0],
            "originalHeight": original_size[1], "device": _device,
            "pose": pose, "segments": records,
            "diagnostics": {"requestedParts": len(specs), "detectedParts": len(records),
                            "missingParts": [spec[1] for spec in specs if spec[0] not in {item["id"] for item in records}]}
        })
    except Exception as exc:
        _set_segment_progress(request_id, "error", 0, 0, 11,
                              "Character Part Segmentation gagal.", str(exc))
        raise


def _adaptive_inpaint_parameters(width, height):
    """Scale mask expansion and OpenCV repair radius with source resolution."""
    longest_side = max(int(width), int(height), 1)
    dilation_px = max(2, min(8, int(round(longest_side / 512))))
    inpaint_radius = max(3, min(10, int(round(longest_side / 256))))
    return dilation_px, inpaint_radius


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
        dilation_px, inpaint_radius = _adaptive_inpaint_parameters(width, height)
        kernel_size = dilation_px * 2 + 1
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        dilated = cv2.dilate(union, kernel, iterations=1)
        filled = cv2.inpaint(source, dilated, inpaint_radius, cv2.INPAINT_TELEA)
        mask_coverage = float(np.count_nonzero(union)) / float(width * height)
        expanded_coverage = float(np.count_nonzero(dilated)) / float(width * height)
        filled = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)
        result = Image.fromarray(filled, "RGB")
    except Exception as exc:
        raise RuntimeError("OpenCV inpainting tidak tersedia: " + str(exc))
    buff = io.BytesIO()
    result.save(buff, format="PNG", optimize=True)
    return jsonify({"ok": True, "background": "data:image/png;base64," +
                    base64.b64encode(buff.getvalue()).decode("ascii"),
                    "width": width, "height": height,
                    "diagnostics": {
                        "maskCoverage": round(mask_coverage * 100, 2),
                        "expandedCoverage": round(expanded_coverage * 100, 2),
                        "dilationPixels": dilation_px,
                        "inpaintRadius": inpaint_radius
                    }})


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
    print("Device profile:", os.environ.get("TROZAL_RIG_DEVICE", "auto"))
    print("GPU runtime:", _torch_runtime_info())
    print("Model is loaded only when the first segmentation request arrives.")
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
