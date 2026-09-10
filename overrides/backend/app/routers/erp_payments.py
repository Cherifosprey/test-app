import json
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.accounting_seed import get_account_by_code, seed_accounts_if_empty
from ..core.deps import get_current_user
from ..database import get_db
from ..models.accounting import JournalEntry, JournalEntryLine
from ..models.invoice import Invoice
from ..models.user import User, Workspace

router = APIRouter(prefix='/erp/payments', tags=['ERP Payments'])

PAYMENT_METHODS = {'cash', 'bank', 'mobile_money', 'card', 'cheque', 'other'}


class PaymentBody(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date = Field(default_factory=date.today)
    method: str = 'cash'
    reference: Optional[str] = None
    notes: Optional[str] = None


async def _require_invoices(current_user: User, db: AsyncSession) -> None:
    result = await db.execute(
        select(Workspace.enabled_modules).where(Workspace.id == current_user.workspace_id)
    )
    raw_modules = result.scalar_one_or_none() or '[]'
    try:
        modules = json.loads(raw_modules)
    except (TypeError, json.JSONDecodeError):
        modules = []
    if 'invoices' not in modules:
        raise HTTPException(403, 'Invoices module is not enabled for this workspace')


async def _credited_amount(invoice_id: int, workspace_id: int, db: AsyncSession) -> Decimal:
    result = await db.execute(
        text('SELECT COALESCE(SUM(amount), 0) FROM erp_credit_notes WHERE invoice_id = :invoice_id AND workspace_id = :workspace_id'),
        {'invoice_id': invoice_id, 'workspace_id': workspace_id},
    )
    return Decimal(str(result.scalar_one() or 0))


@router.get('/receivables')
async def list_receivables(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    result = await db.execute(
        text('''
            SELECT i.id, i.invoice_number, i.customer_name, i.invoice_date, i.due_date,
                   i.status, i.total,
                   CASE
                     WHEN i.status = 'paid' AND COALESCE(p.paid_amount, 0) = 0 THEN i.total
                     ELSE COALESCE(p.paid_amount, 0)
                   END AS paid_amount,
                   COALESCE(c.credited_amount, 0) AS credited_amount,
                   GREATEST(
                     i.total
                     - CASE
                         WHEN i.status = 'paid' AND COALESCE(p.paid_amount, 0) = 0 THEN i.total
                         ELSE COALESCE(p.paid_amount, 0)
                       END
                     - COALESCE(c.credited_amount, 0),
                     0
                   ) AS balance
            FROM invoices i
            LEFT JOIN (
                SELECT workspace_id, invoice_id, SUM(amount) AS paid_amount
                FROM erp_invoice_payments
                GROUP BY workspace_id, invoice_id
            ) p ON p.invoice_id = i.id AND p.workspace_id = i.workspace_id
            LEFT JOIN (
                SELECT workspace_id, invoice_id, SUM(amount) AS credited_amount
                FROM erp_credit_notes
                GROUP BY workspace_id, invoice_id
            ) c ON c.invoice_id = i.id AND c.workspace_id = i.workspace_id
            WHERE i.workspace_id = :workspace_id
              AND i.status IN ('sent', 'overdue', 'partial', 'paid')
            ORDER BY i.created_at DESC
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get('/recent')
async def list_recent_payments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    result = await db.execute(
        text('''
            SELECT p.id, p.payment_date, p.amount, p.method, p.reference, p.notes,
                   p.created_at, i.id AS invoice_id, i.invoice_number, i.customer_name
            FROM erp_invoice_payments p
            JOIN invoices i ON i.id = p.invoice_id
            WHERE p.workspace_id = :workspace_id
            ORDER BY p.created_at DESC
            LIMIT 100
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get('/invoice/{invoice_id}')
async def invoice_payment_history(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    invoice = await db.scalar(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.workspace_id == current_user.workspace_id,
        )
    )
    if not invoice:
        raise HTTPException(404, 'Invoice not found')

    result = await db.execute(
        text('''
            SELECT id, payment_date, amount, method, reference, notes, created_at
            FROM erp_invoice_payments
            WHERE invoice_id = :invoice_id AND workspace_id = :workspace_id
            ORDER BY payment_date DESC, id DESC
        '''),
        {'invoice_id': invoice_id, 'workspace_id': current_user.workspace_id},
    )
    payments = [dict(row) for row in result.mappings().all()]
    paid = sum((Decimal(str(item['amount'])) for item in payments), Decimal('0'))
    total = Decimal(str(invoice.total or 0))
    if invoice.status == 'paid' and paid == 0:
        paid = total
    credited = await _credited_amount(invoice_id, current_user.workspace_id, db)
    return {
        'invoice_id': invoice.id,
        'invoice_number': invoice.invoice_number,
        'customer_name': invoice.customer_name,
        'total': total,
        'paid_amount': paid,
        'credited_amount': credited,
        'balance': max(total - paid - credited, Decimal('0')),
        'payments': payments,
    }


@router.post('/invoice/{invoice_id}', status_code=201)
async def record_invoice_payment(
    invoice_id: int,
    body: PaymentBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_invoices(current_user, db)
    if body.method not in PAYMENT_METHODS:
        raise HTTPException(400, f'Unsupported payment method: {body.method}')

    await seed_accounts_if_empty(current_user.workspace_id, db)

    invoice_result = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.workspace_id == current_user.workspace_id,
        ).with_for_update()
    )
    invoice = invoice_result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, 'Invoice not found')
    if invoice.status not in ('sent', 'overdue', 'partial'):
        raise HTTPException(409, f'Cannot record payment for invoice status {invoice.status}')

    paid_result = await db.execute(
        text('''
            SELECT COALESCE(SUM(amount), 0)
            FROM erp_invoice_payments
            WHERE invoice_id = :invoice_id AND workspace_id = :workspace_id
        '''),
        {'invoice_id': invoice_id, 'workspace_id': current_user.workspace_id},
    )
    already_paid = Decimal(str(paid_result.scalar_one() or 0))
    credited = await _credited_amount(invoice_id, current_user.workspace_id, db)
    invoice_total = Decimal(str(invoice.total or 0))
    balance = invoice_total - already_paid - credited
    if balance <= 0:
        raise HTTPException(409, 'Invoice is already settled by payments and/or credit notes')
    if body.amount > balance:
        raise HTTPException(400, f'Payment exceeds remaining balance ({balance})')

    payment_result = await db.execute(
        text('''
            INSERT INTO erp_invoice_payments (
                workspace_id, invoice_id, payment_date, amount, method,
                reference, notes, created_by
            ) VALUES (
                :workspace_id, :invoice_id, :payment_date, :amount, :method,
                :reference, :notes, :created_by
            )
            RETURNING id, payment_date, amount, method, reference, notes, created_at
        '''),
        {
            'workspace_id': current_user.workspace_id,
            'invoice_id': invoice_id,
            'payment_date': body.payment_date,
            'amount': body.amount,
            'method': body.method,
            'reference': body.reference,
            'notes': body.notes,
            'created_by': current_user.id,
        },
    )
    payment = dict(payment_result.mappings().one())

    cash_code = '1001' if body.method == 'cash' else '1002'
    cash_account = await get_account_by_code(current_user.workspace_id, cash_code, db)
    receivable_account = await get_account_by_code(current_user.workspace_id, '1010', db)
    if cash_account and receivable_account:
        reference = f"PAY-{invoice.invoice_number}-{payment['id']}"
        entry = JournalEntry(
            workspace_id=current_user.workspace_id,
            entry_date=body.payment_date,
            reference=reference[:64],
            description=f'Payment received from {invoice.customer_name}',
            is_system=True,
            created_by=current_user.id,
        )
        entry.lines.append(JournalEntryLine(
            account_id=cash_account.id,
            debit=body.amount,
            credit=0,
            description=body.method,
        ))
        entry.lines.append(JournalEntryLine(
            account_id=receivable_account.id,
            debit=0,
            credit=body.amount,
            description=invoice.invoice_number,
        ))
        db.add(entry)

    new_paid = already_paid + body.amount
    remaining = max(invoice_total - new_paid - credited, Decimal('0'))
    invoice.status = 'paid' if remaining == 0 else 'partial'

    await db.commit()
    return {
        **payment,
        'invoice_id': invoice.id,
        'invoice_number': invoice.invoice_number,
        'invoice_total': invoice_total,
        'paid_amount': new_paid,
        'credited_amount': credited,
        'balance': remaining,
        'invoice_status': invoice.status,
    }
