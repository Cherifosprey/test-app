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

echo ""
echo "ERP V1 prêt dans upstream/frontend et upstream/backend."
echo "Frontend : cd upstream/frontend && npm install && npm run dev"
echo "Backend  : cd upstream/backend && python -m venv .venv && pip install -r requirements.txt"
