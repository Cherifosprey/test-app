$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "upstream" | Out-Null

if (-not (Test-Path "upstream/frontend/.git")) {
  git clone https://github.com/simple-softwares/simplesoft-frontend.git upstream/frontend
}

if (-not (Test-Path "upstream/backend/.git")) {
  git clone https://github.com/simple-softwares/simplesoft-backend.git upstream/backend
}

python scripts/apply_customizations.py

if (-not (Test-Path "upstream/frontend/.env.local")) {
  Copy-Item "custom/frontend.env.example" "upstream/frontend/.env.local"
}

if (-not (Test-Path "upstream/backend/.env")) {
  Copy-Item "custom/backend.env.example" "upstream/backend/.env"
}

Write-Host ""
Write-Host "ERP V1 prêt dans upstream/frontend et upstream/backend."
Write-Host "1. Infrastructure : docker compose -f docker-compose.infrastructure.yml up -d"
Write-Host "2. Backend        : cd upstream/backend ; python -m venv .venv ; .venv\Scripts\Activate.ps1 ; pip install -r requirements.txt ; uvicorn app.main:app --reload"
Write-Host "3. Frontend       : cd upstream/frontend ; npm install ; npm run dev"
