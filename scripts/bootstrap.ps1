$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "upstream" | Out-Null

if (-not (Test-Path "upstream/frontend/.git")) {
  git clone https://github.com/simple-softwares/simplesoft-frontend.git upstream/frontend
}

if (-not (Test-Path "upstream/backend/.git")) {
  git clone https://github.com/simple-softwares/simplesoft-backend.git upstream/backend
}

Write-Host "SimpleSoft frontend/backend récupérés dans upstream/."
Write-Host "Travaillez ensuite sur les personnalisations ERP dans custom/."
