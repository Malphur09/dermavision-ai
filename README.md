# DermaVision AI

Clinical decision-support web app for dermoscopic skin lesion analysis.

- 8-class ISIC prediction with confidence + Grad-CAM overlay
- Doctor sign-off workflow with PDF/JSON report export
- Admin model metrics, version management, and PHI audit log
- 3-way PyTorch ensemble (B4 + B4 + ConvNeXt-Base) at 88.8% balanced accuracy

## Install

```bash
git clone https://github.com/Malphur09/dermavision-ai.git
cd dermavision-ai
cp .env.example .env       # fill in Supabase + service-role keys
docker compose up --build  # web on :3000, Flask internal on :5328
```

Web app at <http://localhost:3000>.

Schema apply, bucket setup, model artifact, and first-admin steps are in [`docs/`](docs/).
