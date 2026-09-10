# ERP V1 – base SimpleSoft personnalisée

Ce dépôt sert de base de travail pour transformer SimpleSoft en ERP tout-en-un commercialisable.

## Objectif V1

- interface française
- devise XOF / FCFA par défaut
- branding personnalisable
- Super Admin central
- modules activables par entreprise
- plans Starter / Business / Pro / Enterprise
- préparation multi-clients

## Structure cible

- `upstream/frontend` : copie de `simple-softwares/simplesoft-frontend`
- `upstream/backend` : copie de `simple-softwares/simplesoft-backend`
- `custom/` : personnalisations ERP
- `scripts/` : scripts d’installation / synchronisation

## Démarrage

Sous macOS/Linux :

```bash
bash scripts/bootstrap.sh
```

Sous Windows PowerShell :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
```

Les scripts clonent automatiquement les deux dépôts SimpleSoft dans `upstream/`.

## Modules V1

CRM, ventes, achats, facturation, paiements, stock, finance, RH, projets, SAV, rapports et administration.

> Ne pas travailler directement sur `main` pour les grosses modifications. Utiliser une branche de fonctionnalité et une Pull Request.
