const ALL_MODULES = [
  'projects', 'tasks', 'notes', 'contacts', 'chat', 'files',
  'team', 'invoices', 'quotations', 'accounting', 'products', 'purchases',
  'calendar', 'hr', 'attendance', 'crm', 'sales', 'expenses',
  'inventory', 'performance', 'automation', 'helpdesk',
];

export const ERP_CONFIG = {
  brand: {
    name: import.meta.env.VITE_ERP_NAME || 'ERP Suite',
    shortName: import.meta.env.VITE_ERP_SHORT_NAME || 'E',
    locale: import.meta.env.VITE_ERP_LOCALE || 'fr-FR',
    currency: import.meta.env.VITE_ERP_CURRENCY || 'XOF',
  },
  currencies: ['XOF', 'EUR', 'USD'],
  plans: {
    starter: ['projects', 'tasks', 'contacts', 'crm', 'quotations', 'sales', 'invoices'],
    business: ['projects', 'tasks', 'contacts', 'crm', 'quotations', 'sales', 'invoices', 'products', 'purchases', 'inventory', 'expenses', 'accounting'],
    pro: ['projects', 'tasks', 'notes', 'contacts', 'chat', 'files', 'team', 'crm', 'quotations', 'sales', 'invoices', 'products', 'purchases', 'inventory', 'expenses', 'accounting', 'calendar', 'hr', 'attendance', 'performance', 'automation', 'helpdesk'],
    enterprise: ALL_MODULES,
  },
};

export const MODULE_LABELS_FR = {
  projects: 'Projets',
  tasks: 'Tâches',
  notes: 'Notes',
  contacts: 'Contacts',
  chat: 'Messagerie',
  files: 'Documents',
  team: 'Équipe et permissions',
  invoices: 'Factures',
  quotations: 'Devis',
  accounting: 'Comptabilité',
  products: 'Produits',
  purchases: 'Achats & Fournisseurs',
  calendar: 'Calendrier',
  hr: 'Ressources humaines',
  attendance: 'Présences',
  crm: 'CRM',
  sales: 'Ventes',
  expenses: 'Dépenses',
  inventory: 'Stock',
  performance: 'Performance',
  automation: 'Automatisation',
  helpdesk: 'SAV / Support',
};
