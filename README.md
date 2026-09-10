# ERP Suite V1 — basé sur SimpleSoft

Ce dépôt transforme les projets open source SimpleSoft en une base ERP tout-en-un personnalisable pour plusieurs entreprises clientes.

## Fonctionnalités V1 déjà intégrées

- branding configurable (`ERP Suite` par défaut)
- interface principale progressivement francisée
- XOF / FCFA par défaut, avec EUR et USD
- Super Admin existant réutilisé
- activation/désactivation des modules par entreprise
- offres Starter / Business / Pro / Enterprise
- écran Super Admin **Offres ERP** pour appliquer une formule à une entreprise
- profil entreprise multi-pays : raison sociale, nom commercial, pays, langue/format, téléphone, email et adresse
- informations légales : RCCM, IFU, NIF et identifiant fiscal générique
- fiscalité configurable : nom de taxe, taux par défaut, prix HT/TTC, libellé fiscal, exonération et pied de facture
- logo, signature et cachet par entreprise (URL en V1)
- module **Achats & Fournisseurs** : fournisseurs, bons de commande et statuts
- liaison d’une ligne d’achat avec un produit du stock
- réception fournisseur qui augmente automatiquement le stock une seule fois
- factures fournisseurs avec dette comptable, échéance et solde
- règlements fournisseurs partiels/complets avec historique et écriture comptable
- module **Paiements clients** : paiements complets ou partiels, soldes et historique
- modes Espèces, Virement, Mobile Money, Carte, Chèque et Autre
- écriture comptable automatique à chaque règlement client
- PostgreSQL + Redis pour le développement local
- validation GitHub Actions contre la version actuelle de SimpleSoft

## Architecture

Le code SimpleSoft reste récupéré depuis les dépôts upstream afin de faciliter les mises à jour :

- `upstream/frontend` → `simple-softwares/simplesoft-frontend`
- `upstream/backend` → `simple-softwares/simplesoft-backend`
- `overrides/frontend` → fichiers personnalisés injectés dans le frontend
- `overrides/backend` → fichiers personnalisés injectés dans le backend
- `scripts/apply_customizations.py` → applique les personnalisations principales
- `scripts/apply_supplier_finance.py` → branche les écrans et routes de finance fournisseur
- `custom/` → configuration générale et modèles `.env`

## Installation locale

### macOS / Linux

```bash
bash scripts/bootstrap.sh
docker compose -f docker-compose.infrastructure.yml up -d
```

Backend :

```bash
cd upstream/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend :

```bash
cd upstream/frontend
npm install
npm run dev
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
docker compose -f docker-compose.infrastructure.yml up -d
```

Backend :

```powershell
cd upstream/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend :

```powershell
cd upstream/frontend
npm install
npm run dev
```

## Offres V1

- **Starter** : projets, tâches, contacts, CRM, devis, ventes, factures et paiements clients
- **Business** : Starter + produits, achats/fournisseurs, factures et règlements fournisseurs, stock, dépenses et comptabilité
- **Pro** : Business + documents, équipe, calendrier, RH, présences, performance, automatisation et SAV
- **Enterprise** : tous les modules disponibles

## Prochaines briques

Voir `docs/ROADMAP.md` pour l’avancement. Les prochaines priorités sont l’adaptation complète des factures clients à la fiscalité multi-pays, les avoirs/remboursements, les uploads de logo/cachet/signature, les modèles PDF, la traduction complète, les sauvegardes et le déploiement multi-clients.

> Avant une commercialisation publique, la licence applicable au backend SimpleSoft doit être confirmée précisément.
