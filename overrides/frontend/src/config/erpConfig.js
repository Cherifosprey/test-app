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
    business: ['projects', 'tasks', 'contacts', 'crm', 'quotations', 'sales', 'invoices', 'products', 'inventory', 'expenses', 'accounting'],
    pro: ['projects', 'tasks', 'notes', 'contacts', 'chat', 'files', 'crm', 'quotations', 'sales', 'invoices', 'products', 'inventory', 'expenses', 'accounting', 'calendar', 'hr', 'attendance', 'performance', 'automation', 'helpdesk'],
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
