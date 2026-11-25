# TROZAL OLLAMA — Universal Object Rig

Universal Object Rig uses SAM 2.1 Hiera Tiny for local component masks and can run on NVIDIA CUDA, supported AMD ROCm devices, or CPU fallback.

## GPU profiles

Run `TROZAL_UNIVERSAL_RIG_SETUP.bat` and select a profile:

| Profile | PyTorch runtime | Intended hardware |
|---|---|---|
| NVIDIA CUDA 12.8 | PyTorch 2.9.1 + TorchVision 0.24.1 | GTX 1660 Super (Turing, sm_75), RTX 5060 (Blackwell, sm_120), and other architectures included in the official wheel |
| AMD ROCm 7.2.1 | PyTorch 2.9.1 ROCm + TorchVision 0.24.1 | Only Radeon GPUs listed in AMD's Windows compatibility matrix; Windows 11, Python 3.12 and matching AMD driver required |
| CPU | PyTorch 2.9.1 CPU | Any supported Windows PC; slower, no GPU acceleration |

**For the current RTX 5060, choose profile 1 (NVIDIA CUDA 12.8).** The previous CUDA 12.1 / PyTorch 2.5.1 installer is not suitable for Blackwell sm_120. CUDA 12.8 PyTorch wheels include both Turing sm_75 and Blackwell sm_120 support. The same NVIDIA profile therefore supports switching between the GTX 1660 Super and RTX 5060, provided the installed NVIDIA driver is current.

The AMD Windows profile is deliberately limited to AMD's published supported hardware. It is not a universal driver for every Radeon card. Unsupported Radeon models use CPU fallback. On Linux, install the ROCm/PyTorch combination supported for that Linux distribution and GPU; this Windows installer does not configure Linux/WSL ROCm.

## Installation and use

1. Choose the matching GPU profile in `TROZAL_UNIVERSAL_RIG_SETUP.bat`.
2. The setup creates the isolated `.trozal-rig-venv`, installs the selected PyTorch backend, downloads official SAM 2 source and the SAM 2.1 Tiny checkpoint.
3. Run `TROZAL_UNIVERSAL_RIG_START.bat`. The server detects the available accelerator automatically.
4. Check `http://127.0.0.1:11436/api/health`. The response includes PyTorch version, CUDA/HIP runtime, detected GPU, NVIDIA compute capability, supported PyTorch architectures, backend and selected device.
5. Use Mode 5 in TROZAL OLLAMA and run AI Segmentasi Komponen.

## Device selection overrides

The server supports `TROZAL_RIG_DEVICE=auto|cuda|nvidia|amd|rocm|cpu`. Default is `auto`. The AMD aliases require a ROCm-enabled PyTorch build. CPU can be forced for troubleshooting. CUDA/ROCm runtime failures, including unsupported kernels, trigger CPU retry where possible.

## Accuracy and compatibility notes

- NVIDIA CUDA 12.8 PyTorch wheel architecture support is what makes the GTX 1660 Super and RTX 5060 share one install profile; it does not guarantee every third-party CUDA extension supports both.
- SAM 2's optional custom CUDA extension remains disabled; segmentation uses supported PyTorch operations.
- AMD GPU acceleration depends on the exact GPU, OS, driver and ROCm matrix. AMD's Windows PyTorch support is limited to named Radeon products and Windows 11; other cards are not claimed as compatible.
- CPU fallback preserves availability but is slower.
- Successful package installation/build checks do not replace a real segmentation test on each physical GPU.

## Troubleshooting

- If the health endpoint reports `backend: nvidia-cuda` and `computeCapability: 12.0`, RTX 5060 is being recognized.
- GTX 1660 Super should report `computeCapability: 7.5`.
- If an NVIDIA GPU is detected but its architecture is absent from PyTorch's compiled architecture list, the server selects CPU instead of knowingly launching an unsupported kernel.
- If AMD reports no accelerator, verify the Radeon model and Windows driver against AMD's current ROCm compatibility matrix.
- Keep analysis size at or below 1024 pixels when VRAM is limited.
