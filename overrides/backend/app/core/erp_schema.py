from sqlalchemy import text
from ..database import engine


CREATE_COMPANY_PROFILE_TABLE = """
CREATE TABLE IF NOT EXISTS erp_company_profiles (
    workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    legal_name VARCHAR(255),
    trade_name VARCHAR(255),
    country VARCHAR(128),
    currency VARCHAR(8) NOT NULL DEFAULT 'XOF',
    phone VARCHAR(64),
    email VARCHAR(255),
    address TEXT,
    rccm VARCHAR(128),
    ifu VARCHAR(128),
    nif VARCHAR(128),
    tax_id VARCHAR(128),
    default_tax_rate NUMERIC(7,3) DEFAULT 0,
    invoice_prefix VARCHAR(32) DEFAULT 'FAC',
    logo_url TEXT,
    signature_url TEXT,
    stamp_url TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
)
"""


async def ensure_erp_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text(CREATE_COMPANY_PROFILE_TABLE))
