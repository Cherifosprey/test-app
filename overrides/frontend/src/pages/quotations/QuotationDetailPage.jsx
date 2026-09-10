import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Edit2, FilePlus2, Printer, Send, Trash2, XCircle } from 'lucide-react';
import api from '../../api/client.js';
import { friendlyError } from '../../utils/errorUtils.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS = {
  draft: ['Brouillon', 'bg-gray-100 text-gray-600'],
  sent: ['Envoyé', 'bg-blue-50 text-blue-700'],
  confirmed: ['Confirmé', 'bg-green-50 text-green-700'],
  cancelled: ['Annulé', 'bg-red-50 text-red-700'],
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [company, setCompany] = useState({ currency: 'XOF', locale: 'fr-FR', tax_name: 'TVA', tax_registration_label: 'Identifiant fiscal' });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [quoteRes, companyRes] = await Promise.all([
        api.get(`/quotations/${id}`),
        api.get('/erp/company-profile').catch(() => ({ data: {} })),
      ]);
      setQuote(quoteRes.data);
      setCompany(prev => ({ ...prev, ...(companyRes.data || {}) }));
    } catch { navigate('/quotations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-sm text-gray-500">Chargement…</div>;
  if (!quote) return null;

  const money = value => formatCurrency(value, company.currency || 'XOF', company.locale || 'fr-FR');
  const taxName = company.tax_name || 'Taxe';
  const taxTotal = Number(quote.cgst_total || 0) + Number(quote.sgst_total || 0) + Number(quote.igst_total || 0);
  const status = STATUS[quote.status] || STATUS.draft;

  const action = async (name, question) => {
    if (question && !window.confirm(question)) return;
    setActing(true);
    try { const { data } = await api.post(`/quotations/${id}/${name}`); setQuote(data); }
    catch (err) { alert(friendlyError(err)); }
    finally { setActing(false); }
  };

  const remove = async () => {
    if (!window.confirm('Supprimer définitivement ce devis ?')) return;
    setActing(true);
    try { await api.delete(`/quotations/${id}`); navigate('/quotations'); }
    catch (err) { alert(friendlyError(err)); setActing(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <button onClick={() => navigate('/quotations')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white"><ArrowLeft size={15} /> Retour aux devis</button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quote.quote_number}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status[1]}`}>{status[0]}</span></div><p className="mt-1 text-sm text-gray-500">{quote.customer_name}</p></div>
        <div className="flex flex-wrap gap-2">
          <Action icon={Printer} onClick={() => navigate(`/quotations/${id}/print`)}>Imprimer / PDF</Action>
          {['draft', 'sent'].includes(quote.status) && <Action icon={Edit2} onClick={() => navigate(`/quotations/${id}/edit`)}>Modifier</Action>}
          {quote.status === 'draft' && <Action primary icon={Send} disabled={acting} onClick={() => action('send', 'Marquer ce devis comme envoyé ?')}>Envoyer</Action>}
          {['draft', 'sent'].includes(quote.status) && <Action primary icon={CheckCircle} disabled={acting} onClick={() => action('confirm', 'Confirmer ce devis ?')}>Confirmer</Action>}
          {quote.status !== 'confirmed' && quote.status !== 'cancelled' && <Action icon={XCircle} disabled={acting} onClick={() => action('cancel', 'Annuler ce devis ?')}>Annuler</Action>}
          {quote.status === 'confirmed' && <Action primary icon={FilePlus2} onClick={() => navigate(`/invoices/new?from_quote=${id}`)}>Créer la facture</Action>}
          {['draft', 'cancelled'].includes(quote.status) && <button disabled={acting} onClick={remove} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-gray-800 dark:bg-gray-800/40">
          <div className="flex gap-3">{company.logo_url && <img src={company.logo_url} alt="Logo" className="h-12 w-12 rounded object-contain" />}<div><p className="font-bold text-gray-900 dark:text-white">{company.legal_name || company.trade_name || 'Mon entreprise'}</p>{company.trade_name && company.trade_name !== company.legal_name && <p className="text-sm text-gray-500">{company.trade_name}</p>}{company.tax_id && <p className="mt-0.5 text-xs text-gray-500">{company.tax_registration_label || 'Identifiant fiscal'} : {company.tax_id}</p>}</div></div>
          <div className="text-right"><p className="text-xs uppercase tracking-wider text-gray-400">Devis</p><p className="text-lg font-bold">{quote.quote_number}</p></div>
        </header>

        <div className="grid gap-6 border-b border-gray-100 px-6 py-5 md:grid-cols-2 dark:border-gray-800">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Client</p><p className="font-semibold">{quote.customer_name}</p>{quote.customer_gstin && <p className="text-xs text-gray-500">{company.tax_registration_label || 'Identifiant fiscal'} : {quote.customer_gstin}</p>}{quote.customer_address && <p className="mt-1 whitespace-pre-line text-sm text-gray-500">{quote.customer_address}</p>}</div>
          <div className="space-y-2"><Row label="Date" value={quote.quote_date} />{quote.valid_until && <Row label="Valide jusqu’au" value={quote.valid_until} />}<Row label="Devise" value={company.currency === 'XOF' ? 'FCFA (XOF)' : company.currency} /></div>
        </div>

        <div className="px-6 py-4">
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="pb-2">Description</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Prix</th><th className="pb-2 text-right">{taxName}</th><th className="pb-2 text-right">Total</th></tr></thead><tbody>{[...(quote.lines || [])].sort((a,b) => a.sequence-b.sequence).map(line => line.line_type === 'product' ? <tr key={line.id} className="border-b border-gray-50 dark:border-gray-800/50"><td className="py-3"><p className="font-medium">{line.description}</p><p className="text-xs text-gray-400">{taxName} {line.gst_rate}%{line.hsn_code ? ` · Réf. ${line.hsn_code}` : ''}</p></td><td className="py-3 text-right">{line.qty}</td><td className="py-3 text-right">{money(line.unit_price)}</td><td className="py-3 text-right">{money(Number(line.cgst_amount || 0)+Number(line.sgst_amount || 0)+Number(line.igst_amount || 0))}</td><td className="py-3 text-right font-semibold">{money(line.line_total)}</td></tr> : line.line_type === 'section' ? <tr key={line.id}><td colSpan="5" className="pt-5 pb-2 text-sm font-bold uppercase tracking-wide text-primary">{line.description}</td></tr> : <tr key={line.id}><td colSpan="5" className="py-2 text-sm italic text-gray-500">{line.description}</td></tr>)}</tbody></table>
        </div>

        <div className="flex justify-end border-t border-gray-100 px-6 py-5 dark:border-gray-800"><div className="w-72 space-y-2 text-sm"><Total label="Sous-total" value={money(quote.subtotal)} />{Number(quote.discount_total) > 0 && <Total label="Remise" value={`− ${money(quote.discount_total)}`} />}<Total label={taxName} value={money(taxTotal)} /><div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold"><span>Total</span><span>{money(quote.total)}</span></div></div></div>

        {(quote.payment_terms || quote.notes || quote.terms_conditions) && <div className="grid gap-5 border-t border-gray-100 px-6 py-5 md:grid-cols-2 dark:border-gray-800"><div>{quote.payment_terms && <Block title="Conditions de paiement" text={quote.payment_terms} />}{quote.notes && <Block title="Notes" text={quote.notes} />}</div>{quote.terms_conditions && <Block title="Conditions générales" text={quote.terms_conditions} />}</div>}
      </section>
    </div>
  );
}

function Action({ icon: Icon, primary = false, children, ...props }) { return <button {...props} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${primary ? 'bg-primary text-white' : 'border border-gray-200 dark:border-gray-700'}`}><Icon size={15} />{children}</button>; }
function Row({ label, value }) { return <div className="flex justify-between gap-4 text-sm"><span className="text-gray-500">{label}</span><span className="font-medium">{value}</span></div>; }
function Total({ label, value }) { return <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>{label}</span><span>{value}</span></div>; }
function Block({ title, text }) { return <div className="mb-4"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">{title}</p><p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{text}</p></div>; }
