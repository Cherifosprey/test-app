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
from ..models.user import User, Workspace

router = APIRouter(prefix='/erp/supplier-finance', tags=['ERP Supplier Finance'])

PAYMENT_METHODS = {'cash', 'bank', 'mobile_money', 'card', 'cheque', 'other'}


class SupplierInvoiceBody(BaseModel):
    supplier_id: int
    purchase_order_id: Optional[int] = None
    invoice_number: str = Field(min_length=1, max_length=96)
    invoice_date: date = Field(default_factory=date.today)
    due_date: Optional[date] = None
    currency: str = Field(default='XOF', pattern='^(XOF|EUR|USD)$')
    subtotal: Decimal = Field(ge=0)
    tax_amount: Decimal = Field(default=Decimal('0'), ge=0)
    notes: Optional[str] = None


class SupplierPaymentBody(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date = Field(default_factory=date.today)
    method: str = 'cash'
    reference: Optional[str] = None
    notes: Optional[str] = None


async def _require_purchases(current_user: User, db: AsyncSession) -> None:
    result = await db.execute(
        select(Workspace.enabled_modules).where(Workspace.id == current_user.workspace_id)
    )
    raw_modules = result.scalar_one_or_none() or '[]'
    try:
        modules = json.loads(raw_modules)
    except (TypeError, json.JSONDecodeError):
        modules = []
    if 'purchases' not in modules:
        raise HTTPException(403, 'Purchases module is not enabled for this workspace')


@router.get('/invoices')
async def list_supplier_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_purchases(current_user, db)
    result = await db.execute(
        text('''
            SELECT si.id, si.invoice_number, si.invoice_date, si.due_date, si.currency,
                   si.subtotal, si.tax_amount, si.total_amount, si.status, si.notes,
                   si.purchase_order_id, si.created_at,
                   s.id AS supplier_id, s.name AS supplier_name,
                   po.po_number,
                   COALESCE(SUM(sp.amount), 0) AS paid_amount,
                   GREATEST(si.total_amount - COALESCE(SUM(sp.amount), 0), 0) AS balance
            FROM erp_supplier_invoices si
            JOIN erp_suppliers s ON s.id = si.supplier_id
            LEFT JOIN erp_purchase_orders po ON po.id = si.purchase_order_id
            LEFT JOIN erp_supplier_payments sp
              ON sp.supplier_invoice_id = si.id AND sp.workspace_id = si.workspace_id
            WHERE si.workspace_id = :workspace_id
            GROUP BY si.id, s.id, s.name, po.po_number
            ORDER BY si.created_at DESC
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.post('/invoices', status_code=201)
async def create_supplier_invoice(
    body: SupplierInvoiceBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_purchases(current_user, db)
    await seed_accounts_if_empty(current_user.workspace_id, db)

    supplier = await db.execute(
        text('SELECT id, name FROM erp_suppliers WHERE id = :id AND workspace_id = :workspace_id AND is_active = TRUE'),
        {'id': body.supplier_id, 'workspace_id': current_user.workspace_id},
    )
    supplier_row = supplier.mappings().first()
    if not supplier_row:
        raise HTTPException(404, 'Supplier not found')

    if body.purchase_order_id is not None:
        po_result = await db.execute(
            text('''
                SELECT id, supplier_id FROM erp_purchase_orders
                WHERE id = :id AND workspace_id = :workspace_id
            '''),
            {'id': body.purchase_order_id, 'workspace_id': current_user.workspace_id},
        )
        po = po_result.mappings().first()
        if not po:
            raise HTTPException(404, 'Purchase order not found')
        if po['supplier_id'] != body.supplier_id:
            raise HTTPException(400, 'Purchase order belongs to another supplier')

    total_amount = body.subtotal + body.tax_amount

    try:
        result = await db.execute(
            text('''
                INSERT INTO erp_supplier_invoices (
                    workspace_id, supplier_id, purchase_order_id, invoice_number,
                    invoice_date, due_date, currency, subtotal, tax_amount,
                    total_amount, status, notes, created_by
                ) VALUES (
                    :workspace_id, :supplier_id, :purchase_order_id, :invoice_number,
                    :invoice_date, :due_date, :currency, :subtotal, :tax_amount,
                    :total_amount, 'open', :notes, :created_by
                )
                RETURNING id, invoice_number, invoice_date, due_date, currency,
                          subtotal, tax_amount, total_amount, status, notes, created_at
            '''),
            {
                'workspace_id': current_user.workspace_id,
                'supplier_id': body.supplier_id,
                'purchase_order_id': body.purchase_order_id,
                'invoice_number': body.invoice_number.strip(),
                'invoice_date': body.invoice_date,
                'due_date': body.due_date,
                'currency': body.currency,
                'subtotal': body.subtotal,
                'tax_amount': body.tax_amount,
                'total_amount': total_amount,
                'notes': body.notes,
                'created_by': current_user.id,
            },
        )
    except Exception as exc:
        await db.rollback()
        if 'unique' in str(exc).lower() or 'duplicate' in str(exc).lower():
            raise HTTPException(409, 'This supplier invoice number already exists') from exc
        raise

    purchases_account = await get_account_by_code(current_user.workspace_id, '5002', db)
    payable_account = await get_account_by_code(current_user.workspace_id, '2001', db)
    if purchases_account and payable_account and total_amount > 0:
        entry = JournalEntry(
            workspace_id=current_user.workspace_id,
            entry_date=body.invoice_date,
            reference=body.invoice_number[:64],
            description=f"Supplier invoice - {supplier_row['name']}",
            is_system=True,
            created_by=current_user.id,
        )
        entry.lines.append(JournalEntryLine(
            account_id=purchases_account.id,
            debit=total_amount,
            credit=0,
            description=body.invoice_number,
        ))
        entry.lines.append(JournalEntryLine(
            account_id=payable_account.id,
            debit=0,
            credit=total_amount,
            description=body.invoice_number,
        ))
        db.add(entry)

    await db.commit()
    invoice = dict(result.mappings().one())
    invoice['supplier_id'] = body.supplier_id
    invoice['supplier_name'] = supplier_row['name']
    invoice['purchase_order_id'] = body.purchase_order_id
    invoice['paid_amount'] = Decimal('0')
    invoice['balance'] = total_amount
    return invoice


@router.get('/payments/recent')
async def list_supplier_payments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_purchases(current_user, db)
    result = await db.execute(
        text('''
            SELECT sp.id, sp.payment_date, sp.amount, sp.method, sp.reference,
                   sp.notes, sp.created_at, si.id AS supplier_invoice_id,
                   si.invoice_number, s.id AS supplier_id, s.name AS supplier_name
            FROM erp_supplier_payments sp
            JOIN erp_supplier_invoices si ON si.id = sp.supplier_invoice_id
            JOIN erp_suppliers s ON s.id = si.supplier_id
            WHERE sp.workspace_id = :workspace_id
            ORDER BY sp.created_at DESC
            LIMIT 100
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.post('/invoices/{invoice_id}/payments', status_code=201)
async def record_supplier_payment(
    invoice_id: int,
    body: SupplierPaymentBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_purchases(current_user, db)
    if body.method not in PAYMENT_METHODS:
        raise HTTPException(400, f'Unsupported payment method: {body.method}')

    await seed_accounts_if_empty(current_user.workspace_id, db)

    invoice_result = await db.execute(
        text('''
            SELECT si.id, si.invoice_number, si.total_amount, si.status,
                   si.supplier_id, s.name AS supplier_name
            FROM erp_supplier_invoices si
            JOIN erp_suppliers s ON s.id = si.supplier_id
            WHERE si.id = :invoice_id AND si.workspace_id = :workspace_id
            FOR UPDATE OF si
        '''),
        {'invoice_id': invoice_id, 'workspace_id': current_user.workspace_id},
    )
    invoice = invoice_result.mappings().first()
    if not invoice:
        raise HTTPException(404, 'Supplier invoice not found')
    if invoice['status'] not in ('open', 'partial'):
        raise HTTPException(409, f"Cannot pay supplier invoice with status {invoice['status']}")

    paid_result = await db.execute(
        text('''
            SELECT COALESCE(SUM(amount), 0)
            FROM erp_supplier_payments
            WHERE supplier_invoice_id = :invoice_id AND workspace_id = :workspace_id
        '''),
        {'invoice_id': invoice_id, 'workspace_id': current_user.workspace_id},
    )
    already_paid = Decimal(str(paid_result.scalar_one() or 0))
    total = Decimal(str(invoice['total_amount'] or 0))
    balance = total - already_paid
    if balance <= 0:
        raise HTTPException(409, 'Supplier invoice is already fully paid')
    if body.amount > balance:
        raise HTTPException(400, f'Payment exceeds remaining balance ({balance})')

    payment_result = await db.execute(
        text('''
            INSERT INTO erp_supplier_payments (
                workspace_id, supplier_invoice_id, payment_date, amount,
                method, reference, notes, created_by
            ) VALUES (
                :workspace_id, :supplier_invoice_id, :payment_date, :amount,
                :method, :reference, :notes, :created_by
            )
            RETURNING id, payment_date, amount, method, reference, notes, created_at
        '''),
        {
            'workspace_id': current_user.workspace_id,
            'supplier_invoice_id': invoice_id,
            'payment_date': body.payment_date,
            'amount': body.amount,
            'method': body.method,
            'reference': body.reference,
            'notes': body.notes,
            'created_by': current_user.id,
        },
    )
    payment = dict(payment_result.mappings().one())

    payable_account = await get_account_by_code(current_user.workspace_id, '2001', db)
    cash_code = '1001' if body.method == 'cash' else '1002'
    cash_account = await get_account_by_code(current_user.workspace_id, cash_code, db)
    if payable_account and cash_account:
        reference = f"SPAY-{invoice['invoice_number']}-{payment['id']}"
        entry = JournalEntry(
            workspace_id=current_user.workspace_id,
            entry_date=body.payment_date,
            reference=reference[:64],
            description=f"Supplier payment - {invoice['supplier_name']}",
            is_system=True,
            created_by=current_user.id,
        )
        entry.lines.append(JournalEntryLine(
            account_id=payable_account.id,
            debit=body.amount,
            credit=0,
            description=invoice['invoice_number'],
        ))
        entry.lines.append(JournalEntryLine(
            account_id=cash_account.id,
            debit=0,
            credit=body.amount,
            description=body.method,
        ))
        db.add(entry)

    new_paid = already_paid + body.amount
    remaining = max(total - new_paid, Decimal('0'))
    new_status = 'paid' if remaining == 0 else 'partial'
    await db.execute(
        text('''
            UPDATE erp_supplier_invoices
            SET status = :status, updated_at = NOW()
            WHERE id = :invoice_id AND workspace_id = :workspace_id
        '''),
        {'status': new_status, 'invoice_id': invoice_id, 'workspace_id': current_user.workspace_id},
    )

    await db.commit()
    return {
        **payment,
        'supplier_invoice_id': invoice_id,
        'invoice_number': invoice['invoice_number'],
        'supplier_name': invoice['supplier_name'],
        'invoice_total': total,
        'paid_amount': new_paid,
        'balance': remaining,
        'invoice_status': new_status,
    }
