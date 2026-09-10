from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'upstream/frontend'
BACKEND = ROOT / 'upstream/backend'


def patch_sidebar() -> None:
    path = FRONTEND / 'src/components/layout/Sidebar.jsx'
    text = path.read_text(encoding='utf-8')
    link = "      { to: '/supplier-finance', label: 'Dettes fournisseurs', icon: Wallet, module: 'purchases' },"
    if link not in text:
        anchor = "      { to: '/payments', label: 'Paiements', icon: CreditCard, module: 'invoices' },"
        if anchor not in text:
            raise RuntimeError('Paiements sidebar anchor not found')
        text = text.replace(anchor, anchor + '\n' + link, 1)
        path.write_text(text, encoding='utf-8')
        print(f'patched: {path.relative_to(ROOT)}')


def patch_frontend_router() -> None:
    path = FRONTEND / 'src/router/index.jsx'
    text = path.read_text(encoding='utf-8')

    import_line = "import SupplierFinancePage from '../pages/purchases/SupplierFinancePage.jsx';"
    if import_line not in text:
        anchor = "import PurchasesPage from '../pages/purchases/PurchasesPage.jsx';"
        if anchor not in text:
            raise RuntimeError('PurchasesPage import anchor not found')
        text = text.replace(anchor, anchor + '\n' + import_line, 1)

    route = "      { path: 'supplier-finance',        element: gate('purchases',   <SupplierFinancePage />) },"
    if route not in text:
        anchor = "      { path: 'purchases',               element: gate('purchases',   <PurchasesPage />) },"
        if anchor not in text:
            raise RuntimeError('Purchases route anchor not found')
        text = text.replace(anchor, anchor + '\n' + route, 1)

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_backend_main() -> None:
    path = BACKEND / 'app/main.py'
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines()

    for index, line in enumerate(lines):
        if line.startswith('from .routers import '):
            modules = [item.strip() for item in line.removeprefix('from .routers import ').split(',')]
            if 'erp_supplier_finance' not in modules:
                modules.append('erp_supplier_finance')
                lines[index] = 'from .routers import ' + ', '.join(modules)
            break
    else:
        raise RuntimeError('Backend router import line not found')

    text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    include = 'app.include_router(erp_supplier_finance.router, prefix="/api")'
    if include not in text:
        anchor = 'app.include_router(erp_payments.router,       prefix="/api")'
        if anchor not in text:
            raise RuntimeError('ERP payments include anchor not found')
        text = text.replace(anchor, anchor + '\n' + include, 1)

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def main() -> None:
    if not FRONTEND.exists() or not BACKEND.exists():
        raise SystemExit('Lancez d’abord scripts/apply_customizations.py après le clonage SimpleSoft.')
    patch_sidebar()
    patch_frontend_router()
    patch_backend_main()
    print('Finance fournisseurs branchée avec succès.')


if __name__ == '__main__':
    main()
