import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/currency.js';

export default function QuotationPrintPage() {
  const { id } = useParams();
  const [quote, setQuote] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/quotations/${id}`),
      api.get('/erp/company-profile').catch(() => ({ data: {} })),
    ]).then(([quoteRes, companyRes]) => {
      setQuote(quoteRes.data);
      setCompany(companyRes.data || {});
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Chargement…</div>;
  if (!quote) return <div className="flex min-h-screen items-center justify-center text-gray-500">Devis introuvable.</div>;

  const currency = company?.currency || 'XOF';
  const locale = company?.locale || 'fr-FR';
  const taxName = company?.tax_name || 'Taxe';
  const taxLabel = company?.tax_registration_label || 'Identifiant fiscal';
  const money = value => formatCurrency(value, currency, locale);
  const taxTotal = Number(quote.cgst_total || 0) + Number(quote.sgst_total || 0) + Number(quote.igst_total || 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { margin: 11mm; size: A4; }
        }
        body { background: #f3f4f6; }
      `}</style>

      <div className="no-print fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <span className="text-sm font-medium text-gray-700">{quote.quote_number} — {quote.customer_name}</span>
        <div className="flex gap-3"><button onClick={() => window.history.back()} className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm text-gray-600">← Retour</button><button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white"><Printer size={14} /> Imprimer / PDF</button></div>
      </div>

      <div className="no-print pt-16" />
      <div className="min-h-screen px-4 py-8 print:m-0 print:p-0">
        <div className="mx-auto max-w-3xl bg-white p-12 shadow-lg print:p-0 print:shadow-none">
          <header className="mb-8 flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">{company?.logo_url && <img src={company.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-contain" />}<div><p className="text-2xl font-bold text-gray-900">{company?.legal_name || company?.trade_name || 'Mon entreprise'}</p>{company?.trade_name && company.trade_name !== company.legal_name && <p className="text-sm text-gray-500">{company.trade_name}</p>}{company?.address && <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-gray-500">{company.address}</p>}<div className="mt-1 space-x-3 text-xs text-gray-500">{company?.phone && <span>{company.phone}</span>}{company?.email && <span>{company.email}</span>}</div></div></div>
            <div className="text-right"><p className="text-2xl font-bold text-gray-800">DEVIS</p><p className="mt-1 font-mono text-sm text-gray-600">{quote.quote_number}</p></div>
          </header>

          <div className="mb-7 grid grid-cols-2 gap-8 rounded-xl bg-gray-50 p-5">
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Destinataire</p><p className="font-semibold text-gray-900">{quote.customer_name}</p>{quote.customer_gstin && <p className="mt-0.5 text-xs text-gray-500">{taxLabel} : {quote.customer_gstin}</p>}{quote.customer_address && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{quote.customer_address}</p>}</div>
            <div className="space-y-1 text-right text-sm"><Meta label="Date" value={quote.quote_date} />{quote.valid_until && <Meta label="Valide jusqu’au" value={quote.valid_until} />}<Meta label="Devise" value={currency === 'XOF' ? 'FCFA (XOF)' : currency} /></div>
          </div>

          <table className="mb-6 w-full border-collapse text-sm">
            <thead><tr className="bg-gray-800 text-xs text-white"><th className="rounded-tl px-3 py-2.5 text-left">Description</th><th className="px-2 py-2.5 text-right">Qté</th><th className="px-2 py-2.5 text-right">Prix unitaire</th><th className="px-2 py-2.5 text-right">{taxName}</th><th className="rounded-tr px-3 py-2.5 text-right">Total</th></tr></thead>
            <tbody>{[...(quote.lines || [])].sort((a,b) => a.sequence-b.sequence).map((line, index) => line.line_type === 'product' ? <tr key={line.id} className={index % 2 ? 'bg-gray-50' : 'bg-white'}><td className="px-3 py-2 text-gray-800">{line.description}{line.hsn_code && <div className="text-[10px] text-gray-400">Réf. {line.hsn_code}</div>}</td><td className="px-2 py-2 text-right">{line.qty}</td><td className="px-2 py-2 text-right">{money(line.unit_price)}</td><td className="px-2 py-2 text-right">{money(Number(line.cgst_amount || 0)+Number(line.sgst_amount || 0)+Number(line.igst_amount || 0))}</td><td className="px-3 py-2 text-right font-semibold">{money(line.line_total)}</td></tr> : line.line_type === 'section' ? <tr key={line.id}><td colSpan="5" className="pt-5 pb-2 text-sm font-bold uppercase tracking-wide text-gray-700">{line.description}</td></tr> : <tr key={line.id}><td colSpan="5" className="py-2 text-sm italic text-gray-500">{line.description}</td></tr>)}</tbody>
          </table>

          <div className="mb-8 flex justify-end"><div className="w-72 space-y-1.5 text-sm"><Total label="Sous-total" value={money(quote.subtotal)} />{Number(quote.discount_total) > 0 && <Total label="Remise" value={`− ${money(quote.discount_total)}`} />}<Total label={taxName} value={money(taxTotal)} />{company?.tax_exemption_note && taxTotal === 0 && <p className="py-1 text-xs italic text-gray-500">{company.tax_exemption_note}</p>}<div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-base font-bold text-gray-900"><span>Total</span><span>{money(quote.total)}</span></div></div></div>

          <div className="grid gap-6 md:grid-cols-2">{quote.payment_terms && <Block title="Conditions de paiement" text={quote.payment_terms} />}{quote.notes && <Block title="Notes" text={quote.notes} />}{quote.terms_conditions && <div className="md:col-span-2"><Block title="Conditions générales" text={quote.terms_conditions} /></div>}</div>

          <div className="mt-8 grid grid-cols-2 gap-8 border-t border-gray-200 pt-5">
            <div className="space-y-1 text-xs text-gray-500">{company?.rccm && <p>RCCM : {company.rccm}</p>}{company?.ifu && <p>IFU : {company.ifu}</p>}{company?.nif && <p>NIF : {company.nif}</p>}{company?.tax_id && <p>{taxLabel} : {company.tax_id}</p>}</div>
            <div className="flex items-end justify-end gap-5">{company?.signature_url && <div className="text-center"><img src={company.signature_url} alt="Signature" className="h-14 max-w-32 object-contain" /><p className="mt-1 text-[10px] text-gray-400">Signature</p></div>}{company?.stamp_url && <div className="text-center"><img src={company.stamp_url} alt="Cachet" className="h-16 w-16 object-contain" /><p className="mt-1 text-[10px] text-gray-400">Cachet</p></div>}</div>
          </div>
          <footer className="mt-6 border-t border-gray-100 pt-3 text-center text-[10px] text-gray-400">{company?.invoice_footer || 'Document généré électroniquement par ERP Suite.'}</footer>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value }) { return <div className="flex justify-end gap-5"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-800">{value}</span></div>; }
function Total({ label, value }) { return <div className="flex justify-between text-gray-600"><span>{label}</span><span>{value}</span></div>; }
function Block({ title, text }) { return <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</p><p className="whitespace-pre-wrap text-sm text-gray-600">{text}</p></div>; }
