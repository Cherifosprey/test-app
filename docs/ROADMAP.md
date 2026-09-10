# Roadmap ERP Suite

## Phase 1 — Fondation V1

- [x] dépôt de travail séparé et branche `erp-v1`
- [x] récupération automatique frontend + backend SimpleSoft
- [x] branding configurable
- [x] français pour la navigation principale et les écrans ERP ajoutés
- [x] XOF / FCFA par défaut
- [x] Super Admin et workspaces réutilisés
- [x] contrôle des modules par entreprise
- [x] offres Starter / Business / Pro / Enterprise
- [x] application d’une offre depuis le Super Admin
- [x] profil entreprise multi-pays
- [x] RCCM / IFU / NIF / identifiant fiscal
- [x] logo / signature / cachet sous forme d’URL
- [x] PostgreSQL + Redis local
- [x] CI de validation et build frontend

## Phase 2 — Commerce complet

- [x] fournisseurs
- [ ] demandes d’achat
- [x] bons de commande fournisseur
- [x] réceptions fournisseurs
- [ ] factures fournisseurs
- [ ] règlements fournisseurs
- [x] lien automatique achats → stock
- [ ] comptabilisation automatique des achats fournisseurs
- [x] paiements clients avec historique, règlements partiels et solde
- [x] modes Espèces / Virement / Mobile Money / Carte / Chèque / Autre
- [x] écriture comptable automatique des règlements clients
- [ ] avoirs et remboursements

## Phase 3 — Afrique francophone / multi-pays

- [ ] remplacer les écrans GST spécifiques à l’Inde par une fiscalité configurable
- [ ] modèles de facture adaptés par pays
- [ ] devise et formats régionaux par workspace dans tous les écrans existants
- [ ] connexion à un fournisseur Mobile Money réel
- [ ] WhatsApp pour devis, facture et relance
- [ ] traduction complète de toutes les pages SimpleSoft

## Phase 4 — White-label avancé

- [ ] upload direct du logo
- [ ] upload du cachet et de la signature
- [ ] couleurs par entreprise
- [ ] domaine/sous-domaine personnalisé
- [ ] modèles PDF de devis et factures personnalisables
- [ ] emails transactionnels personnalisés

## Phase 5 — SaaS commercial

- [ ] abonnement et facturation de l’entreprise cliente
- [ ] limites utilisateurs / stockage / messages
- [ ] essai gratuit et expiration
- [ ] suspension automatique
- [ ] sauvegardes automatiques
- [ ] journaux d’audit
- [ ] monitoring et alertes
- [ ] déploiement automatisé d’un nouveau client

## Critère avant commercialisation

Confirmer la licence exacte du backend SimpleSoft et les obligations de redistribution avant de proposer une version propriétaire ou hébergée aux clients.
