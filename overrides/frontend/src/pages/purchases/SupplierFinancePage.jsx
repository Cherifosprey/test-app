import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText, Plus, Wallet } from 'lucide-react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/currency.js';

const PAYMENT_METHODS = [
  ['cash', 'Espèces'],
  ['bank', 'Virement bancaire'],
  ['mobile_money', 'Mobile Money'],
  ['card', 'Carte'],
  ['cheque', 'Chèque'],
  ['other', 'Autre'],
];

export default function SupplierFinancePage() {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [paying, setPaying] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [invoiceForm, setInvoiceForm] = useState({
    supplier_id: '', purchase_order_id: '', invoice_number: '', invoice_date: '', due_date: '',
    currency: 'XOF', subtotal: '', tax_amount: '0', notes: '',
  });
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank', reference: '', notes: '' });

  const load = async () => {
    setError('');
    try {
      const [suppliersRes, ordersRes, invoicesRes, paymentsRes] = await Promise.all([
        api.get('/erp/purchases/suppliers'),
        api.get('/erp/purchases/orders'),
        api.get('/erp/supplier-finance/invoices'),
        api.get('/erp/supplier-finance/payments/recent'),
      ]);
      setSuppliers(suppliersRes.data || []);
      setOrders(ordersRes.data || []);
      setInvoices(invoicesRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger les données fournisseurs.');
    }
  };

  useEffect(() => { load(); }, []);

  const openBalance = useMemo(() => invoices.reduce((sum, item) => sum + Number(item.balance || 0), 0), [invoices]);
  const paidTotal = useMemo(() => payments.reduce((sum, item) => sum + Number(item.amount || 0), 0), [payments]);

  const supplierOrders = orders.filter(order => String(order.supplier_id) === String(invoiceForm.supplier_id));

  const createInvoice = async e => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/erp/supplier-finance/invoices', {
        supplier_id: Number(invoiceForm.supplier_id),
        purchase_order_id: invoiceForm.purchase_order_id ? Number(invoiceForm.purchase_order_id) : null,
        invoice_number: invoiceForm.invoice_number,
        invoice_date: invoiceForm.invoice_date || undefined,
        due_date: invoiceForm.due_date || null,
        currency: invoiceForm.currency,
        subtotal: Number(invoiceForm.subtotal || 0),
        tax_amount: Number(invoiceForm.tax_amount || 0),
        notes: invoiceForm.notes || null,
      });
      setInvoiceForm({ supplier_id: '', purchase_order_id: '', invoice_number: '', invoice_date: '', due_date: '', currency: 'XOF', subtotal: '', tax_amount: '0', notes: '' });
      setShowInvoice(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible d’enregistrer la facture fournisseur.');
    } finally { setSaving(false); }
  };

  const recordPayment = async e => {
    e.preventDefault();
    if (!paying) return;
    setSaving(true); setError('');
    try {
      await api.post(`/erp/supplier-finance/invoices/${paying.id}/payments`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || null,
        notes: paymentForm.notes || null,
      });
      setPaying(null);
      setPaymentForm({ amount: '', method: 'bank', reference: '', notes: '' });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible d’enregistrer le règlement fournisseur.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Factures & règlements fournisseurs</h1>
          <p className="mt-1 text-sm text-gray-500">Suivez les dettes fournisseurs, les échéances et les paiements.</p>
        </div>
        <button onClick={() => setShowInvoice(v => !v)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">
          <Plus size={16} /> Nouvelle facture fournisseur
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={FileText} label="Factures fournisseurs" value={String(invoices.length)} />
        <Metric icon={Wallet} label="Solde à payer" value={formatCurrency(openBalance, 'XOF')} />
        <Metric icon={CreditCard} label="Règlements enregistrés" value={formatCurrency(paidTotal, 'XOF')} />
      </div>

      {showInvoice && (
        <form onSubmit={createInvoice} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-white">Enregistrer une facture fournisseur</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="block"><Label>Fournisseur *</Label><select required value={invoiceForm.supplier_id} onChange={e => setInvoiceForm(f => ({ ...f, supplier_id: e.target.value, purchase_order_id: '' }))} className={control}><option value="">Sélectionner…</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="block"><Label>Bon de commande</Label><select value={invoiceForm.purchase_order_id} onChange={e => setInvoiceForm(f => ({ ...f, purchase_order_id: e.target.value }))} className={control}><option value="">Aucun</option>{supplierOrders.map(o => <option key={o.id} value={o.id}>{o.po_number} — {formatCurrency(o.total_amount, o.currency)}</option>)}</select></label>
            <Input label="N° facture fournisseur *" required value={invoiceForm.invoice_number} onChange={e => setInvoiceForm(f => ({ ...f, invoice_number: e.target.value }))} />
            <Input label="Date facture" type="date" value={invoiceForm.invoice_date} onChange={e => setInvoiceForm(f => ({ ...f, invoice_date: e.target.value }))} />
            <Input label="Échéance" type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))} />
            <label className="block"><Label>Devise</Label><select value={invoiceForm.currency} onChange={e => setInvoiceForm(f => ({ ...f, currency: e.target.value }))} className={control}><option value="XOF">FCFA (XOF)</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
            <Input label="Montant HT *" required type="number" min="0" step="0.01" value={invoiceForm.subtotal} onChange={e => setInvoiceForm(f => ({ ...f, subtotal: e.target.value }))} />
            <Input label="Taxes" type="number" min="0" step="0.01" value={invoiceForm.tax_amount} onChange={e => setInvoiceForm(f => ({ ...f, tax_amount: e.target.value }))} />
            <Input label="Notes" value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="mt-4 flex justify-end"><button disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer la facture'}</button></div>
        </form>
      )}

      {paying && (
        <form onSubmit={recordPayment} className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold">Régler {paying.invoice_number}</h2><p className="text-sm text-gray-500">{paying.supplier_name} · Solde {formatCurrency(paying.balance, paying.currency)}</p></div>
            <button type="button" onClick={() => setPaying(null)} className="text-sm text-gray-500">Fermer</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input label="Montant *" required type="number" min="0.01" max={Number(paying.balance)} step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
            <label className="block"><Label>Mode</Label><select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} className={control}>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <Input label="Référence" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} />
            <Input label="Notes" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="mt-4 flex justify-end"><button disabled={saving} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer le règlement'}</button></div>
        </form>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="font-semibold">Dettes fournisseurs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="py-2">Facture</th><th>Fournisseur</th><th>Échéance</th><th>Total</th><th>Payé</th><th>Solde</th><th>Statut</th><th></th></tr></thead>
            <tbody>{invoices.map(item => <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50"><td className="py-3 font-mono text-xs font-semibold">{item.invoice_number}</td><td>{item.supplier_name}</td><td>{item.due_date || '—'}</td><td>{formatCurrency(item.total_amount, item.currency)}</td><td>{formatCurrency(item.paid_amount, item.currency)}</td><td className="font-semibold">{formatCurrency(item.balance, item.currency)}</td><td><Status value={item.status} /></td><td>{Number(item.balance) > 0 && <button onClick={() => { setPaying(item); setPaymentForm(f => ({ ...f, amount: String(item.balance) })); }} className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium hover:border-primary hover:text-primary dark:border-gray-700">Régler</button>}</td></tr>)}{!invoices.length && <tr><td colSpan="8" className="py-10 text-center text-gray-400">Aucune facture fournisseur.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="font-semibold">Derniers règlements fournisseurs</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="py-2">Date</th><th>Fournisseur</th><th>Facture</th><th>Mode</th><th>Référence</th><th>Montant</th></tr></thead><tbody>{payments.map(item => <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50"><td className="py-3">{item.payment_date}</td><td>{item.supplier_name}</td><td className="font-mono text-xs">{item.invoice_number}</td><td>{methodLabel(item.method)}</td><td>{item.reference || '—'}</td><td className="font-semibold">{formatCurrency(item.amount, 'XOF')}</td></tr>)}{!payments.length && <tr><td colSpan="6" className="py-8 text-center text-gray-400">Aucun règlement fournisseur.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}

const control = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-950';
function Label({ children }) { return <span className="text-xs font-semibold text-gray-500">{children}</span>; }
function Input({ label, ...props }) { return <label className="block"><Label>{label}</Label><input {...props} className={control} /></label>; }
function Metric({ icon: Icon, label, value }) { return <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-2 text-sm text-gray-500"><Icon size={16} className="text-primary" />{label}</div><div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{value}</div></div>; }
function Status({ value }) { const labels = { open: 'À payer', partial: 'Partiel', paid: 'Payée' }; return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium dark:bg-gray-800">{labels[value] || value}</span>; }
function methodLabel(value) { return Object.fromEntries(PAYMENT_METHODS)[value] || value; }
