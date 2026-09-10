from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / 'upstream'
OVERRIDES = ROOT / 'overrides'


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    for path in src.rglob('*'):
        if path.is_dir():
            continue
        rel = path.relative_to(src)
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        print(f'override: {target.relative_to(ROOT)}')


def patch_sidebar() -> None:
    path = UPSTREAM / 'frontend/src/components/layout/Sidebar.jsx'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')

    if "../../config/erpConfig.js" not in text:
        anchor = "import Avatar from '../ui/Avatar.jsx';"
        text = text.replace(anchor, anchor + "\nimport { ERP_CONFIG } from '../../config/erpConfig.js';", 1)

    text = text.replace(
        '<span className="text-white text-xs font-bold">S</span>',
        '<span className="text-white text-xs font-bold">{ERP_CONFIG.brand.shortName}</span>',
    )
    text = text.replace(
        '<span className="font-bold text-white text-sm flex-1">SimpleSoft</span>',
        '<span className="font-bold text-white text-sm flex-1">{ERP_CONFIG.brand.name}</span>',
    )

    company_link = "      { to: '/company-settings', label: 'Mon entreprise', icon: Building2 },"
    if company_link not in text:
        anchor = "      { to: '/performance',     label: 'Performance',      icon: BarChart2, module: 'performance' },"
        text = text.replace(anchor, company_link + '\n' + anchor, 1)

    purchase_link = "      { to: '/purchases', label: 'Achats', icon: ShoppingCart, module: 'purchases' },"
    if purchase_link not in text:
        anchor = "      { to: '/products',  label: 'Products',  icon: Package, module: 'products' },"
        text = text.replace(anchor, anchor + '\n' + purchase_link, 1)

    replacements = {
        "label: 'Operations'": "label: 'Opérations'",
        "label: 'Tasks'": "label: 'Tâches'",
        "label: 'Projects'": "label: 'Projets'",
        "label: 'Files'": "label: 'Documents'",
        "label: 'Calendar'": "label: 'Calendrier'",
        "label: 'Financials'": "label: 'Finance'",
        "label: 'Invoices'": "label: 'Factures'",
        "label: 'Accounting'": "label: 'Comptabilité'",
        "label: 'Expenses'": "label: 'Dépenses'",
        "label: 'Sales & Commerce'": "label: 'Ventes & Commerce'",
        "label: 'Quotations'": "label: 'Devis'",
        "label: 'Sales Orders'": "label: 'Commandes'",
        "label: 'Supply Chain'": "label: 'Stock & Logistique'",
        "label: 'Products'": "label: 'Produits'",
        "label: 'Inventory'": "label: 'Stock'",
        "label: 'HR & Payroll'": "label: 'RH & Paie'",
        "label: 'Employees'": "label: 'Employés'",
        "label: 'Attendance'": "label: 'Présences'",
        "label: 'Leaves'": "label: 'Congés'",
        "label: 'Payroll'": "label: 'Paie'",
        "label: 'Automation'": "label: 'Automatisation'",
        "label: 'Help Desk'": "label: 'SAV / Support'",
        "'Plans & Modules'": "'Offres & Modules'",
        "'Help & Support'": "'Aide & Support'",
        "'Settings'": "'Paramètres'",
        "'Dashboard'": "'Tableau de bord'",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_admin_layout() -> None:
    path = UPSTREAM / 'frontend/src/pages/admin/AdminLayout.jsx'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')

    if 'Layers,' not in text:
        text = text.replace(
            'LayoutDashboard, Building2, Users, CreditCard, Tag,',
            'LayoutDashboard, Building2, Users, CreditCard, Tag, Layers,',
            1,
        )
    if "'/admin/erp-plans'" not in text:
        anchor = "  { to: '/admin/pricing',    label: 'Pricing',     icon: Tag },"
        addition = anchor + "\n  { to: '/admin/erp-plans',  label: 'Offres ERP',  icon: Layers },"
        text = text.replace(anchor, addition, 1)

    replacements = {
        "label: 'Dashboard'": "label: 'Tableau de bord'",
        "label: 'Workspaces'": "label: 'Entreprises'",
        "label: 'Users'": "label: 'Utilisateurs'",
        "label: 'Pricing'": "label: 'Tarifs'",
        "label: 'Billing'": "label: 'Facturation'",
        '>Infrastructure</p>': '>Gestion de la plateforme</p>',
        '>Admin Panel</span>': '>Administration ERP</span>',
        'title="Logout"': 'title="Déconnexion"',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_admin_workspaces() -> None:
    frontend_path = UPSTREAM / 'frontend/src/pages/admin/WorkspacesPage.jsx'
    if frontend_path.exists():
        text = frontend_path.read_text(encoding='utf-8')
        purchase_module = "      { key: 'purchases', label: 'Achats & Fournisseurs' },"
        if purchase_module not in text:
            anchor = "      { key: 'products',  label: 'Products Catalogue' },"
            text = text.replace(anchor, anchor + '\n' + purchase_module, 1)
        frontend_path.write_text(text, encoding='utf-8')
        print(f'patched: {frontend_path.relative_to(ROOT)}')

    backend_path = UPSTREAM / 'backend/app/routers/admin_workspaces.py'
    if backend_path.exists():
        text = backend_path.read_text(encoding='utf-8')
        if '"purchases"' not in text:
            text = text.replace(
                '"inventory", "performance", "automation", "helpdesk",',
                '"inventory", "purchases", "performance", "automation", "helpdesk",',
                1,
            )
        backend_path.write_text(text, encoding='utf-8')
        print(f'patched: {backend_path.relative_to(ROOT)}')


def patch_frontend_router() -> None:
    path = UPSTREAM / 'frontend/src/router/index.jsx'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')

    if 'ERPPlansPage' not in text:
        anchor = "import PricingPage from '../pages/admin/PricingPage.jsx';"
        text = text.replace(anchor, anchor + "\nimport ERPPlansPage from '../pages/admin/ERPPlansPage.jsx';", 1)

    if 'CompanySettingsPage' not in text:
        anchor = "import SettingsPage from '../pages/settings/SettingsPage.jsx';"
        text = text.replace(anchor, anchor + "\nimport CompanySettingsPage from '../pages/settings/CompanySettingsPage.jsx';", 1)

    if 'PurchasesPage' not in text:
        anchor = "import ProductsPage from '../pages/products/ProductsPage.jsx';"
        text = text.replace(anchor, anchor + "\nimport PurchasesPage from '../pages/purchases/PurchasesPage.jsx';", 1)

    admin_route = "      { path: 'erp-plans', element: <ERPPlansPage /> },"
    if admin_route not in text:
        anchor = "      { path: 'pricing', element: <PricingPage /> },"
        text = text.replace(anchor, anchor + '\n' + admin_route, 1)

    company_route = "      { path: 'company-settings', element: <CompanySettingsPage /> },"
    if company_route not in text:
        anchor = "      { path: 'settings',       element: <SettingsPage /> },"
        text = text.replace(anchor, anchor + '\n' + company_route, 1)

    purchase_route = "      { path: 'purchases',               element: gate('purchases',   <PurchasesPage />) },"
    if purchase_route not in text:
        anchor = "      { path: 'products',               element: gate('products',    <ProductsPage />) },"
        text = text.replace(anchor, anchor + '\n' + purchase_route, 1)

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_frontend_title() -> None:
    path = UPSTREAM / 'frontend/index.html'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'<title>.*?</title>', '<title>ERP Suite</title>', text, count=1, flags=re.I | re.S)
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_backend_router_imports(text: str, additions: list[str]) -> str:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.startswith('from .routers import '):
            existing = [name.strip() for name in line.removeprefix('from .routers import ').split(',')]
            for addition in additions:
                if addition not in existing:
                    existing.append(addition)
            lines[index] = 'from .routers import ' + ', '.join(existing)
            break
    return '\n'.join(lines) + ('\n' if text.endswith('\n') else '')


def patch_backend_main() -> None:
    path = UPSTREAM / 'backend/app/main.py'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')

    schema_import = 'from .core.erp_schema import ensure_erp_schema'
    if schema_import not in text:
        anchor = 'from .core.config import settings'
        text = text.replace(anchor, anchor + '\n' + schema_import, 1)

    text = patch_backend_router_imports(text, ['erp_admin', 'erp_company', 'erp_purchases'])

    if 'await ensure_erp_schema()' not in text:
        text = text.replace('    await init_db()\n    yield', '    await init_db()\n    await ensure_erp_schema()\n    yield', 1)

    includes = [
        'app.include_router(erp_admin.router,          prefix="/api")',
        'app.include_router(erp_company.router,        prefix="/api")',
        'app.include_router(erp_purchases.router,      prefix="/api")',
    ]
    anchor = 'app.include_router(admin_pricing.router,       prefix="/api")'
    for include in includes:
        if include not in text:
            text = text.replace(anchor, anchor + '\n' + include, 1)
            anchor = include
        else:
            anchor = include

    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_backend_env() -> None:
    path = UPSTREAM / 'backend/.env.example'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    if re.search(r'^APP_NAME=', text, flags=re.M):
        text = re.sub(r'^APP_NAME=.*$', 'APP_NAME=ERP Suite', text, flags=re.M)
    else:
        text += '\nAPP_NAME=ERP Suite\n'
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def main() -> None:
    frontend = UPSTREAM / 'frontend'
    backend = UPSTREAM / 'backend'
    if not frontend.exists() or not backend.exists():
        raise SystemExit('Lancez d’abord le script bootstrap afin de récupérer SimpleSoft.')

    copy_tree(OVERRIDES / 'frontend', frontend)
    copy_tree(OVERRIDES / 'backend', backend)
    patch_sidebar()
    patch_admin_layout()
    patch_admin_workspaces()
    patch_frontend_router()
    patch_frontend_title()
    patch_backend_main()
    patch_backend_env()
    print('\nPersonnalisation ERP V1 appliquée avec succès.')


if __name__ == '__main__':
    main()
