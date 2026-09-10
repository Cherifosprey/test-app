$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "upstream" | Out-Null

if (-not (Test-Path "upstream/frontend/.git")) {
  git clone https://github.com/simple-softwares/simplesoft-frontend.git upstream/frontend
}

if (-not (Test-Path "upstream/backend/.git")) {
  git clone https://github.com/simple-softwares/simplesoft-backend.git upstream/backend
}

python scripts/apply_customizations.py

Write-Host ""
Write-Host "ERP V1 prêt dans upstream/frontend et upstream/backend."
Write-Host "Frontend : cd upstream/frontend ; npm install ; npm run dev"
Write-Host "Backend  : cd upstream/backend ; python -m venv .venv ; pip install -r requirements.txt"
