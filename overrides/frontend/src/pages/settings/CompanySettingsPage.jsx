import { useEffect, useState } from 'react';
import { Building2, ImagePlus, Save, Trash2 } from 'lucide-react';
import api from '../../api/client.js';

const EMPTY = {
  legal_name: '', trade_name: '', country: 'Bénin', locale: 'fr-FR', currency: 'XOF',
  phone: '', email: '', address: '', rccm: '', ifu: '', nif: '', tax_id: '',
  tax_name: 'TVA', tax_registration_label: 'Identifiant fiscal', default_tax_rate: 0,
  prices_include_tax: false, tax_exemption_note: '', invoice_prefix: 'FAC', invoice_footer: '',
  logo_url: '', signature_url: '', stamp_url: '',
};

export default function CompanySettingsPage() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/erp/company-profile')
      .then(r => setForm({ ...EMPTY, ...(r.data || {}) }))
      .catch(err => setError(err?.response?.data?.detail || 'Impossible de charger la fiche entreprise.'))
      .finally(() => setLoading(false));
  }, []);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setBool = key => e => setForm(prev => ({ ...prev, [key]: e.target.checked }));
  const payload = source => ({ ...source, default_tax_rate: Number(source.default_tax_rate || 0) });

  const save = async e => {
    e?.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.patch('/erp/company-profile', payload(form));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible d’enregistrer les paramètres.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (key, file) => {
    if (!file) return;
    setUploading(key);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post('/media/upload?category=documents', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const next = { ...form, [key]: data.url };
      setForm(next);
      await api.patch('/erp/company-profile', payload(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Échec de l’upload. Utilisez une image JPG, PNG ou WebP valide.');
    } finally {
      setUploading('');
    }
  };

  const clearAsset = key => setForm(prev => ({ ...prev, [key]: '' }));

  if (loading) return <div className="p-8 text-sm text-gray-500">Chargement…</div>;

  return (
    <form onSubmit={save} className="max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="text-primary" size={22} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon entreprise</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">Informations utilisées sur les devis, factures, achats et documents de l’ERP.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Identité</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Raison sociale" value={form.legal_name} onChange={set('legal_name')} />
          <Field label="Nom commercial" value={form.trade_name} onChange={set('trade_name')} />
          <Field label="Pays" value={form.country} onChange={set('country')} />
          <Select label="Langue / format" value={form.locale} onChange={set('locale')} options={['fr-FR', 'fr-BJ', 'fr-SN', 'fr-CI', 'fr-ML', 'fr-TG', 'fr-BF', 'en-US']} />
          <Select label="Devise" value={form.currency} onChange={set('currency')} options={['XOF', 'EUR', 'USD']} />
          <Field label="Téléphone" value={form.phone} onChange={set('phone')} />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Adresse" value={form.address} onChange={set('address')} className="md:col-span-2" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Informations légales</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="RCCM" value={form.rccm} onChange={set('rccm')} />
          <Field label="IFU" value={form.ifu} onChange={set('ifu')} />
          <Field label="NIF" value={form.nif} onChange={set('nif')} />
          <Field label={form.tax_registration_label || 'Identifiant fiscal'} value={form.tax_id} onChange={set('tax_id')} />
          <Field label="Préfixe des factures" value={form.invoice_prefix} onChange={set('invoice_prefix')} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Fiscalité multi-pays</h2>
        <p className="mt-1 text-xs text-gray-500">Configurez la taxe selon le pays du client : TVA, taxe locale, exonération ou taux zéro.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Nom de la taxe" value={form.tax_name} onChange={set('tax_name')} placeholder="TVA" />
          <Field label="Libellé de l’identifiant fiscal" value={form.tax_registration_label} onChange={set('tax_registration_label')} placeholder="IFU / NIF / N° TVA" />
          <Field label="Taux par défaut (%)" type="number" min="0" max="100" step="0.001" value={form.default_tax_rate} onChange={set('default_tax_rate')} />
        </div>
        <label className="mt-4 flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 p-3">
          <input type="checkbox" checked={!!form.prices_include_tax} onChange={setBool('prices_include_tax')} className="h-4 w-4 rounded border-gray-300" />
          <span><span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Les prix saisis incluent déjà la taxe</span><span className="block text-xs text-gray-500">Activez cette option si vos prix catalogue sont TTC.</span></span>
        </label>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Textarea label="Mention d’exonération" rows={3} value={form.tax_exemption_note || ''} onChange={set('tax_exemption_note')} placeholder="Ex. TVA non applicable / Exonéré selon…" />
          <Textarea label="Pied de facture" rows={3} value={form.invoice_footer || ''} onChange={set('invoice_footer')} placeholder="Mentions légales, conditions ou informations de paiement…" />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Identité visuelle des documents</h2>
        <p className="mt-1 text-xs text-gray-500">Importez directement les images utilisées sur les devis et factures. Elles sont isolées dans l’espace de l’entreprise.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <AssetUpload label="Logo" value={form.logo_url} uploading={uploading === 'logo_url'} onFile={file => uploadAsset('logo_url', file)} onClear={() => clearAsset('logo_url')} />
          <AssetUpload label="Signature" value={form.signature_url} uploading={uploading === 'signature_url'} onFile={file => uploadAsset('signature_url', file)} onClear={() => clearAsset('signature_url')} />
          <AssetUpload label="Cachet" value={form.stamp_url} uploading={uploading === 'stamp_url'} onFile={file => uploadAsset('stamp_url', file)} onClear={() => clearAsset('stamp_url')} />
        </div>
        <details className="mt-4 text-xs text-gray-500"><summary className="cursor-pointer font-medium">Utiliser une URL manuelle</summary><div className="mt-3 grid gap-4 md:grid-cols-3"><Field label="URL du logo" value={form.logo_url} onChange={set('logo_url')} /><Field label="URL de la signature" value={form.signature_url} onChange={set('signature_url')} /><Field label="URL du cachet" value={form.stamp_url} onChange={set('stamp_url')} /></div></details>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-medium text-emerald-600">Enregistré</span>}
        <button type="submit" disabled={saving || !!uploading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function AssetUpload({ label, value, uploading, onFile, onClear }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <div className="mt-2 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/60">
        {value ? <img src={value} alt={label} className="max-h-24 max-w-full object-contain" /> : <ImagePlus size={30} className="text-gray-300" />}
      </div>
      <div className="mt-3 flex gap-2">
        <label className="flex-1 cursor-pointer rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/15">
          {uploading ? 'Upload…' : value ? 'Remplacer' : 'Choisir une image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} />
        </label>
        {value && <button type="button" onClick={onClear} className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:text-red-500 dark:border-gray-700" title={`Supprimer ${label}`}><Trash2 size={15} /></button>}
      </div>
    </div>
  );
}

function Field({ label, className = '', ...props }) {
  return <label className={`block ${className}`}><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span><input {...props} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}
function Textarea({ label, ...props }) {
  return <label className="block"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span><textarea {...props} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30 resize-y" /></label>;
}
function Select({ label, options, ...props }) {
  return <label className="block"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span><select {...props} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30">{options.map(option => <option key={option} value={option}>{option === 'XOF' ? 'FCFA (XOF)' : option}</option>)}</select></label>;
}
