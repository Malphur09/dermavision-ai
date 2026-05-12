# Model

## Active production model — v1.1

3-way PyTorch ensemble of ISIC 2019 fine-tunes, loaded natively from `dermavision_ensemble_3way.pth` at boot.

| Branch | Architecture (timm name) | Training emphasis | Blend weight |
|---|---|---:|---:|
| Run 1 | `tf_efficientnet_b4.ns_jft_in1k` | weighted-F1 focus | 0.15 |
| Run 2 | `tf_efficientnet_b4.ns_jft_in1k` | clinical-priority DRW | 0.25 |
| Run 3 | `convnext_base.fb_in22k_ft_in1k_384` | clinical-priority DRW | 0.60 |

Input: 384×384 RGB, ImageNet mean/std normalized. Output: softmaxed probabilities over the 8 ISIC classes. Each branch is run independently and softmaxed, then the three vectors are blended with the weights above.

### Eval (internal stratified holdout, 2 534 images, 10-view TTA)

| Metric | Value |
|---|---:|
| Accuracy | 93.49% |
| Balanced accuracy | 88.76% |
| Macro F1 | 0.909 |
| Weighted F1 | 0.934 |
| Macro AUC (OvR) | 0.990 |

Per-class F1 ranges from 0.81 (Actinic Keratosis) to 0.98 (Vascular Lesion); confusion matrix and full per-class P/R live in `public.model_metrics` keyed on the v1.1 row.

## Grad-CAM

Bespoke implementation (`api/pth_backend.py::_GradCAM`) — not pytorch-grad-cam, because the ensemble uses heterogeneous backbones and blending the gradients across them is noisy.

- Target layer: `ensemble.model_r3.backbone.stages[-1]` (ConvNeXt last stage).
- Why ConvNeXt: highest blend weight + cleaner gradient signal than the B4 branches.
- Overlay rendered via `pytorch_grad_cam.utils.image.show_cam_on_image`, returned as a base64-encoded PNG data URL on `/api/gradcam`.
- The frontend persists the overlay to `heatmaps/{doctor_id}/{case_id}.png` so it survives page refresh; `DiagnosisResults` polls `cases.gradcam_url` for 30s if the inference is still in flight when the user lands on `/results`.

## Archived — v1.0

Single-model EfficientNet-B4 fine-tune at 456×456. Kept in `model_versions` for delta-vs-prior on the admin dashboard but no longer served. Evaluated on the public ISIC 2019 Test Ground Truth (6 191 labeled images, UNK rows excluded):

| Metric | Value |
|---|---:|
| Accuracy | 71.83% |
| Balanced accuracy | 55.01% |
| Macro F1 | 0.589 |
| Latency p50 (CPU) | 56 ms |

Not directly comparable to v1.1 — v1.0 ran on the public Test set, v1.1 on an internal stratified holdout with 10-view TTA. Both numbers are accurate for their respective splits.

## Lifecycle

Backend endpoints (admin-gated, `api/model_lifecycle.py`):

| Endpoint | Effect |
|---|---|
| `POST /api/model/upload/validate` | streams artifact from `model-uploads`, runs `onnx.checker.check_model`, verifies input/output shape |
| `POST /api/model/upload/benchmark` | converts via `onnx2torch` (or ORT fallback), runs 20 forward passes for real p50/p95 latency, eval-set accuracy/F1 if `eval-set/labels.csv` is provisioned |
| `POST /api/model/deploy` | inserts `model_versions` row, archives prior production, copies the artifact to `production/{version}.onnx`, ingests `metrics.json` into `model_metrics`, invalidates the drift cache |
| `PATCH /api/model/versions/<id>` | edit version metadata (version label, architecture, params, notes) without touching deploy state |

Hot reload: every gunicorn worker polls `public.model_versions` for the current production row every 60 s. When `onnx_path` changes, the worker downloads the new bytes and swaps. No coordination needed across workers.

The PyTorch ensemble side-car (`PTH_MODEL_PATH`) **pins** the active model — when set, the hot-reload check short-circuits so a stray admin upload doesn't yank the production ensemble. Unset `PTH_MODEL_PATH` to re-enable ONNX-driven swaps.

## Class mapping

Canonical order — `api/classes.py`. **Do not** reorder, the argmax index is load-bearing across predict, eval, drift, and the frontend `ISIC_CODE` map.

```python
ISIC_CODES = ("MEL", "NV", "BCC", "AK", "BKL", "DF", "VASC", "SCC")
```

Risk buckets in `RISK_LEVEL`:

| Class | Bucket |
|---|---|
| Melanoma | High Risk |
| Basal Cell Carcinoma | High Risk |
| Squamous Cell Carcinoma | High Risk |
| Actinic Keratosis | Moderate Risk |
| Melanocytic Nevus | Benign |
| Benign Keratosis | Benign |
| Dermatofibroma | Benign |
| Vascular Lesion | Benign |
