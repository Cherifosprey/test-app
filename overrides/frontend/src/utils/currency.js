import { ERP_CONFIG } from '../config/erpConfig.js';

export function formatCurrency(value, currency = ERP_CONFIG.brand.currency, locale = ERP_CONFIG.brand.locale) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  }).format(amount);
}

export function currencySymbol(currency = ERP_CONFIG.brand.currency) {
  if (currency === 'XOF') return 'FCFA';
  if (currency === 'EUR') return '€';
  if (currency === 'USD') return '$';
  return currency;
}
