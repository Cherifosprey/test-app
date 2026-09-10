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

CREATE_SUPPLIERS_TABLE = """
CREATE TABLE IF NOT EXISTS erp_suppliers (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(64),
    email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
)
"""

CREATE_PURCHASE_ORDERS_TABLE = """
CREATE TABLE IF NOT EXISTS erp_purchase_orders (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES erp_suppliers(id) ON DELETE SET NULL,
    po_number VARCHAR(64) NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    currency VARCHAR(8) NOT NULL DEFAULT 'XOF',
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_items TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    stock_received BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, po_number)
)
"""

CREATE_INVOICE_PAYMENTS_TABLE = """
CREATE TABLE IF NOT EXISTS erp_invoice_payments (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(14,2) NOT NULL,
    method VARCHAR(32) NOT NULL DEFAULT 'cash',
    reference VARCHAR(128),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
)
"""

CREATE_SUPPLIER_INVOICES_TABLE = """
CREATE TABLE IF NOT EXISTS erp_supplier_invoices (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES erp_suppliers(id) ON DELETE RESTRICT,
    purchase_order_id INTEGER REFERENCES erp_purchase_orders(id) ON DELETE SET NULL,
    invoice_number VARCHAR(96) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    currency VARCHAR(8) NOT NULL DEFAULT 'XOF',
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'open',
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, supplier_id, invoice_number)
)
"""

CREATE_SUPPLIER_PAYMENTS_TABLE = """
CREATE TABLE IF NOT EXISTS erp_supplier_payments (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    supplier_invoice_id INTEGER NOT NULL REFERENCES erp_supplier_invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(14,2) NOT NULL,
    method VARCHAR(32) NOT NULL DEFAULT 'cash',
    reference VARCHAR(128),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
)
"""

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_erp_suppliers_workspace ON erp_suppliers(workspace_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_purchase_orders_workspace ON erp_purchase_orders(workspace_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_purchase_orders_supplier ON erp_purchase_orders(supplier_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_invoice_payments_workspace ON erp_invoice_payments(workspace_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_invoice_payments_invoice ON erp_invoice_payments(invoice_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_supplier_invoices_workspace ON erp_supplier_invoices(workspace_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_supplier_invoices_supplier ON erp_supplier_invoices(supplier_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_supplier_payments_workspace ON erp_supplier_payments(workspace_id)",
    "CREATE INDEX IF NOT EXISTS idx_erp_supplier_payments_invoice ON erp_supplier_payments(supplier_invoice_id)",
]

ERP_SCHEMA_UPGRADES = [
    "ALTER TABLE erp_purchase_orders ADD COLUMN IF NOT EXISTS stock_received BOOLEAN NOT NULL DEFAULT FALSE",
]


async def ensure_erp_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text(CREATE_COMPANY_PROFILE_TABLE))
        await conn.execute(text(CREATE_SUPPLIERS_TABLE))
        await conn.execute(text(CREATE_PURCHASE_ORDERS_TABLE))
        await conn.execute(text(CREATE_INVOICE_PAYMENTS_TABLE))
        await conn.execute(text(CREATE_SUPPLIER_INVOICES_TABLE))
        await conn.execute(text(CREATE_SUPPLIER_PAYMENTS_TABLE))
        for statement in ERP_SCHEMA_UPGRADES:
            await conn.execute(text(statement))
        for statement in CREATE_INDEXES:
            await conn.execute(text(statement))
