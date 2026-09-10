from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'upstream/frontend'
BACKEND = ROOT / 'upstream/backend'


def insert_after(text: str, marker: str, line: str, token: str) -> str:
    if token in text:
        return text
    lines = text.splitlines()
    for index, current in enumerate(lines):
        if marker in current:
            lines.insert(index + 1, line)
            return '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    raise RuntimeError(f'Anchor not found: {marker}')


def patch_sidebar() -> None:
    path = FRONTEND / 'src/components/layout/Sidebar.jsx'
    text = path.read_text(encoding='utf-8')
    text = insert_after(
        text,
        "to: '/payments'",
        "      { to: '/credits', label: 'Avoirs & remboursements', icon: Receipt, module: 'invoices' },",
        "to: '/credits'",
    )
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_frontend_router() -> None:
    path = FRONTEND / 'src/router/index.jsx'
    text = path.read_text(encoding='utf-8')
    text = insert_after(
        text,
        "import PaymentsPage from",
        "import CreditNotesPage from '../pages/credits/CreditNotesPage.jsx';",
        'CreditNotesPage',
    )
    text = insert_after(
        text,
        "path: 'payments'",
        "      { path: 'credits',                element: gate('invoices',    <CreditNotesPage />) },",
        "path: 'credits'",
    )
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def patch_backend_main() -> None:
    path = BACKEND / 'app/main.py'
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.startswith('from .routers import '):
            modules = [item.strip() for item in line.removeprefix('from .routers import ').split(',')]
            if 'erp_credits' not in modules:
                modules.append('erp_credits')
                lines[index] = 'from .routers import ' + ', '.join(modules)
            break
    else:
        raise RuntimeError('Backend router import line not found')
    text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    include = 'app.include_router(erp_credits.router,         prefix="/api")'
    if 'erp_credits.router' not in text:
        lines = text.splitlines()
        insert_at = next((i + 1 for i, line in enumerate(lines) if 'erp_payments.router' in line), None)
        if insert_at is None:
            raise RuntimeError('ERP payments include anchor not found')
        lines.insert(insert_at, include)
        text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)}')


def main() -> None:
    if not FRONTEND.exists() or not BACKEND.exists():
        raise SystemExit('SimpleSoft introuvable. Lancez le bootstrap après clonage.')
    patch_sidebar()
    patch_frontend_router()
    patch_backend_main()
    print('Avoirs et remboursements branchés avec succès.')


if __name__ == '__main__':
    main()
