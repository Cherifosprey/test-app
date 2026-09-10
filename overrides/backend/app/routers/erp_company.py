from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import get_current_user
from ..database import get_db
from ..models.user import User, Workspace

router = APIRouter(prefix='/erp/company-profile', tags=['ERP Company Profile'])


class CompanyProfileBody(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    country: Optional[str] = None
    locale: str = Field(default='fr-FR', max_length=16)
    currency: str = Field(default='XOF', pattern='^(XOF|EUR|USD)$')
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    rccm: Optional[str] = None
    ifu: Optional[str] = None
    nif: Optional[str] = None
    tax_id: Optional[str] = None
    tax_name: str = Field(default='TVA', max_length=32)
    tax_registration_label: str = Field(default='Identifiant fiscal', max_length=64)
    default_tax_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    prices_include_tax: bool = False
    tax_exemption_note: Optional[str] = None
    invoice_prefix: str = Field(default='FAC', max_length=32)
    invoice_footer: Optional[str] = None
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

    workspace_result = await db.execute(
        select(Workspace.name).where(Workspace.id == current_user.workspace_id)
    )
    workspace_name = workspace_result.scalar_one_or_none()

    return {
        'workspace_id': current_user.workspace_id,
        'legal_name': workspace_name,
        'trade_name': workspace_name,
        'country': None,
        'locale': 'fr-FR',
        'currency': 'XOF',
        'phone': None,
        'email': None,
        'address': None,
        'rccm': None,
        'ifu': None,
        'nif': None,
        'tax_id': None,
        'tax_name': 'TVA',
        'tax_registration_label': 'Identifiant fiscal',
        'default_tax_rate': 0,
        'prices_include_tax': False,
        'tax_exemption_note': None,
        'invoice_prefix': 'FAC',
        'invoice_footer': None,
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
                workspace_id, legal_name, trade_name, country, locale, currency, phone, email,
                address, rccm, ifu, nif, tax_id, tax_name, tax_registration_label,
                default_tax_rate, prices_include_tax, tax_exemption_note, invoice_prefix,
                invoice_footer, logo_url, signature_url, stamp_url, updated_at
            ) VALUES (
                :workspace_id, :legal_name, :trade_name, :country, :locale, :currency, :phone, :email,
                :address, :rccm, :ifu, :nif, :tax_id, :tax_name, :tax_registration_label,
                :default_tax_rate, :prices_include_tax, :tax_exemption_note, :invoice_prefix,
                :invoice_footer, :logo_url, :signature_url, :stamp_url, NOW()
            )
            ON CONFLICT (workspace_id) DO UPDATE SET
                legal_name = EXCLUDED.legal_name,
                trade_name = EXCLUDED.trade_name,
                country = EXCLUDED.country,
                locale = EXCLUDED.locale,
                currency = EXCLUDED.currency,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                address = EXCLUDED.address,
                rccm = EXCLUDED.rccm,
                ifu = EXCLUDED.ifu,
                nif = EXCLUDED.nif,
                tax_id = EXCLUDED.tax_id,
                tax_name = EXCLUDED.tax_name,
                tax_registration_label = EXCLUDED.tax_registration_label,
                default_tax_rate = EXCLUDED.default_tax_rate,
                prices_include_tax = EXCLUDED.prices_include_tax,
                tax_exemption_note = EXCLUDED.tax_exemption_note,
                invoice_prefix = EXCLUDED.invoice_prefix,
                invoice_footer = EXCLUDED.invoice_footer,
                logo_url = EXCLUDED.logo_url,
                signature_url = EXCLUDED.signature_url,
                stamp_url = EXCLUDED.stamp_url,
                updated_at = NOW()
        '''),
        values,
    )
    await db.commit()
    return {'ok': True, **values}
