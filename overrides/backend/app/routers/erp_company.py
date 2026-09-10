from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import get_current_user
from ..database import get_db
from ..models.user import User

router = APIRouter(prefix='/erp/company-profile', tags=['ERP Company Profile'])


class CompanyProfileBody(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    country: Optional[str] = None
    currency: str = Field(default='XOF', pattern='^(XOF|EUR|USD)$')
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    rccm: Optional[str] = None
    ifu: Optional[str] = None
    nif: Optional[str] = None
    tax_id: Optional[str] = None
    default_tax_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    invoice_prefix: str = Field(default='FAC', max_length=32)
    logo_url: Optional[str] = None
    signature_url: Optional[str] = None
    stamp_url: Optional[str] = None


@router.get('')
async def get_company_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text('SELECT * FROM erp_company_profiles WHERE workspace_id = :workspace_id'),
        {'workspace_id': current_user.workspace_id},
    )
    row = result.mappings().first()
    if row:
        return dict(row)
    return {
        'workspace_id': current_user.workspace_id,
        'legal_name': current_user.workspace.name if current_user.workspace else None,
        'trade_name': current_user.workspace.name if current_user.workspace else None,
        'country': None,
        'currency': 'XOF',
        'phone': None,
        'email': None,
        'address': None,
        'rccm': None,
        'ifu': None,
        'nif': None,
        'tax_id': None,
        'default_tax_rate': 0,
        'invoice_prefix': 'FAC',
        'logo_url': None,
        'signature_url': None,
        'stamp_url': None,
    }


@router.patch('')
async def update_company_profile(
    body: CompanyProfileBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    values = body.model_dump()
    values['workspace_id'] = current_user.workspace_id

    await db.execute(
        text('''
            INSERT INTO erp_company_profiles (
                workspace_id, legal_name, trade_name, country, currency, phone, email,
                address, rccm, ifu, nif, tax_id, default_tax_rate, invoice_prefix,
                logo_url, signature_url, stamp_url, updated_at
            ) VALUES (
                :workspace_id, :legal_name, :trade_name, :country, :currency, :phone, :email,
                :address, :rccm, :ifu, :nif, :tax_id, :default_tax_rate, :invoice_prefix,
                :logo_url, :signature_url, :stamp_url, NOW()
            )
            ON CONFLICT (workspace_id) DO UPDATE SET
                legal_name = EXCLUDED.legal_name,
                trade_name = EXCLUDED.trade_name,
                country = EXCLUDED.country,
                currency = EXCLUDED.currency,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                address = EXCLUDED.address,
                rccm = EXCLUDED.rccm,
                ifu = EXCLUDED.ifu,
                nif = EXCLUDED.nif,
                tax_id = EXCLUDED.tax_id,
                default_tax_rate = EXCLUDED.default_tax_rate,
                invoice_prefix = EXCLUDED.invoice_prefix,
                logo_url = EXCLUDED.logo_url,
                signature_url = EXCLUDED.signature_url,
                stamp_url = EXCLUDED.stamp_url,
                updated_at = NOW()
        '''),
        values,
    )
    await db.commit()
    return {'ok': True, **values}
