import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../api/client.js';
import { friendlyError } from '../../utils/errorUtils.js';
import { formatCurrency } from '../../utils/currency.js';

const today = () => new Date().toISOString().slice(0, 10);
const newLine = rate => ({ _key: Math.random(), product_id: '', description: '', hsn_code: '', qty: 1, unit_price: '', discount_amount: 0, tax_rate: rate ?? 0 });

export default function InvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQuoteId = searchParams.get('from_quote');
  const isEdit = Boolean(id);

  const [company, setCompany] = useState({ currency: 'XOF', locale: 'fr-FR', tax_name: 'TVA', default_tax_rate: 0, prices_include_tax: false, tax_registration_label: 'Identifiant fiscal' });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceMessage, setSourceMessage] = useState('');
  const [form, setForm] = useState({ customer_id: '', customer_name: '', customer_gstin: '', customer_address: '', invoice_date: today(), due_date: '', notes: '' });
  const [lines, setLines] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [companyRes, customersRes, productsRes] = await Promise.all([
          api.get('/erp/company-profile').catch(() => ({ data: {} })),
          api.get('/contacts/customers', { params: { limit: 200 } }).catch(() => ({ data: [] })),
          api.get('/products', { params: { limit: 500 } }).catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        const cfg = { ...company, ...(companyRes.data || {}) };
        setCompany(cfg);
        setCustomers(customersRes.data || []);
        setProducts(productsRes.data || []);

        if (isEdit) {
          const { data: inv } = await api.get(`/invoices/${id}`);
          if (inv.status !== 'draft') { navigate(`/invoices/${id}`, { replace: true }); return; }
          setForm({
            customer_id: inv.customer_id || '', customer_name: inv.customer_name || '', customer_gstin: inv.customer_gstin || '',
            customer_address: inv.customer_address || '', invoice_date: inv.invoice_date || today(), due_date: inv.due_date || '', notes: inv.notes || '',
          });
          setLines((inv.lines || []).map(line => fromBackendLine(line, cfg)));
        } else if (fromQuoteId) {
          const { data: quote } = await api.get(`/quotations/${fromQuoteId}`);
          setForm(prev => ({ ...prev, customer_id: quote.customer_id || '', customer_name: quote.customer_name || '', customer_gstin: quote.customer_gstin || '', customer_address: quote.customer_address || '' }));
          const productLines = (quote.lines || []).filter(line => !line.line_type || line.line_type === 'product');
          setLines(productLines.length ? productLines.map(line => fromBackendLine(line, cfg)) : [newLine(Number(cfg.default_tax_rate || 0))]);
          setSourceMessage(`Préremplie depuis le devis ${quote.quote_number}. Vérifiez les montants avant enregistrement.`);
        } else {
          setLines([newLine(Number(cfg.default_tax_rate || 0))]);
        }
      } catch (err) {
        alert(friendlyError(err));
        if (isEdit) navigate('/invoices');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, isEdit, fromQuoteId]);

  const totals = useMemo(() => calculateTotals(lines, !!company.prices_include_tax), [lines, company.prices_include_tax]);
  const money = value => formatCurrency(value, company.currency || 'XOF', company.locale || 'fr-FR');
  const taxName = company.tax_name || 'Taxe';

  const setField = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setLine = (index, key, value) => setLines(prev => prev.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const addLine = () => setLines(prev => [...prev, newLine(Number(company.default_tax_rate || 0))]);
  const removeLine = index => setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));

  const selectCustomer = value => {
    const customer = customers.find(item => String(item.id) === String(value));
    if (!customer) { setForm(prev => ({ ...prev, customer_id: '' })); return; }
    setForm(prev => ({
      ...prev,
      customer_id: customer.id,
      customer_name: customer.name || '',
      customer_gstin: customer.gstin || customer.tax_id || '',
      customer_address: customer.billing_address || customer.address || '',
    }));
  };

  const selectProduct = (index, value) => {
    const product = products.find(item => String(item.id) === String(value));
    if (!product) { setLine(index, 'product_id', ''); return; }
    setLines(prev => prev.map((line, i) => i === index ? {
      ...line,
      product_id: product.id,
      description: product.name || line.description,
      hsn_code: product.sku || product.hsn_sac || '',
      unit_price: product.selling_price ?? '',
      tax_rate: Number(company.default_tax_rate ?? product.gst_rate ?? 0),
    } : line));
  };

  const submit = async e => {
    e.preventDefault();
    const validLines = lines.filter(line => String(line.description || '').trim());
    if (!form.customer_name.trim()) { alert('Le nom du client est obligatoire.'); return; }
    if (!validLines.length) { alert('Ajoutez au moins une ligne de facture.'); return; }

    setSaving(true);
    try {
      const payload = {
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        customer_name: form.customer_name,
        customer_gstin: form.customer_gstin || null,
        customer_address: form.customer_address || null,
        invoice_date: form.invoice_date || today(),
        due_date: form.due_date || null,
        place_of_supply: '00',
        notes: form.notes || null,
        lines: validLines.map(line => toBackendLine(line, !!company.prices_include_tax)),
      };
      const { data } = isEdit ? await api.patch(`/invoices/${id}`, payload) : await api.post('/invoices', payload);
      navigate(`/invoices/${data.id}`);
    } catch (err) {
      alert(friendlyError(err));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20 text-sm text-gray-500">Chargement…</div>;

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6 pb-12">
      {sourceMessage && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{sourceMessage}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEdit ? 'Modifier la facture' : 'Nouvelle facture'}</h1><p className="mt-1 text-sm text-gray-500">{taxName} {Number(company.default_tax_rate || 0)}% · {company.currency === 'XOF' ? 'FCFA' : company.currency} · prix {company.prices_include_tax ? 'TTC' : 'HT'}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">Annuler</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button></div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Client</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label><Label>Client existant</Label><select value={form.customer_id} onChange={e => selectCustomer(e.target.value)} className={control}><option value="">Saisie manuelle</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Input label="Nom du client *" required value={form.customer_name} onChange={setField('customer_name')} />
          <Input label={company.tax_registration_label || 'Identifiant fiscal'} value={form.customer_gstin} onChange={setField('customer_gstin')} />
          <Input label="Adresse de facturation" value={form.customer_address} onChange={setField('customer_address')} />
          <Input label="Date de facture" type="date" value={form.invoice_date} onChange={setField('invoice_date')} />
          <Input label="Échéance" type="date" value={form.due_date} onChange={setField('due_date')} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800"><h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Articles / services</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50"><th className="px-3 py-2">Produit</th><th>Description</th><th>Réf.</th><th>Qté</th><th>Prix {company.prices_include_tax ? 'TTC' : 'HT'}</th><th>Remise</th><th>{taxName} %</th><th>Total</th><th></th></tr></thead>
            <tbody>{lines.map((line, index) => {
              const calc = calculateLine(line, !!company.prices_include_tax);
              return <tr key={line._key} className="border-t border-gray-100 dark:border-gray-800"><td className="p-2"><select value={line.product_id} onChange={e => selectProduct(index, e.target.value)} className={smallControl}><option value="">Libre</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td><td className="p-2"><input required value={line.description} onChange={e => setLine(index, 'description', e.target.value)} className={smallControl} /></td><td className="p-2"><input value={line.hsn_code} onChange={e => setLine(index, 'hsn_code', e.target.value)} className={smallControl} /></td><td className="p-2"><input type="number" min="0.01" step="0.01" value={line.qty} onChange={e => setLine(index, 'qty', e.target.value)} className={smallControl} /></td><td className="p-2"><input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => setLine(index, 'unit_price', e.target.value)} className={smallControl} /></td><td className="p-2"><input type="number" min="0" step="0.01" value={line.discount_amount} onChange={e => setLine(index, 'discount_amount', e.target.value)} className={smallControl} /></td><td className="p-2"><input type="number" min="0" max="100" step="0.001" value={line.tax_rate} onChange={e => setLine(index, 'tax_rate', e.target.value)} className={smallControl} /></td><td className="p-2 whitespace-nowrap font-semibold">{money(calc.total)}</td><td className="p-2"><button type="button" onClick={() => removeLine(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800"><button type="button" onClick={addLine} className="inline-flex items-center gap-2 text-sm font-medium text-primary"><Plus size={15} /> Ajouter une ligne</button></div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <label><Label>Notes</Label><textarea rows={5} value={form.notes} onChange={setField('notes')} className={`${control} resize-y`} placeholder="Conditions de paiement, coordonnées bancaires, message client…" /></label>
        <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900"><Summary label="Sous-total" value={money(totals.subtotal)} />{totals.discount > 0 && <Summary label="Remises" value={`− ${money(totals.discount)}`} />}<Summary label="Base taxable" value={money(totals.taxable)} /><Summary label={taxName} value={money(totals.tax)} /><div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-lg font-bold"><span>Total</span><span>{money(totals.total)}</span></div></section>
      </div>
    </form>
  );
}

function calculateLine(line, pricesIncludeTax) {
  const qty = Number(line.qty || 0);
  const enteredUnit = Number(line.unit_price || 0);
  const enteredDiscount = Number(line.discount_amount || 0);
  const rate = Number(line.tax_rate || 0) / 100;
  const enteredAmount = Math.max(0, qty * enteredUnit - enteredDiscount);
  const taxable = pricesIncludeTax && rate > 0 ? enteredAmount / (1 + rate) : enteredAmount;
  const tax = pricesIncludeTax ? enteredAmount - taxable : taxable * rate;
  return { grossBeforeDiscount: qty * enteredUnit, discount: enteredDiscount, taxable, tax, total: taxable + tax };
}

function calculateTotals(lines, pricesIncludeTax) {
  return lines.reduce((acc, line) => {
    const calc = calculateLine(line, pricesIncludeTax);
    acc.subtotal += calc.grossBeforeDiscount;
    acc.discount += calc.discount;
    acc.taxable += calc.taxable;
    acc.tax += calc.tax;
    acc.total += calc.total;
    return acc;
  }, { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 });
}

function toBackendLine(line, pricesIncludeTax) {
  const qty = Number(line.qty || 1);
  const enteredUnit = Number(line.unit_price || 0);
  const enteredDiscount = Number(line.discount_amount || 0);
  const ratePct = Number(line.tax_rate || 0);
  const factor = pricesIncludeTax && ratePct > 0 ? 1 + ratePct / 100 : 1;
  return {
    product_id: line.product_id ? Number(line.product_id) : null,
    description: line.description,
    hsn_code: line.hsn_code || null,
    qty,
    unit_price: enteredUnit / factor,
    discount_amount: enteredDiscount / factor,
    gst_rate: ratePct,
  };
}

function fromBackendLine(line, company) {
  const ratePct = Number(line.gst_rate ?? company.default_tax_rate ?? 0);
  const factor = company.prices_include_tax && ratePct > 0 ? 1 + ratePct / 100 : 1;
  return {
    _key: Math.random(),
    product_id: line.product_id || '',
    description: line.description || '',
    hsn_code: line.hsn_code || '',
    qty: line.qty || 1,
    unit_price: Number(line.unit_price || 0) * factor,
    discount_amount: Number(line.discount_amount || 0) * factor,
    tax_rate: ratePct,
  };
}

const control = 'mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-950';
const smallControl = 'w-full min-w-[90px] rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 dark:border-gray-700 dark:bg-gray-950';
function Label({ children }) { return <span className="text-xs font-medium text-gray-500">{children}</span>; }
function Input({ label, ...props }) { return <label><Label>{label}</Label><input {...props} className={control} /></label>; }
function Summary({ label, value }) { return <div className="mb-2 flex justify-between text-gray-600 dark:text-gray-400"><span>{label}</span><span>{value}</span></div>; }
