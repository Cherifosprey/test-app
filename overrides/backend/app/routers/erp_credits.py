from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.accounting_seed import get_account_by_code, seed_accounts_if_empty
from ..core.deps import get_current_user
from ..database import get_db
from ..models.accounting import JournalEntry, JournalEntryLine
from ..models.invoice import Invoice
from ..models.user import User, Workspace

router = APIRouter(prefix='/erp/credits', tags=['ERP Credit Notes'])

PAYMENT_METHODS = {'cash', 'bank', 'mobile_money', 'card', 'cheque', 'other'}
CENT = Decimal('0.01')


class CreditNoteBody(BaseModel):
    invoice_id: int
    amount: Decimal = Field(gt=0)
    issue_date: date = Field(default_factory=date.today)
    reason: str = Field(min_length=2, max_length=1000)


class RefundBody(BaseModel):
    amount: Decimal = Field(gt=0)
    refund_date: date = Field(default_factory=date.today)
    method: str = 'bank'
    reference: Optional[str] = None
    notes: Optional[str] = None


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(CENT, rounding=ROUND_HALF_UP)


async def _require_invoices(current_user: User, db: AsyncSession) -> None:
    result = await db.execute(select(Workspace.enabled_modules).where(Workspace.id == current_user.workspace_id))
    raw = result.scalar_one_or_none() or '[]'
    if 'invoices' not in raw:
        raise HTTPException(403, 'Invoices module is not enabled for this workspace')


async def _paid_amount(invoice: Invoice, db: AsyncSession) -> Decimal:
    result = await db.execute(
        text('SELECT COALESCE(SUM(amount), 0) FROM erp_invoice_payments WHERE invoice_id = :invoice_id AND workspace_id = :workspace_id'),
        {'invoice_id': invoice.id, 'workspace_id': invoice.workspace_id},
    )
    paid = money(result.scalar_one() or 0)
    if invoice.status == 'paid' and paid == 0:
        return money(invoice.total)
    return paid


