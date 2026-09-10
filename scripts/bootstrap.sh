#!/usr/bin/env bash
set -euo pipefail

mkdir -p upstream

if [ ! -d upstream/frontend/.git ]; then
  git clone https://github.com/simple-softwares/simplesoft-frontend.git upstream/frontend
fi

if [ ! -d upstream/backend/.git ]; then
  git clone https://github.com/simple-softwares/simplesoft-backend.git upstream/backend
fi

python3 scripts/apply_customizations.py

if [ ! -f upstream/frontend/.env.local ]; then
  cp custom/frontend.env.example upstream/frontend/.env.local
fi

if [ ! -f upstream/backend/.env ]; then
  cp custom/backend.env.example upstream/backend/.env
fi

echo ""
echo "ERP V1 prêt dans upstream/frontend et upstream/backend."
echo "1. Infrastructure : docker compose -f docker-compose.infrastructure.yml up -d"
echo "2. Backend        : cd upstream/backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload"
echo "3. Frontend       : cd upstream/frontend && npm install && npm run dev"
