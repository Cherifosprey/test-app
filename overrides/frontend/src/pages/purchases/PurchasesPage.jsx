import { useEffect, useMemo, useState } from 'react';
import { Plus, Truck, ShoppingBag, Trash2 } from 'lucide-react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/currency.js';

const EMPTY_SUPPLIER = { name: '', phone: '', email: '', address: '', tax_id: '' };
const EMPTY_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0 };

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showSupplier, setShowSupplier] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [orderForm, setOrderForm] = useState({ supplier_id: '', currency: 'XOF', notes: '', lines: [{ ...EMPTY_LINE }] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [suppliersRes, ordersRes] = await Promise.all([
      api.get('/erp/purchases/suppliers'),
      api.get('/erp/purchases/orders'),
    ]);
    setSuppliers(suppliersRes.data || []);
    setOrders(ordersRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const draftTotal = useMemo(() => orderForm.lines.reduce((sum, line) => {
    const base = Number(line.quantity || 0) * Number(line.unit_price || 0);
    return sum + base + base * Number(line.tax_rate || 0) / 100;
  }, 0), [orderForm.lines]);

  const createSupplier = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/erp/purchases/suppliers', supplierForm);
      setSupplierForm(EMPTY_SUPPLIER);
      setShowSupplier(false);
      await load();
      setOrderForm(prev => ({ ...prev, supplier_id: String(data.id) }));
    } finally {
      setSaving(false);
    }
  };

  const createOrder = async e => {
    e.preventDefault();
    if (!orderForm.supplier_id) return;
    setSaving(true);
    try {
      await api.post('/erp/purchases/orders', {
        supplier_id: Number(orderForm.supplier_id),
        currency: orderForm.currency,
        notes: orderForm.notes || null,
        lines: orderForm.lines.map(line => ({
          description: line.description,
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
          tax_rate: Number(line.tax_rate || 0),
          product_id: null,
        })),
      });
      setOrderForm({ supplier_id: '', currency: 'XOF', notes: '', lines: [{ ...EMPTY_LINE }] });
      setShowOrder(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, status) => {
    await api.patch(`/erp/purchases/orders/${id}/status`, { status });
    await load();
  };

  const setLine = (index, key, value) => {
    setOrderForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [key]: value } : line),
    }));
  };

  const addLine = () => setOrderForm(prev => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] }));
  const removeLine = index => setOrderForm(prev => ({
    ...prev,
    lines: prev.lines.length === 1 ? prev.lines : prev.lines.filter((_, i) => i !== index),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Achats & Fournisseurs</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez vos fournisseurs et vos bons de commande.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSupplier(v => !v)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium">
            <Truck size={16} /> Fournisseur
          </button>
          <button onClick={() => setShowOrder(v => !v)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
            <Plus size={16} /> Bon de commande
          </button>
        </div>
      </div>

      {showSupplier && (
        <form onSubmit={createSupplier} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">Nouveau fournisseur</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field required placeholder="Nom *" value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} />
            <Field placeholder="Téléphone" value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} />
            <Field type="email" placeholder="Email" value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} />
            <Field placeholder="NIF / Identifiant fiscal" value={supplierForm.tax_id} onChange={e => setSupplierForm(f => ({ ...f, tax_id: e.target.value }))} />
            <Field placeholder="Adresse" value={supplierForm.address} onChange={e => setSupplierForm(f => ({ ...f, address: e.target.value }))} className="lg:col-span-2" />
          </div>
          <div className="mt-4 flex justify-end"><Submit saving={saving}>Enregistrer le fournisseur</Submit></div>
        </form>
      )}

      {showOrder && (
        <form onSubmit={createOrder} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Fournisseur</span>
              <select required value={orderForm.supplier_id} onChange={e => setOrderForm(f => ({ ...f, supplier_id: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm">
                <option value="">Sélectionner…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Devise</span>
              <select value={orderForm.currency} onChange={e => setOrderForm(f => ({ ...f, currency: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm">
                <option value="XOF">FCFA (XOF)</option><option value="EUR">EUR</option><option value="USD">USD</option>
              </select>
            </label>
            <Field label="Notes" placeholder="Référence, livraison…" value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs uppercase text-gray-500"><th className="py-2">Article / service</th><th>Qté</th><th>Prix unitaire</th><th>Taxe %</th><th></th></tr></thead>
              <tbody>
                {orderForm.lines.map((line, index) => (
                  <tr key={index} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-2 pr-2"><Field required placeholder="Description" value={line.description} onChange={e => setLine(index, 'description', e.target.value)} /></td>
                    <td className="pr-2"><Field required type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => setLine(index, 'quantity', e.target.value)} /></td>
                    <td className="pr-2"><Field required type="number" min="0" step="0.01" value={line.unit_price} onChange={e => setLine(index, 'unit_price', e.target.value)} /></td>
                    <td className="pr-2"><Field type="number" min="0" max="100" step="0.01" value={line.tax_rate} onChange={e => setLine(index, 'tax_rate', e.target.value)} /></td>
                    <td><button type="button" onClick={() => removeLine(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addLine} className="text-sm font-medium text-primary">+ Ajouter une ligne</button>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="text-sm text-gray-500">Total estimé <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(draftTotal, orderForm.currency)}</span></div>
            <Submit saving={saving}>Créer le bon de commande</Submit>
          </div>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center gap-2"><Truck size={18} className="text-primary" /><h2 className="font-semibold">Fournisseurs</h2></div>
          <div className="mt-4 space-y-3">
            {suppliers.map(s => <div key={s.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3"><p className="font-medium">{s.name}</p><p className="mt-1 text-xs text-gray-500">{s.phone || s.email || s.tax_id || 'Aucune coordonnée'}</p></div>)}
            {!suppliers.length && <p className="text-sm text-gray-400">Aucun fournisseur.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center gap-2"><ShoppingBag size={18} className="text-primary" /><h2 className="font-semibold">Bons de commande</h2></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs uppercase text-gray-500"><th className="py-2">N°</th><th>Fournisseur</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-3 font-mono text-xs font-semibold">{order.po_number}</td>
                    <td>{order.supplier_name || '—'}</td>
                    <td>{String(order.order_date)}</td>
                    <td className="font-semibold">{formatCurrency(order.total_amount, order.currency)}</td>
                    <td>
                      <select value={order.status} onChange={e => changeStatus(order.id, e.target.value)} className="rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-xs">
                        <option value="draft">Brouillon</option><option value="ordered">Commandé</option><option value="received">Reçu</option><option value="cancelled">Annulé</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!orders.length && <tr><td colSpan="5" className="py-8 text-center text-gray-400">Aucun bon de commande.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, className = '', ...props }) {
  return <label className={`block ${className}`}>{label && <span className="text-xs font-semibold text-gray-500">{label}</span>}<input {...props} className={`${label ? 'mt-1 ' : ''}w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30`} /></label>;
}

function Submit({ saving, children }) {
  return <button disabled={saving} type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : children}</button>;
}
