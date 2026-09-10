import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import api from '../../api/client.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_LABELS = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  partial: 'Partiellement payée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

export default function InvoicePrintPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/invoices/${id}`),
      api.get('/erp/company-profile').catch(() => ({ data: null })),
    ]).then(([invoiceRes, companyRes]) => {
      setInvoice(invoiceRes.data);
      setCompany(companyRes.data || {});
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Chargement…</div>;
  if (!invoice) return <div className="flex min-h-screen items-center justify-center text-gray-500">Facture introuvable.</div>;

  const currency = company?.currency || 'XOF';
  const taxName = company?.tax_name || 'Taxe';
  const taxRegistrationLabel = company?.tax_registration_label || 'Identifiant fiscal';
  const taxTotal = Number(invoice.cgst_total || 0) + Number(invoice.sgst_total || 0) + Number(invoice.igst_total || 0);
  const isDraft = invoice.status === 'draft';
  const money = value => formatCurrency(value, currency, company?.locale || 'fr-FR');

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
        <span className="text-sm font-medium text-gray-700">{invoice.invoice_number} — {invoice.customer_name}</span>
        <div className="flex gap-3">
          <button onClick={() => window.history.back()} className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200">← Retour</button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white">
            <Printer size={14} /> Imprimer / PDF
          </button>
        </div>
      </div>

      <div className="no-print pt-16" />
      <div className="min-h-screen px-4 py-8 print:m-0 print:p-0">
        <div className="relative mx-auto max-w-3xl bg-white p-12 shadow-lg print:p-0 print:shadow-none">
          {isDraft && <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"><p className="rotate-[-35deg] select-none text-7xl font-black tracking-widest text-gray-100">BROUILLON</p></div>}

          <header className="relative mb-8 flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {company?.logo_url && <img src={company.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-contain" />}
              <div>
                <p className="text-2xl font-bold text-gray-900">{company?.legal_name || company?.trade_name || 'Mon entreprise'}</p>
                {company?.trade_name && company.trade_name !== company.legal_name && <p className="text-sm text-gray-500">{company.trade_name}</p>}
                {company?.address && <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-gray-500">{company.address}</p>}
                <div className="mt-1 space-x-3 text-xs text-gray-500">
                  {company?.phone && <span>{company.phone}</span>}
                  {company?.email && <span>{company.email}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-800">{isDraft ? 'FACTURE PRO FORMA' : 'FACTURE'}</p>
              <p className="mt-1 font-mono text-sm text-gray-600">{invoice.invoice_number}</p>
              <span className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{STATUS_LABELS[invoice.status] || invoice.status}</span>
            </div>
          </header>

          <div className="relative mb-7 grid grid-cols-2 gap-8 rounded-xl bg-gray-50 p-5">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Facturé à</p>
              <p className="font-semibold text-gray-900">{invoice.customer_name}</p>
              {invoice.customer_gstin && <p className="mt-0.5 text-xs text-gray-500">{taxRegistrationLabel} : {invoice.customer_gstin}</p>}
              {invoice.customer_address && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{invoice.customer_address}</p>}
            </div>
            <div className="space-y-1 text-right text-sm">
              <Meta label="Date de facture" value={invoice.invoice_date} />
              {invoice.due_date && <Meta label="Échéance" value={invoice.due_date} />}
              <Meta label="Devise" value={currency === 'XOF' ? 'FCFA (XOF)' : currency} />
            </div>
          </div>

          <table className="relative mb-6 w-full border-collapse text-sm">
            <thead><tr className="bg-gray-800 text-xs text-white"><th className="rounded-tl px-3 py-2.5 text-left">Description</th><th className="px-2 py-2.5 text-right">Qté</th><th className="px-2 py-2.5 text-right">Prix unitaire</th><th className="px-2 py-2.5 text-right">Remise</th><th className="px-2 py-2.5 text-right">{taxName}</th><th className="rounded-tr px-3 py-2.5 text-right">Total</th></tr></thead>
            <tbody>{invoice.lines.map((line, index) => {
              const lineTax = Number(line.cgst_amount || 0) + Number(line.sgst_amount || 0) + Number(line.igst_amount || 0);
              return <tr key={line.id} className={index % 2 ? 'bg-gray-50' : 'bg-white'}><td className="px-3 py-2 text-gray-800"><div>{line.description}</div>{line.hsn_code && <div className="text-[10px] text-gray-400">Réf. {line.hsn_code}</div>}</td><td className="px-2 py-2 text-right">{line.qty}</td><td className="px-2 py-2 text-right">{money(line.unit_price)}</td><td className="px-2 py-2 text-right text-gray-500">{Number(line.discount_amount) > 0 ? money(line.discount_amount) : '—'}</td><td className="px-2 py-2 text-right">{money(lineTax)}</td><td className="px-3 py-2 text-right font-semibold">{money(line.line_total)}</td></tr>;
            })}</tbody>
          </table>

          <div className="relative mb-8 flex justify-end"><div className="w-72 space-y-1.5 text-sm"><Total label="Sous-total" value={money(invoice.subtotal)} />{Number(invoice.discount_total) > 0 && <Total label="Remise" value={`− ${money(invoice.discount_total)}`} />}<Total label={taxName} value={money(taxTotal)} />{company?.tax_exemption_note && taxTotal === 0 && <p className="py-1 text-xs italic text-gray-500">{company.tax_exemption_note}</p>}<div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-base font-bold text-gray-900"><span>Total</span><span>{money(invoice.total)}</span></div></div></div>

          {invoice.notes && <div className="relative mb-5 border-t border-gray-200 pt-5"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</p><p className="whitespace-pre-wrap text-sm text-gray-600">{invoice.notes}</p></div>}

          <div className="relative mt-8 grid grid-cols-2 gap-8 border-t border-gray-200 pt-5">
            <div className="space-y-1 text-xs text-gray-500">
              {company?.rccm && <p>RCCM : {company.rccm}</p>}
              {company?.ifu && <p>IFU : {company.ifu}</p>}
              {company?.nif && <p>NIF : {company.nif}</p>}
              {company?.tax_id && <p>{taxRegistrationLabel} : {company.tax_id}</p>}
            </div>
            <div className="flex items-end justify-end gap-5">
              {company?.signature_url && <div className="text-center"><img src={company.signature_url} alt="Signature" className="h-14 max-w-32 object-contain" /><p className="mt-1 text-[10px] text-gray-400">Signature</p></div>}
              {company?.stamp_url && <div className="text-center"><img src={company.stamp_url} alt="Cachet" className="h-16 w-16 object-contain" /><p className="mt-1 text-[10px] text-gray-400">Cachet</p></div>}
            </div>
          </div>

          <footer className="relative mt-6 border-t border-gray-100 pt-3 text-center text-[10px] text-gray-400">{company?.invoice_footer || 'Document généré électroniquement par ERP Suite.'}</footer>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value }) { return <div className="flex justify-end gap-5"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-800">{value}</span></div>; }
function Total({ label, value }) { return <div className="flex justify-between text-gray-600"><span>{label}</span><span>{value}</span></div>; }
