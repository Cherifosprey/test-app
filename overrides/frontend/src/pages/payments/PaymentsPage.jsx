import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Smartphone, Landmark, ReceiptText } from 'lucide-react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/currency.js';

const METHODS = [
  { key: 'cash', label: 'Espèces', icon: Banknote },
  { key: 'bank', label: 'Virement', icon: Landmark },
  { key: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { key: 'card', label: 'Carte', icon: CreditCard },
  { key: 'cheque', label: 'Chèque', icon: ReceiptText },
  { key: 'other', label: 'Autre', icon: ReceiptText },
];

export default function PaymentsPage() {
  const [receivables, setReceivables] = useState([]);
  const [payments, setPayments] = useState([]);
  const [currency, setCurrency] = useState('XOF');
  const [form, setForm] = useState({ invoice_id: '', amount: '', method: 'cash', reference: '', payment_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [receivablesRes, paymentsRes, profileRes] = await Promise.all([
      api.get('/erp/payments/receivables'),
      api.get('/erp/payments/recent'),
      api.get('/erp/company-profile').catch(() => ({ data: { currency: 'XOF' } })),
    ]);
    setReceivables(receivablesRes.data || []);
    setPayments(paymentsRes.data || []);
    setCurrency(profileRes.data?.currency || 'XOF');
  };

  useEffect(() => { load(); }, []);

  const openInvoices = useMemo(
    () => receivables.filter(item => Number(item.balance || 0) > 0),
    [receivables],
  );

  const totalOutstanding = useMemo(
    () => openInvoices.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    [openInvoices],
  );

  const selectedInvoice = useMemo(
    () => openInvoices.find(item => String(item.id) === String(form.invoice_id)),
    [openInvoices, form.invoice_id],
  );

  const chooseInvoice = value => {
    const invoice = openInvoices.find(item => String(item.id) === String(value));
    setForm(prev => ({
      ...prev,
      invoice_id: value,
      amount: invoice ? String(Number(invoice.balance || 0)) : '',
    }));
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.invoice_id) return;
    setSaving(true);
    try {
      await api.post(`/erp/payments/invoice/${form.invoice_id}`, {
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || null,
        payment_date: form.payment_date,
        notes: form.notes || null,
      });
      setForm(prev => ({ ...prev, invoice_id: '', amount: '', reference: '', notes: '' }));
      await load();
    } catch (error) {
      alert(error?.response?.data?.detail || 'Impossible d’enregistrer le paiement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paiements clients</h1>
        <p className="mt-1 text-sm text-gray-500">Enregistrez les règlements complets ou partiels et suivez les soldes des factures.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Factures à encaisser" value={openInvoices.length} />
        <Summary label="Montant restant" value={formatCurrency(totalOutstanding, currency)} />
        <Summary label="Règlements enregistrés" value={payments.length} />
      </div>

      <form onSubmit={submit} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Nouveau règlement</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block lg:col-span-2">
            <span className="text-xs font-semibold text-gray-500">Facture</span>
            <select required value={form.invoice_id} onChange={e => chooseInvoice(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm">
              <option value="">Sélectionner une facture…</option>
              {openInvoices.map(invoice => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} — {invoice.customer_name} — reste {formatCurrency(invoice.balance, currency)}
                </option>
              ))}
            </select>
          </label>
          <Field label="Montant" required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <Field label="Date" required type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
        </div>

        {selectedInvoice && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
            Total : <strong>{formatCurrency(selectedInvoice.total, currency)}</strong> · Déjà payé : <strong>{formatCurrency(selectedInvoice.paid_amount, currency)}</strong> · Solde : <strong>{formatCurrency(selectedInvoice.balance, currency)}</strong>
          </div>
        )}

        <div>
          <span className="text-xs font-semibold text-gray-500">Mode de paiement</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {METHODS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setForm(f => ({ ...f, method: key }))} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${form.method === key ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Référence" placeholder="Transaction, chèque, reçu…" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
          <Field label="Notes" placeholder="Commentaire facultatif" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div className="flex justify-end">
          <button disabled={saving || !openInvoices.length} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer le paiement'}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Historique des règlements</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs uppercase text-gray-500"><th className="py-2">Date</th><th>Facture</th><th>Client</th><th>Mode</th><th>Référence</th><th className="text-right">Montant</th></tr></thead>
            <tbody>
              {payments.map(payment => (
                <tr key={payment.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-3">{String(payment.payment_date)}</td>
                  <td className="font-mono text-xs font-semibold">{payment.invoice_number}</td>
                  <td>{payment.customer_name}</td>
                  <td>{methodLabel(payment.method)}</td>
                  <td>{payment.reference || '—'}</td>
                  <td className="text-right font-semibold">{formatCurrency(payment.amount, currency)}</td>
                </tr>
              ))}
              {!payments.length && <tr><td colSpan="6" className="py-10 text-center text-gray-400">Aucun règlement enregistré.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function methodLabel(key) {
  return METHODS.find(method => method.key === key)?.label || key;
}

function Summary({ label, value }) {
  return <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"><p className="text-xs font-medium text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p></div>;
}

function Field({ label, ...props }) {
  return <label className="block"><span className="text-xs font-semibold text-gray-500">{label}</span><input {...props} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}