@router.get('')
async def list_credit_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    result = await db.execute(
        text('''
            SELECT cn.id, cn.credit_number, cn.issue_date, cn.amount, cn.net_amount,
                   cn.tax_amount, cn.reason, cn.status, cn.created_at,
                   i.id AS invoice_id, i.invoice_number, i.customer_name,
                   COALESCE(SUM(r.amount), 0) AS refunded_amount,
                   GREATEST(cn.amount - COALESCE(SUM(r.amount), 0), 0) AS refundable_balance
            FROM erp_credit_notes cn
            JOIN invoices i ON i.id = cn.invoice_id
            LEFT JOIN erp_credit_refunds r ON r.credit_note_id = cn.id
            WHERE cn.workspace_id = :workspace_id
            GROUP BY cn.id, i.id
            ORDER BY cn.created_at DESC
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get('/refunds/recent')
async def list_refunds(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    result = await db.execute(
        text('''
            SELECT r.id, r.refund_date, r.amount, r.method, r.reference, r.notes,
                   r.created_at, cn.id AS credit_note_id, cn.credit_number,
                   i.invoice_number, i.customer_name
            FROM erp_credit_refunds r
            JOIN erp_credit_notes cn ON cn.id = r.credit_note_id
            JOIN invoices i ON i.id = cn.invoice_id
            WHERE r.workspace_id = :workspace_id
            ORDER BY r.created_at DESC
            LIMIT 100
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get('/eligible-invoices')
async def eligible_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    result = await db.execute(
        text('''
            SELECT i.id, i.invoice_number, i.customer_name, i.invoice_date, i.status, i.total,
                   COALESCE(SUM(cn.amount), 0) AS credited_amount,
                   GREATEST(i.total - COALESCE(SUM(cn.amount), 0), 0) AS credit_available
            FROM invoices i
            LEFT JOIN erp_credit_notes cn ON cn.invoice_id = i.id AND cn.workspace_id = i.workspace_id
            WHERE i.workspace_id = :workspace_id
              AND i.status IN ('sent', 'overdue', 'partial', 'paid')
            GROUP BY i.id
            HAVING i.total - COALESCE(SUM(cn.amount), 0) > 0
            ORDER BY i.created_at DESC
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.post('', status_code=201)
async def create_credit_note(
    body: CreditNoteBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    await seed_accounts_if_empty(current_user.workspace_id, db)

    invoice_result = await db.execute(
        select(Invoice).where(
            Invoice.id == body.invoice_id,
            Invoice.workspace_id == current_user.workspace_id,
        ).with_for_update()
    )
    invoice = invoice_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, 'Invoice not found')
    if invoice.status not in ('sent', 'overdue', 'partial', 'paid'):
        raise HTTPException(409, 'A credit note can only be issued for a sent invoice')

    prior_result = await db.execute(
        text('SELECT COALESCE(SUM(amount), 0) FROM erp_credit_notes WHERE invoice_id = :invoice_id AND workspace_id = :workspace_id'),
        {'invoice_id': invoice.id, 'workspace_id': current_user.workspace_id},
    )
    prior_credits = money(prior_result.scalar_one() or 0)
    invoice_total = money(invoice.total)
    available = invoice_total - prior_credits
    amount = money(body.amount)
    if amount > available:
        raise HTTPException(400, f'Credit amount exceeds available invoice amount ({available})')

    original_net = money(Decimal(str(invoice.subtotal or 0)) - Decimal(str(invoice.discount_total or 0)))
    original_cgst = money(invoice.cgst_total)
    original_sgst = money(invoice.sgst_total)
    original_igst = money(invoice.igst_total)
    ratio = (amount / invoice_total) if invoice_total else Decimal('0')
    cgst_credit = money(original_cgst * ratio)
    sgst_credit = money(original_sgst * ratio)
    igst_credit = money(original_igst * ratio)
    tax_credit = cgst_credit + sgst_credit + igst_credit
    net_credit = amount - tax_credit

    seq_result = await db.execute(
        text('SELECT COALESCE(MAX(id), 0) + 1 FROM erp_credit_notes WHERE workspace_id = :workspace_id'),
        {'workspace_id': current_user.workspace_id},
    )
    next_number = int(seq_result.scalar_one())
    credit_number = f'AV-{body.issue_date.year}-{next_number:05d}'

    insert_result = await db.execute(
        text('''
            INSERT INTO erp_credit_notes (
                workspace_id, invoice_id, credit_number, issue_date, amount,
                net_amount, tax_amount, reason, status, created_by
            ) VALUES (
                :workspace_id, :invoice_id, :credit_number, :issue_date, :amount,
                :net_amount, :tax_amount, :reason, 'issued', :created_by
            )
            RETURNING id, credit_number, issue_date, amount, net_amount,
                      tax_amount, reason, status, created_at
        '''),
        {
            'workspace_id': current_user.workspace_id,
            'invoice_id': invoice.id,
            'credit_number': credit_number,
            'issue_date': body.issue_date,
            'amount': amount,
            'net_amount': net_credit,
            'tax_amount': tax_credit,
            'reason': body.reason.strip(),
            'created_by': current_user.id,
        },
    )

    ar = await get_account_by_code(current_user.workspace_id, '1010', db)
    revenue = await get_account_by_code(current_user.workspace_id, '4001', db)
    cgst_acc = await get_account_by_code(current_user.workspace_id, '2010', db)
    sgst_acc = await get_account_by_code(current_user.workspace_id, '2011', db)
    igst_acc = await get_account_by_code(current_user.workspace_id, '2012', db)
    if ar and revenue:
        entry = JournalEntry(
            workspace_id=current_user.workspace_id,
            entry_date=body.issue_date,
            reference=credit_number,
            description=f'Credit note for {invoice.invoice_number} - {invoice.customer_name}',
            is_system=True,
            created_by=current_user.id,
        )
        if net_credit > 0:
            entry.lines.append(JournalEntryLine(account_id=revenue.id, debit=net_credit, credit=0, description=credit_number))
        if cgst_credit > 0 and cgst_acc:
            entry.lines.append(JournalEntryLine(account_id=cgst_acc.id, debit=cgst_credit, credit=0, description=credit_number))
        if sgst_credit > 0 and sgst_acc:
            entry.lines.append(JournalEntryLine(account_id=sgst_acc.id, debit=sgst_credit, credit=0, description=credit_number))
        if igst_credit > 0 and igst_acc:
            entry.lines.append(JournalEntryLine(account_id=igst_acc.id, debit=igst_credit, credit=0, description=credit_number))
        entry.lines.append(JournalEntryLine(account_id=ar.id, debit=0, credit=amount, description=invoice.invoice_number))
        db.add(entry)

    await db.commit()
    credit = dict(insert_result.mappings().one())
    return {
        **credit,
        'invoice_id': invoice.id,
        'invoice_number': invoice.invoice_number,
        'customer_name': invoice.customer_name,
        'refunded_amount': Decimal('0'),
        'refundable_balance': amount,
    }


@router.post('/{credit_note_id}/refunds', status_code=201)
async def refund_credit_note(
    credit_note_id: int,
    body: RefundBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    if body.method not in PAYMENT_METHODS:
        raise HTTPException(400, f'Unsupported refund method: {body.method}')
    await seed_accounts_if_empty(current_user.workspace_id, db)

    credit_result = await db.execute(
        text('''
            SELECT cn.id, cn.invoice_id, cn.credit_number, cn.amount, cn.status,
                   i.invoice_number, i.customer_name, i.total, i.status AS invoice_status
            FROM erp_credit_notes cn
            JOIN invoices i ON i.id = cn.invoice_id
            WHERE cn.id = :credit_id AND cn.workspace_id = :workspace_id
            FOR UPDATE OF cn
        '''),
        {'credit_id': credit_note_id, 'workspace_id': current_user.workspace_id},
    )
    credit = credit_result.mappings().first()
    if not credit:
        raise HTTPException(404, 'Credit note not found')

    refund_sum_result = await db.execute(
        text('SELECT COALESCE(SUM(amount), 0) FROM erp_credit_refunds WHERE credit_note_id = :credit_id AND workspace_id = :workspace_id'),
        {'credit_id': credit_note_id, 'workspace_id': current_user.workspace_id},
    )
    refunded_on_credit = money(refund_sum_result.scalar_one() or 0)
    credit_balance = money(credit['amount']) - refunded_on_credit

    invoice = await db.scalar(select(Invoice).where(Invoice.id == credit['invoice_id']))
    paid = await _paid_amount(invoice, db)
    all_refunds_result = await db.execute(
        text('''
            SELECT COALESCE(SUM(r.amount), 0)
            FROM erp_credit_refunds r
            JOIN erp_credit_notes cn ON cn.id = r.credit_note_id
            WHERE cn.invoice_id = :invoice_id AND r.workspace_id = :workspace_id
        '''),
        {'invoice_id': credit['invoice_id'], 'workspace_id': current_user.workspace_id},
    )
    already_refunded_for_invoice = money(all_refunds_result.scalar_one() or 0)
    cash_available = max(paid - already_refunded_for_invoice, Decimal('0'))
    refundable = min(credit_balance, cash_available)
    amount = money(body.amount)
    if amount > refundable:
        raise HTTPException(400, f'Refund exceeds refundable cash amount ({refundable})')

    insert_result = await db.execute(
        text('''
            INSERT INTO erp_credit_refunds (
                workspace_id, credit_note_id, refund_date, amount, method,
                reference, notes, created_by
            ) VALUES (
                :workspace_id, :credit_note_id, :refund_date, :amount, :method,
                :reference, :notes, :created_by
            )
            RETURNING id, refund_date, amount, method, reference, notes, created_at
        '''),
        {
            'workspace_id': current_user.workspace_id,
            'credit_note_id': credit_note_id,
            'refund_date': body.refund_date,
            'amount': amount,
            'method': body.method,
            'reference': body.reference,
            'notes': body.notes,
            'created_by': current_user.id,
        },
    )

    ar = await get_account_by_code(current_user.workspace_id, '1010', db)
    cash_code = '1001' if body.method == 'cash' else '1002'
    cash = await get_account_by_code(current_user.workspace_id, cash_code, db)
    if ar and cash:
        entry = JournalEntry(
            workspace_id=current_user.workspace_id,
            entry_date=body.refund_date,
            reference=f"REF-{credit['credit_number']}"[:64],
            description=f"Refund to {credit['customer_name']}",
            is_system=True,
            created_by=current_user.id,
        )
        entry.lines.append(JournalEntryLine(account_id=ar.id, debit=amount, credit=0, description=credit['credit_number']))
        entry.lines.append(JournalEntryLine(account_id=cash.id, debit=0, credit=amount, description=body.method))
        db.add(entry)

    new_refunded = refunded_on_credit + amount
    new_status = 'refunded' if new_refunded >= money(credit['amount']) else 'partial_refund'
    await db.execute(
        text('UPDATE erp_credit_notes SET status = :status WHERE id = :credit_id AND workspace_id = :workspace_id'),
        {'status': new_status, 'credit_id': credit_note_id, 'workspace_id': current_user.workspace_id},
    )
    await db.commit()
    refund = dict(insert_result.mappings().one())
    return {
        **refund,
        'credit_note_id': credit_note_id,
        'credit_number': credit['credit_number'],
        'invoice_number': credit['invoice_number'],
        'customer_name': credit['customer_name'],
        'credit_status': new_status,
        'refunded_amount': new_refunded,
        'credit_balance': max(money(credit['amount']) - new_refunded, Decimal('0')),
    }
