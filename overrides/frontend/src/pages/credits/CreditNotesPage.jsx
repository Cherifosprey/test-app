import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileMinus2, Plus, RotateCcw } from 'lucide-react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/currency.js';

const METHODS = [
  ['cash', 'Espèces'], ['bank', 'Virement bancaire'], ['mobile_money', 'Mobile Money'],
  ['card', 'Carte'], ['cheque', 'Chèque'], ['other', 'Autre'],
];

export default function CreditNotesPage() {
  const [company, setCompany] = useState({ currency: 'XOF', locale: 'fr-FR' });
  const [eligible, setEligible] = useState([]);
  const [credits, setCredits] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [showCredit, setShowCredit] = useState(false);
  const [refunding, setRefunding] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [creditForm, setCreditForm] = useState({ invoice_id: '', amount: '', reason: '' });
  const [refundForm, setRefundForm] = useState({ amount: '', method: 'bank', reference: '', notes: '' });

  const load = async () => {
    setError('');
    try {
      const [companyRes, eligibleRes, creditsRes, refundsRes] = await Promise.all([
        api.get('/erp/company-profile').catch(() => ({ data: {} })),
        api.get('/erp/credits/eligible-invoices'),
        api.get('/erp/credits'),
        api.get('/erp/credits/refunds/recent'),
      ]);
      setCompany(prev => ({ ...prev, ...(companyRes.data || {}) }));
      setEligible(eligibleRes.data || []);
      setCredits(creditsRes.data || []);
      setRefunds(refundsRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger les avoirs.');
    }
  };

  useEffect(() => { load(); }, []);

  const money = value => formatCurrency(value, company.currency || 'XOF', company.locale || 'fr-FR');
  const totalCredits = useMemo(() => credits.reduce((sum, item) => sum + Number(item.amount || 0), 0), [credits]);
  const totalRefunded = useMemo(() => refunds.reduce((sum, item) => sum + Number(item.amount || 0), 0), [refunds]);
  const selectedInvoice = eligible.find(item => String(item.id) === String(creditForm.invoice_id));

  const createCredit = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/erp/credits', {
        invoice_id: Number(creditForm.invoice_id),
        amount: Number(creditForm.amount),
        reason: creditForm.reason,
      });
      setCreditForm({ invoice_id: '', amount: '', reason: '' });
      setShowCredit(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de créer l’avoir.');
    } finally { setSaving(false); }
  };

  const refund = async e => {
    e.preventDefault();
    if (!refunding) return;
    setSaving(true); setError('');
    try {
      await api.post(`/erp/credits/${refunding.id}/refunds`, {
        amount: Number(refundForm.amount),
        method: refundForm.method,
        reference: refundForm.reference || null,
        notes: refundForm.notes || null,
      });
      setRefunding(null);
      setRefundForm({ amount: '', method: 'bank', reference: '', notes: '' });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible d’enregistrer le remboursement.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Avoirs & remboursements</h1><p className="mt-1 text-sm text-gray-500">Corrigez une facture envoyée sans la modifier et remboursez les montants déjà encaissés.</p></div>
        <button onClick={() => setShowCredit(v => !v)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> Nouvel avoir</button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3"><Metric icon={FileMinus2} label="Avoirs émis" value={String(credits.length)} /><Metric icon={CreditCard} label="Montant crédité" value={money(totalCredits)} /><Metric icon={RotateCcw} label="Montant remboursé" value={money(totalRefunded)} /></div>

      {showCredit && <form onSubmit={createCredit} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="font-semibold">Créer un avoir</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label><Label>Facture *</Label><select required value={creditForm.invoice_id} onChange={e => { const item = eligible.find(i => String(i.id) === e.target.value); setCreditForm(f => ({ ...f, invoice_id: e.target.value, amount: item ? String(item.credit_available) : '' })); }} className={control}><option value="">Sélectionner…</option>{eligible.map(item => <option key={item.id} value={item.id}>{item.invoice_number} — {item.customer_name}</option>)}</select></label>
          <Input label="Montant de l’avoir *" required type="number" min="0.01" max={selectedInvoice ? Number(selectedInvoice.credit_available) : undefined} step="0.01" value={creditForm.amount} onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))} />
          <Input label="Motif *" required value={creditForm.reason} onChange={e => setCreditForm(f => ({ ...f, reason: e.target.value }))} placeholder="Retour, erreur de prix, geste commercial…" />
        </div>
        {selectedInvoice && <p className="mt-2 text-xs text-gray-500">Montant encore créditable sur la facture : <strong>{money(selectedInvoice.credit_available)}</strong>.</p>}
        <div className="mt-4 flex justify-end"><Submit saving={saving}>Émettre l’avoir</Submit></div>
      </form>}

      {refunding && <form onSubmit={refund} className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Rembourser {refunding.credit_number}</h2><p className="mt-1 text-sm text-gray-500">{refunding.customer_name} · Solde de l’avoir {money(refunding.refundable_balance)}</p></div><button type="button" onClick={() => setRefunding(null)} className="text-sm text-gray-500">Fermer</button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Input label="Montant *" required type="number" min="0.01" max={Number(refunding.refundable_balance)} step="0.01" value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} /><label><Label>Mode</Label><select value={refundForm.method} onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))} className={control}>{METHODS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><Input label="Référence" value={refundForm.reference} onChange={e => setRefundForm(f => ({ ...f, reference: e.target.value }))} /><Input label="Notes" value={refundForm.notes} onChange={e => setRefundForm(f => ({ ...f, notes: e.target.value }))} /></div>
        <p className="mt-3 text-xs text-gray-500">Le serveur limite automatiquement le remboursement au montant réellement encaissé sur la facture.</p>
        <div className="mt-4 flex justify-end"><Submit saving={saving}>Enregistrer le remboursement</Submit></div>
      </form>}

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><h2 className="font-semibold">Avoirs</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="py-2">N° avoir</th><th>Facture</th><th>Client</th><th>Montant</th><th>Remboursé</th><th>Solde avoir</th><th>Statut</th><th></th></tr></thead><tbody>{credits.map(item => <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50"><td className="py-3 font-mono text-xs font-semibold">{item.credit_number}</td><td className="font-mono text-xs">{item.invoice_number}</td><td>{item.customer_name}</td><td>{money(item.amount)}</td><td>{money(item.refunded_amount)}</td><td className="font-semibold">{money(item.refundable_balance)}</td><td><Status value={item.status} /></td><td>{Number(item.refundable_balance) > 0 && <button onClick={() => { setRefunding(item); setRefundForm(f => ({ ...f, amount: String(item.refundable_balance) })); }} className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium hover:border-primary hover:text-primary dark:border-gray-700">Rembourser</button>}</td></tr>)}{!credits.length && <tr><td colSpan="8" className="py-10 text-center text-gray-400">Aucun avoir.</td></tr>}</tbody></table></div></section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><h2 className="font-semibold">Derniers remboursements</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="py-2">Date</th><th>Avoir</th><th>Facture</th><th>Client</th><th>Mode</th><th>Référence</th><th>Montant</th></tr></thead><tbody>{refunds.map(item => <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50"><td className="py-3">{item.refund_date}</td><td className="font-mono text-xs">{item.credit_number}</td><td className="font-mono text-xs">{item.invoice_number}</td><td>{item.customer_name}</td><td>{methodLabel(item.method)}</td><td>{item.reference || '—'}</td><td className="font-semibold">{money(item.amount)}</td></tr>)}{!refunds.length && <tr><td colSpan="7" className="py-8 text-center text-gray-400">Aucun remboursement.</td></tr>}</tbody></table></div></section>
    </div>
  );
}

const control = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-950';
function Label({ children }) { return <span className="text-xs font-semibold text-gray-500">{children}</span>; }
function Input({ label, ...props }) { return <label className="block"><Label>{label}</Label><input {...props} className={control} /></label>; }
function Submit({ saving, children }) { return <button disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : children}</button>; }
function Metric({ icon: Icon, label, value }) { return <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-2 text-sm text-gray-500"><Icon size={16} className="text-primary" />{label}</div><div className="mt-2 text-xl font-bold">{value}</div></div>; }
function Status({ value }) { const labels = { issued: 'Émis', partial_refund: 'Remboursé en partie', refunded: 'Remboursé' }; return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium dark:bg-gray-800">{labels[value] || value}</span>; }
function methodLabel(value) { return Object.fromEntries(METHODS)[value] || value; }
