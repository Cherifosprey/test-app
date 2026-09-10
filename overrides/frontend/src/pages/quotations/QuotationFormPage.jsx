import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client.js';
import { friendlyError } from '../../utils/errorUtils.js';
import { formatCurrency } from '../../utils/currency.js';

const today = () => new Date().toISOString().slice(0, 10);
const productLine = (rate = 0, sequence = 10) => ({ _key: Math.random(), line_type: 'product', sequence, product_id: '', description: '', hsn_code: '', qty: 1, unit_price: '', discount_amount: 0, tax_rate: rate });
const textLine = (type, sequence) => ({ _key: Math.random(), line_type: type, sequence, product_id: '', description: '', hsn_code: '', qty: 0, unit_price: 0, discount_amount: 0, tax_rate: 0 });

export default function QuotationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [company, setCompany] = useState({ currency: 'XOF', locale: 'fr-FR', tax_name: 'TVA', default_tax_rate: 0, prices_include_tax: false, tax_registration_label: 'Identifiant fiscal' });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: '', customer_name: '', customer_gstin: '', customer_address: '', quote_date: today(), valid_until: '', payment_terms: '', notes: '', terms_conditions: '' });
  const [lines, setLines] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [companyRes, customerRes, productRes, templateRes] = await Promise.all([
          api.get('/erp/company-profile').catch(() => ({ data: {} })),
          api.get('/contacts/customers', { params: { limit: 200 } }).catch(() => ({ data: [] })),
          api.get('/products', { params: { limit: 500 } }).catch(() => ({ data: [] })),
          api.get('/quotation-templates').catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        const cfg = { ...company, ...(companyRes.data || {}) };
        setCompany(cfg);
        setCustomers(customerRes.data || []);
        setProducts(productRes.data || []);
        setTemplates(templateRes.data || []);
        if (isEdit) {
          const { data: quote } = await api.get(`/quotations/${id}`);
          setForm({
            customer_id: quote.customer_id || '', customer_name: quote.customer_name || '', customer_gstin: quote.customer_gstin || '',
            customer_address: quote.customer_address || '', quote_date: quote.quote_date || today(), valid_until: quote.valid_until || '',
            payment_terms: quote.payment_terms || '', notes: quote.notes || '', terms_conditions: quote.terms_conditions || '',
          });
          setLines((quote.lines || []).map(line => fromBackendLine(line, cfg)));
        } else {
          setLines([productLine(Number(cfg.default_tax_rate || 0), 10)]);
        }
      } catch (err) {
        alert(friendlyError(err));
        if (isEdit) navigate('/quotations');
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [id, isEdit]);

  const totals = useMemo(() => calculateTotals(lines, !!company.prices_include_tax), [lines, company.prices_include_tax]);
  const money = value => formatCurrency(value, company.currency || 'XOF', company.locale || 'fr-FR');
  const taxName = company.tax_name || 'Taxe';
  const nextSequence = () => Math.max(0, ...lines.map(line => Number(line.sequence || 0))) + 10;

  const setField = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const setLine = (index, key, value) => setLines(prev => prev.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const removeLine = index => setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  const addProduct = () => setLines(prev => [...prev, productLine(Number(company.default_tax_rate || 0), nextSequence())]);
  const addText = type => setLines(prev => [...prev, textLine(type, nextSequence())]);

  const selectCustomer = value => {
    const customer = customers.find(item => String(item.id) === String(value));
    if (!customer) { setForm(prev => ({ ...prev, customer_id: '' })); return; }
    setForm(prev => ({ ...prev, customer_id: customer.id, customer_name: customer.name || '', customer_gstin: customer.gstin || customer.tax_id || '', customer_address: customer.billing_address || customer.address || '' }));
  };

  const selectProduct = (index, value) => {
    const product = products.find(item => String(item.id) === String(value));
    if (!product) { setLine(index, 'product_id', ''); return; }
    setLines(prev => prev.map((line, i) => i === index ? { ...line, product_id: product.id, description: product.name || '', hsn_code: product.sku || product.hsn_sac || '', unit_price: product.selling_price ?? '', tax_rate: Number(company.default_tax_rate ?? product.gst_rate ?? 0) } : line));
  };

  const applyTemplate = templateId => {
    const template = templates.find(item => String(item.id) === String(templateId));
    if (!template) return;
    let seq = nextSequence();
    const mapped = (template.lines || []).map(line => {
      const item = fromBackendLine({ ...line, sequence: seq }, company);
      seq += 10;
      return item;
    });
    setLines(prev => [...prev, ...mapped]);
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.customer_name.trim()) { alert('Le nom du client est obligatoire.'); return; }
    const usable = lines.filter(line => String(line.description || '').trim());
    if (!usable.some(line => line.line_type === 'product')) { alert('Ajoutez au moins un article ou service.'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        customer_name: form.customer_name,
        customer_gstin: form.customer_gstin || null,
        customer_address: form.customer_address || null,
        quote_date: form.quote_date || today(),
        valid_until: form.valid_until || null,
        place_of_supply: '00',
        payment_terms: form.payment_terms || null,
        notes: form.notes || null,
        terms_conditions: form.terms_conditions || null,
        lines: usable.map((line, index) => toBackendLine(line, !!company.prices_include_tax, (index + 1) * 10)),
      };
      const { data } = isEdit ? await api.patch(`/quotations/${id}`, payload) : await api.post('/quotations', payload);
      navigate(`/quotations/${data.id}`);
    } catch (err) { alert(friendlyError(err)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20 text-sm text-gray-500">Chargement…</div>;

  return (
    <form onSubmit={submit} className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><FileText size={22} className="text-primary" /><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEdit ? 'Modifier le devis' : 'Nouveau devis'}</h1></div><p className="mt-1 text-sm text-gray-500">{taxName} {Number(company.default_tax_rate || 0)}% · {company.currency === 'XOF' ? 'FCFA' : company.currency} · prix {company.prices_include_tax ? 'TTC' : 'HT'}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">Annuler</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label><Label>Client existant</Label><select value={form.customer_id} onChange={e => selectCustomer(e.target.value)} className={control}><option value="">Saisie manuelle</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Input label="Nom du client *" required value={form.customer_name} onChange={setField('customer_name')} />
          <Input label={company.tax_registration_label || 'Identifiant fiscal'} value={form.customer_gstin} onChange={setField('customer_gstin')} />
          <Input label="Adresse" value={form.customer_address} onChange={setField('customer_address')} />
          <Input label="Date du devis" type="date" value={form.quote_date} onChange={setField('quote_date')} />
          <Input label="Valide jusqu’au" type="date" value={form.valid_until} onChange={setField('valid_until')} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"><h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Contenu du devis</h2>{templates.length > 0 && <select defaultValue="" onChange={e => { applyTemplate(e.target.value); e.target.value = ''; }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"><option value="">Ajouter un modèle…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}</div>
        <div className="space-y-2 p-4">{lines.map((line, index) => line.line_type === 'product' ? (
          <div key={line._key} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <div className="grid gap-2 lg:grid-cols-[160px_2fr_100px_80px_110px_100px_90px_36px]">
              <select value={line.product_id} onChange={e => selectProduct(index, e.target.value)} className={small}><option value="">Produit libre</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <input required placeholder="Description" value={line.description} onChange={e => setLine(index, 'description', e.target.value)} className={small} />
              <input placeholder="Réf." value={line.hsn_code} onChange={e => setLine(index, 'hsn_code', e.target.value)} className={small} />
              <input type="number" min="0.01" step="0.01" value={line.qty} onChange={e => setLine(index, 'qty', e.target.value)} className={small} />
              <input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => setLine(index, 'unit_price', e.target.value)} className={small} />
              <input type="number" min="0" step="0.01" value={line.discount_amount} onChange={e => setLine(index, 'discount_amount', e.target.value)} className={small} />
              <input type="number" min="0" max="100" step="0.001" value={line.tax_rate} onChange={e => setLine(index, 'tax_rate', e.target.value)} className={small} />
              <button type="button" onClick={() => removeLine(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
            <div className="mt-2 text-right text-xs text-gray-500">Total ligne : <span className="font-semibold text-gray-700 dark:text-gray-300">{money(calculateLine(line, !!company.prices_include_tax).total)}</span></div>
          </div>
        ) : (
          <div key={line._key} className={`flex items-center gap-2 rounded-lg border p-3 ${line.line_type === 'section' ? 'border-primary/20 bg-primary/5' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40'}`}><span className="w-20 text-xs font-semibold uppercase text-gray-500">{line.line_type === 'section' ? 'Section' : 'Note'}</span><input placeholder={line.line_type === 'section' ? 'Titre de section' : 'Texte de note'} value={line.description} onChange={e => setLine(index, 'description', e.target.value)} className={`${small} flex-1`} /><button type="button" onClick={() => removeLine(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></div>
        ))}</div>
        <div className="flex flex-wrap gap-4 border-t border-gray-100 px-4 py-3 dark:border-gray-800"><button type="button" onClick={addProduct} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Plus size={15} /> Article / service</button><button type="button" onClick={() => addText('section')} className="text-sm font-medium text-gray-600">+ Section</button><button type="button" onClick={() => addText('note')} className="text-sm font-medium text-gray-600">+ Note</button></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4"><Input label="Conditions de paiement" value={form.payment_terms} onChange={setField('payment_terms')} placeholder="Ex. 50% à la commande, solde à la livraison" /><Textarea label="Notes" rows={3} value={form.notes} onChange={setField('notes')} /><Textarea label="Conditions générales" rows={4} value={form.terms_conditions} onChange={setField('terms_conditions')} /></section>
        <section className="h-fit rounded-xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900"><Summary label="Sous-total" value={money(totals.subtotal)} />{totals.discount > 0 && <Summary label="Remises" value={`− ${money(totals.discount)}`} />}<Summary label="Base taxable" value={money(totals.taxable)} /><Summary label={taxName} value={money(totals.tax)} /><div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-lg font-bold"><span>Total</span><span>{money(totals.total)}</span></div></section>
      </div>
    </form>
  );
}

function calculateLine(line, pricesIncludeTax) {
  if (line.line_type !== 'product') return { gross: 0, discount: 0, taxable: 0, tax: 0, total: 0 };
  const qty = Number(line.qty || 0), enteredUnit = Number(line.unit_price || 0), discount = Number(line.discount_amount || 0), rate = Number(line.tax_rate || 0) / 100;
  const enteredAmount = Math.max(0, qty * enteredUnit - discount);
  const taxable = pricesIncludeTax && rate > 0 ? enteredAmount / (1 + rate) : enteredAmount;
  const tax = pricesIncludeTax ? enteredAmount - taxable : taxable * rate;
  return { gross: qty * enteredUnit, discount, taxable, tax, total: taxable + tax };
}
function calculateTotals(lines, pricesIncludeTax) { return lines.reduce((acc, line) => { const c = calculateLine(line, pricesIncludeTax); acc.subtotal += c.gross; acc.discount += c.discount; acc.taxable += c.taxable; acc.tax += c.tax; acc.total += c.total; return acc; }, { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 }); }
function toBackendLine(line, pricesIncludeTax, sequence) {
  if (line.line_type !== 'product') return { line_type: line.line_type, description: line.description, sequence, product_id: null, hsn_code: null, qty: 0, unit_price: 0, discount_amount: 0, gst_rate: 0 };
  const ratePct = Number(line.tax_rate || 0), factor = pricesIncludeTax && ratePct > 0 ? 1 + ratePct / 100 : 1;
  return { line_type: 'product', sequence, product_id: line.product_id ? Number(line.product_id) : null, description: line.description, hsn_code: line.hsn_code || null, qty: Number(line.qty || 1), unit_price: Number(line.unit_price || 0) / factor, discount_amount: Number(line.discount_amount || 0) / factor, gst_rate: ratePct };
}
function fromBackendLine(line, company) {
  const ratePct = Number(line.gst_rate ?? company.default_tax_rate ?? 0), factor = company.prices_include_tax && ratePct > 0 ? 1 + ratePct / 100 : 1;
  if (line.line_type !== 'product') return { _key: Math.random(), line_type: line.line_type, sequence: line.sequence || 10, product_id: '', description: line.description || '', hsn_code: '', qty: 0, unit_price: 0, discount_amount: 0, tax_rate: 0 };
  return { _key: Math.random(), line_type: 'product', sequence: line.sequence || 10, product_id: line.product_id || '', description: line.description || '', hsn_code: line.hsn_code || '', qty: line.qty || 1, unit_price: Number(line.unit_price || 0) * factor, discount_amount: Number(line.discount_amount || 0) * factor, tax_rate: ratePct };
}

const control = 'mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-950';
const small = 'w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 dark:border-gray-700 dark:bg-gray-950';
function Label({ children }) { return <span className="text-xs font-medium text-gray-500">{children}</span>; }
function Input({ label, ...props }) { return <label className="block"><Label>{label}</Label><input {...props} className={control} /></label>; }
function Textarea({ label, ...props }) { return <label className="block"><Label>{label}</Label><textarea {...props} className={`${control} resize-y`} /></label>; }
function Summary({ label, value }) { return <div className="mb-2 flex justify-between text-gray-600 dark:text-gray-400"><span>{label}</span><span>{value}</span></div>; }
