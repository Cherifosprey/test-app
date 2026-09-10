from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'upstream/frontend'
BACKEND = ROOT / 'upstream/backend'


def insert_after_matching_line(text: str, marker: str, new_line: str, token: str) -> str:
    if token in text:
        return text
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if marker in line:
            lines.insert(index + 1, new_line)
            return '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    raise RuntimeError(f'Anchor not found: {marker}')


def patch_sidebar() -> None:
    path = FRONTEND / 'src/components/layout/Sidebar.jsx'
    text = path.read_text(encoding='utf-8')

    text = insert_after_matching_line(
        text,
        "to: '/invoices'",
        "      { to: '/payments', label: 'Paiements', icon: CreditCard, module: 'invoices' },",
        "to: '/payments'",
    )
    text = insert_after_matching_line(
        text,
        "to: '/payments'",
        "      { to: '/supplier-finance', label: 'Dettes fournisseurs', icon: Wallet, module: 'purchases' },",
        "to: '/supplier-finance'",
    )
    text = insert_after_matching_line(
        text,
        "to: '/products'",
        "      { to: '/purchases', label: 'Achats', icon: ShoppingCart, module: 'purchases' },",
        "to: '/purchases'",
    )

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_frontend_router() -> None:
    path = FRONTEND / 'src/router/index.jsx'
    text = path.read_text(encoding='utf-8')

    text = insert_after_matching_line(
        text,
        "import InvoicesPage from",
        "import PaymentsPage from '../pages/payments/PaymentsPage.jsx';",
        'PaymentsPage',
    )
    text = insert_after_matching_line(
        text,
        "import ProductsPage from",
        "import PurchasesPage from '../pages/purchases/PurchasesPage.jsx';",
        'PurchasesPage',
    )
    text = insert_after_matching_line(
        text,
        "import PurchasesPage from",
        "import SupplierFinancePage from '../pages/purchases/SupplierFinancePage.jsx';",
        'SupplierFinancePage',
    )

    text = insert_after_matching_line(
        text,
        "path: 'invoices'",
        "      { path: 'payments',               element: gate('invoices',    <PaymentsPage />) },",
        "path: 'payments'",
    )
    text = insert_after_matching_line(
        text,
        "path: 'products'",
        "      { path: 'purchases',               element: gate('purchases',   <PurchasesPage />) },",
        "path: 'purchases'",
    )
    text = insert_after_matching_line(
        text,
        "path: 'purchases'",
        "      { path: 'supplier-finance',        element: gate('purchases',   <SupplierFinancePage />) },",
        "path: 'supplier-finance'",
    )

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_admin_workspaces() -> None:
    path = BACKEND / 'app/routers/admin_workspaces.py'
    text = path.read_text(encoding='utf-8')
    if '"purchases"' not in text:
        lines = text.splitlines()
        for index, line in enumerate(lines):
            if '"inventory"' in line and 'ALL_MODULES' not in line:
                if line.rstrip().endswith(','):
                    lines[index] = line.rstrip()[:-1] + ', "purchases",'
                else:
                    lines[index] = line + ', "purchases"'
                text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
                break
        else:
            raise RuntimeError('Could not add purchases to ALL_MODULES')
        path.write_text(text, encoding='utf-8')
        print(f'patched: {path.relative_to(ROOT)}')


def patch_backend_main() -> None:
    path = BACKEND / 'app/main.py'
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines()

    additions = ['erp_admin', 'erp_company', 'erp_purchases', 'erp_payments', 'erp_supplier_finance']
    for index, line in enumerate(lines):
        if line.startswith('from .routers import '):
            modules = [item.strip() for item in line.removeprefix('from .routers import ').split(',')]
            for addition in additions:
                if addition not in modules:
                    modules.append(addition)
            lines[index] = 'from .routers import ' + ', '.join(modules)
            break
    else:
        raise RuntimeError('Backend router import line not found')

    text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    includes = [
        'app.include_router(erp_admin.router,          prefix="/api")',
        'app.include_router(erp_company.router,        prefix="/api")',
        'app.include_router(erp_purchases.router,      prefix="/api")',
        'app.include_router(erp_payments.router,       prefix="/api")',
        'app.include_router(erp_supplier_finance.router, prefix="/api")',
    ]
    for include in includes:
        module_token = include.split('(')[1].split('.')[0]
        if f'{module_token}.router' in text:
            continue
        lines = text.splitlines()
        insert_at = next((i + 1 for i, line in enumerate(lines) if 'admin_pricing.router' in line), None)
        if insert_at is None:
            raise RuntimeError('Backend include anchor not found')
        lines.insert(insert_at, include)
        text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def main() -> None:
    if not FRONTEND.exists() or not BACKEND.exists():
        raise SystemExit('Lancez d’abord scripts/apply_customizations.py après le clonage SimpleSoft.')
    patch_sidebar()
    patch_frontend_router()
    patch_admin_workspaces()
    patch_backend_main()
    print('Achats, paiements et finance fournisseurs branchés avec succès.')


if __name__ == '__main__':
    main()
