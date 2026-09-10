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


def patch_frontend_title() -> None:
    path = UPSTREAM / 'frontend/index.html'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'<title>.*?</title>', '<title>ERP Suite</title>', text, count=1, flags=re.I | re.S)
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_backend_main() -> None:
    path = UPSTREAM / 'backend/app/main.py'
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')

    if 'erp_admin' not in text:
        text = text.replace(', public\nfrom .routers.users', ', public, erp_admin\nfrom .routers.users', 1)

    include = 'app.include_router(erp_admin.router,          prefix="/api")'
    if include not in text:
        anchor = 'app.include_router(admin_pricing.router,       prefix="/api")'
        text = text.replace(anchor, anchor + '\n' + include, 1)

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
    patch_frontend_title()
    patch_backend_main()
    patch_backend_env()
    print('\nPersonnalisation ERP V1 appliquée avec succès.')


if __name__ == '__main__':
    main()
