#!/usr/bin/env bash
set -euo pipefail

mkdir -p upstream

if [ ! -d upstream/frontend/.git ]; then
  git clone https://github.com/simple-softwares/simplesoft-frontend.git upstream/frontend
fi

if [ ! -d upstream/backend/.git ]; then
  git clone https://github.com/simple-softwares/simplesoft-backend.git upstream/backend
fi

echo "SimpleSoft frontend/backend récupérés dans upstream/."
echo "Travaillez ensuite sur les personnalisations ERP dans custom/."
