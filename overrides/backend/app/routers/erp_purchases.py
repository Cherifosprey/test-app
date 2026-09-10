import json
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import get_current_user
from ..database import get_db
from ..models.user import User

router = APIRouter(prefix='/erp/purchases', tags=['ERP Purchases'])


class SupplierBody(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None


class PurchaseLine(BaseModel):
    product_id: Optional[int] = None
    description: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    tax_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)


class PurchaseOrderBody(BaseModel):
    supplier_id: int
    order_date: date = Field(default_factory=date.today)
    currency: str = Field(default='XOF', pattern='^(XOF|EUR|USD)$')
    lines: list[PurchaseLine] = Field(min_length=1)
    notes: Optional[str] = None


class PurchaseStatusBody(BaseModel):
    status: str = Field(pattern='^(draft|ordered|received|cancelled)$')


def _serialize_line(line: PurchaseLine) -> dict:
    subtotal = line.quantity * line.unit_price
    tax_amount = subtotal * line.tax_rate / Decimal('100')
    return {
        'product_id': line.product_id,
        'description': line.description,
        'quantity': float(line.quantity),
        'unit_price': float(line.unit_price),
        'tax_rate': float(line.tax_rate),
        'subtotal': float(subtotal),
        'tax_amount': float(tax_amount),
        'total': float(subtotal + tax_amount),
    }


@router.get('/suppliers')
async def list_suppliers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text('''
            SELECT id, name, phone, email, address, tax_id, is_active, created_at
            FROM erp_suppliers
            WHERE workspace_id = :workspace_id
            ORDER BY name ASC
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.post('/suppliers', status_code=201)
async def create_supplier(
    body: SupplierBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text('''
            INSERT INTO erp_suppliers (workspace_id, name, phone, email, address, tax_id)
            VALUES (:workspace_id, :name, :phone, :email, :address, :tax_id)
            RETURNING id, name, phone, email, address, tax_id, is_active, created_at
        '''),
        {'workspace_id': current_user.workspace_id, **body.model_dump()},
    )
    await db.commit()
    return dict(result.mappings().one())


@router.get('/orders')
async def list_purchase_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text('''
            SELECT po.id, po.po_number, po.order_date, po.status, po.currency,
                   po.subtotal, po.tax_amount, po.total_amount, po.line_items,
                   po.notes, po.created_at, s.id AS supplier_id, s.name AS supplier_name
            FROM erp_purchase_orders po
            LEFT JOIN erp_suppliers s ON s.id = po.supplier_id
            WHERE po.workspace_id = :workspace_id
            ORDER BY po.created_at DESC
        '''),
        {'workspace_id': current_user.workspace_id},
    )
    orders = []
    for row in result.mappings().all():
        item = dict(row)
        try:
            item['line_items'] = json.loads(item.get('line_items') or '[]')
        except (TypeError, json.JSONDecodeError):
            item['line_items'] = []
        orders.append(item)
    return orders


@router.post('/orders', status_code=201)
async def create_purchase_order(
    body: PurchaseOrderBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    supplier_result = await db.execute(
        text('SELECT id FROM erp_suppliers WHERE id = :id AND workspace_id = :workspace_id AND is_active = TRUE'),
        {'id': body.supplier_id, 'workspace_id': current_user.workspace_id},
    )
    if not supplier_result.first():
        raise HTTPException(404, 'Supplier not found')

    lines = [_serialize_line(line) for line in body.lines]
    subtotal = sum((Decimal(str(line['subtotal'])) for line in lines), Decimal('0'))
    tax_amount = sum((Decimal(str(line['tax_amount'])) for line in lines), Decimal('0'))
    total_amount = subtotal + tax_amount

    seq_result = await db.execute(
        text('SELECT COALESCE(MAX(id), 0) + 1 FROM erp_purchase_orders WHERE workspace_id = :workspace_id'),
        {'workspace_id': current_user.workspace_id},
    )
    next_number = int(seq_result.scalar_one())
    po_number = f'ACH-{body.order_date.year}-{next_number:05d}'

    result = await db.execute(
        text('''
            INSERT INTO erp_purchase_orders (
                workspace_id, supplier_id, po_number, order_date, status, currency,
                subtotal, tax_amount, total_amount, line_items, notes, created_by
            ) VALUES (
                :workspace_id, :supplier_id, :po_number, :order_date, 'draft', :currency,
                :subtotal, :tax_amount, :total_amount, :line_items, :notes, :created_by
            )
            RETURNING id, po_number, order_date, status, currency, subtotal,
                      tax_amount, total_amount, line_items, notes, created_at
        '''),
        {
            'workspace_id': current_user.workspace_id,
            'supplier_id': body.supplier_id,
            'po_number': po_number,
            'order_date': body.order_date,
            'currency': body.currency,
            'subtotal': subtotal,
            'tax_amount': tax_amount,
            'total_amount': total_amount,
            'line_items': json.dumps(lines),
            'notes': body.notes,
            'created_by': current_user.id,
        },
    )
    await db.commit()
    order = dict(result.mappings().one())
    order['line_items'] = lines
    order['supplier_id'] = body.supplier_id
    return order


@router.patch('/orders/{order_id}/status')
async def update_purchase_order_status(
    order_id: int,
    body: PurchaseStatusBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text('''
            UPDATE erp_purchase_orders
            SET status = :status, updated_at = NOW()
            WHERE id = :order_id AND workspace_id = :workspace_id
            RETURNING id, po_number, status
        '''),
        {
            'status': body.status,
            'order_id': order_id,
            'workspace_id': current_user.workspace_id,
        },
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, 'Purchase order not found')
    await db.commit()
    return dict(row)
