import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, Printer, Send, Trash2, Wallet } from 'lucide-react';
import api from '../../api/client.js';
import { friendlyError } from '../../utils/errorUtils.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS = {
  draft: ['Brouillon', 'bg-gray-100 text-gray-600'],
  sent: ['Envoyée', 'bg-blue-50 text-blue-700'],
  partial: ['Partiellement payée', 'bg-amber-50 text-amber-700'],
  paid: ['Payée', 'bg-green-50 text-green-700'],
  overdue: ['En retard', 'bg-red-50 text-red-700'],
  cancelled: ['Annulée', 'bg-gray-100 text-gray-500'],
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState({ currency: 'XOF', locale: 'fr-FR', tax_name: 'TVA', tax_registration_label: 'Identifiant fiscal' });
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [invoiceRes, companyRes, paymentRes] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get('/erp/company-profile').catch(() => ({ data: {} })),
        api.get(`/erp/payments/invoice/${id}`).catch(() => ({ data: null })),
      ]);
      setInvoice(invoiceRes.data);
      setCompany(prev => ({ ...prev, ...(companyRes.data || {}) }));
      setPaymentSummary(paymentRes.data);
    } catch {
      navigate('/invoices');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="flex justify-center py-20 text-sm text-gray-500">Chargement…</div>;
  if (!invoice) return null;

  const overdue = invoice.status === 'sent' && invoice.due_date && new Date(invoice.due_date) < new Date();
  const displayStatus = overdue ? 'overdue' : invoice.status;
  const money = value => formatCurrency(value, company.currency || 'XOF', company.locale || 'fr-FR');
  const taxName = company.tax_name || 'Taxe';
  const totalTax = Number(invoice.cgst_total || 0) + Number(invoice.sgst_total || 0) + Number(invoice.igst_total || 0);
  const statusInfo = STATUS[displayStatus] || STATUS.draft;

  const sendInvoice = async () => {
    if (!window.confirm('Envoyer cette facture ? Après envoi, elle sera verrouillée.')) return;
    setActing(true);
    try { const { data } = await api.post(`/invoices/${id}/send`); setInvoice(data); await load(); }
    catch (err) { alert(friendlyError(err)); }
    finally { setActing(false); }
  };

  const deleteInvoice = async () => {
    if (!window.confirm('Supprimer définitivement ce brouillon ?')) return;
    setActing(true);
    try { await api.delete(`/invoices/${id}`); navigate('/invoices'); }
    catch (err) { alert(friendlyError(err)); setActing(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <button onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white"><ArrowLeft size={15} /> Retour aux factures</button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{invoice.invoice_number}</h1><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo[1]}`}>{statusInfo[0]}</span></div><p className="mt-1 text-sm text-gray-500">{invoice.customer_name}</p></div>
        <div className="flex flex-wrap gap-2">
          <Action icon={Printer} onClick={() => navigate(`/invoices/${id}/print`)}>Imprimer / PDF</Action>
          {invoice.status === 'draft' && <><Action icon={Edit2} onClick={() => navigate(`/invoices/${id}/edit`)}>Modifier</Action><Action primary icon={Send} disabled={acting} onClick={sendInvoice}>Envoyer</Action><button disabled={acting} onClick={deleteInvoice} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button></>}
          {['sent', 'overdue', 'partial'].includes(displayStatus) && <Action primary icon={Wallet} onClick={() => navigate('/payments')}>Enregistrer un paiement</Action>}
        </div>
      </div>

      {invoice.status !== 'draft' && invoice.status !== 'paid' && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">La facture est verrouillée après envoi. Pour corriger les montants, utilisez ensuite un avoir.</div>}
      {invoice.status === 'paid' && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Facture réglée intégralement.</div>}

      {paymentSummary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Total facture" value={money(paymentSummary.total ?? invoice.total)} />
          <Metric label="Déjà payé" value={money(paymentSummary.paid_amount || 0)} />
          <Metric label="Solde restant" value={money(paymentSummary.balance ?? invoice.total)} strong />
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-gray-800 dark:bg-gray-800/40">
          <div className="flex gap-3">{company.logo_url && <img src={company.logo_url} alt="Logo" className="h-12 w-12 rounded object-contain" />}<div><p className="font-bold text-gray-900 dark:text-white">{company.legal_name || company.trade_name || 'Mon entreprise'}</p>{company.trade_name && company.trade_name !== company.legal_name && <p className="text-sm text-gray-500">{company.trade_name}</p>}{company.tax_id && <p className="mt-0.5 text-xs text-gray-500">{company.tax_registration_label || 'Identifiant fiscal'} : {company.tax_id}</p>}</div></div>
          <div className="text-right"><p className="text-xs uppercase tracking-wider text-gray-400">Facture</p><p className="text-lg font-bold">{invoice.invoice_number}</p></div>
        </header>

        <div className="grid gap-6 border-b border-gray-100 px-6 py-5 md:grid-cols-2 dark:border-gray-800">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Client</p><p className="font-semibold">{invoice.customer_name}</p>{invoice.customer_gstin && <p className="text-xs text-gray-500">{company.tax_registration_label || 'Identifiant fiscal'} : {invoice.customer_gstin}</p>}{invoice.customer_address && <p className="mt-1 whitespace-pre-line text-sm text-gray-500">{invoice.customer_address}</p>}</div>
          <div className="space-y-2"><Row label="Date" value={invoice.invoice_date} />{invoice.due_date && <Row label="Échéance" value={invoice.due_date} />}<Row label="Devise" value={company.currency === 'XOF' ? 'FCFA (XOF)' : company.currency} /></div>
        </div>

        <div className="overflow-x-auto px-6 py-4"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500 dark:border-gray-800"><th className="pb-2">Description</th><th className="pb-2">Réf.</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Prix</th><th className="pb-2 text-right">{taxName}</th><th className="pb-2 text-right">Montant</th></tr></thead><tbody>{invoice.lines.map(line => { const lineTax = Number(line.cgst_amount || 0) + Number(line.sgst_amount || 0) + Number(line.igst_amount || 0); return <tr key={line.id} className="border-b border-gray-50 dark:border-gray-800/50"><td className="py-3 font-medium">{line.description}<div className="text-xs font-normal text-gray-400">{taxName} {line.gst_rate}%</div></td><td className="py-3 text-xs text-gray-500">{line.hsn_code || '—'}</td><td className="py-3 text-right">{line.qty}</td><td className="py-3 text-right">{money(line.unit_price)}</td><td className="py-3 text-right">{money(lineTax)}</td><td className="py-3 text-right font-semibold">{money(line.line_total)}</td></tr>; })}</tbody></table></div>

        <div className="flex justify-end border-t border-gray-100 px-6 py-5 dark:border-gray-800"><div className="w-72 space-y-2 text-sm"><Total label="Sous-total" value={money(invoice.subtotal)} />{Number(invoice.discount_total) > 0 && <Total label="Remise" value={`− ${money(invoice.discount_total)}`} />}<Total label={taxName} value={money(totalTax)} /><div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold"><span>Total</span><span>{money(invoice.total)}</span></div></div></div>

        {invoice.notes && <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">Notes</p><p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{invoice.notes}</p></div>}
      </section>
    </div>
  );
}

function Action({ icon: Icon, primary = false, children, ...props }) { return <button {...props} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${primary ? 'bg-primary text-white' : 'border border-gray-200 dark:border-gray-700'}`}><Icon size={15} />{children}</button>; }
function Metric({ label, value, strong }) { return <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><p className="text-xs text-gray-500">{label}</p><p className={`mt-1 ${strong ? 'text-xl font-bold' : 'text-lg font-semibold'}`}>{value}</p></div>; }
function Row({ label, value }) { return <div className="flex justify-between gap-4 text-sm"><span className="text-gray-500">{label}</span><span className="font-medium">{value}</span></div>; }
function Total({ label, value }) { return <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>{label}</span><span>{value}</span></div>; }
