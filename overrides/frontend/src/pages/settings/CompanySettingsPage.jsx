import { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import api from '../../api/client.js';

const EMPTY = {
  legal_name: '', trade_name: '', country: 'Bénin', currency: 'XOF',
  phone: '', email: '', address: '', rccm: '', ifu: '', nif: '', tax_id: '',
  default_tax_rate: 0, invoice_prefix: 'FAC', logo_url: '', signature_url: '', stamp_url: '',
};

export default function CompanySettingsPage() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/erp/company-profile')
      .then(r => setForm({ ...EMPTY, ...(r.data || {}) }))
      .finally(() => setLoading(false));
  }, []);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const save = async e => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.patch('/erp/company-profile', {
        ...form,
        default_tax_rate: Number(form.default_tax_rate || 0),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-gray-500">Chargement…</div>;

  return (
    <form onSubmit={save} className="max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="text-primary" size={22} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon entreprise</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">Informations utilisées sur les devis, factures et documents de l’ERP.</p>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Identité</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Raison sociale" value={form.legal_name} onChange={set('legal_name')} />
          <Field label="Nom commercial" value={form.trade_name} onChange={set('trade_name')} />
          <Field label="Pays" value={form.country} onChange={set('country')} />
          <Select label="Devise" value={form.currency} onChange={set('currency')} options={['XOF', 'EUR', 'USD']} />
          <Field label="Téléphone" value={form.phone} onChange={set('phone')} />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Adresse" value={form.address} onChange={set('address')} className="md:col-span-2" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Informations légales et fiscales</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="RCCM" value={form.rccm} onChange={set('rccm')} />
          <Field label="IFU" value={form.ifu} onChange={set('ifu')} />
          <Field label="NIF" value={form.nif} onChange={set('nif')} />
          <Field label="Identifiant fiscal" value={form.tax_id} onChange={set('tax_id')} />
          <Field label="Taxe par défaut (%)" type="number" value={form.default_tax_rate} onChange={set('default_tax_rate')} />
          <Field label="Préfixe des factures" value={form.invoice_prefix} onChange={set('invoice_prefix')} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Personnalisation des documents</h2>
        <p className="mt-1 text-xs text-gray-500">Les uploads de fichiers seront branchés dans l’étape suivante. Pour la V1, ces champs acceptent des URL.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="URL du logo" value={form.logo_url} onChange={set('logo_url')} />
          <Field label="URL de la signature" value={form.signature_url} onChange={set('signature_url')} />
          <Field label="URL du cachet" value={form.stamp_url} onChange={set('stamp_url')} />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-emerald-600">Enregistré</span>}
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input {...props} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30" />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <select {...props} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30">
        {options.map(option => <option key={option} value={option}>{option === 'XOF' ? 'FCFA (XOF)' : option}</option>)}
      </select>
    </label>
  );
}
