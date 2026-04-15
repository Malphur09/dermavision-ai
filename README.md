# DermaVision AI

AI-powered multi-class skin lesion classification using EfficientNetB4 and Grad-CAM interpretability, built for clinical decision support.

## Stack

- **Frontend** — Next.js + TypeScript + Tailwind CSS + shadcn/ui
- **Backend** — Flask + PyTorch + pytorch-grad-cam
- **Model** — EfficientNetB4 trained on ISIC 2019 (8 classes)

## Project Structure

```
dermavision-ai/
├── src/                # Next.js app
├── api/                # Flask API
├── Dockerfile.web      # Next.js container
├── Dockerfile.api      # Flask container
└── docker-compose.yaml # Local dev orchestration
```

## Getting Started (Docker)

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```
2. Fill in Supabase values in `.env`.
3. Start both services:
   ```bash
   docker compose up --build
   ```

The web app will be available at `http://localhost:3000`.  
Next.js forwards `/api/*` requests to the Flask service over the Docker network via `http://api:5328`.
