from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'upstream/frontend'


def patch_sidebar() -> None:
    path = FRONTEND / 'src/components/layout/Sidebar.jsx'
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines()
    new_lines = [line for line in lines if "to: '/gst'" not in line]
    if new_lines != lines:
        path.write_text('\n'.join(new_lines) + ('\n' if text.endswith('\n') else ''), encoding='utf-8')
        print(f'patched: {path.relative_to(ROOT)} (legacy GST link removed)')


def patch_router() -> None:
    path = FRONTEND / 'src/router/index.jsx'
    text = path.read_text(encoding='utf-8')
    legacy = "      { path: 'gst',                    element: gate('accounting',  <GSTPage />) },"
    redirect = "      { path: 'gst',                    element: <Navigate to=\"/company-settings\" replace /> },"
    if legacy in text:
        text = text.replace(legacy, redirect, 1)
    elif "path: 'gst'" in text and '/company-settings' not in next((line for line in text.splitlines() if "path: 'gst'" in line), ''):
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if "path: 'gst'" in line:
                indent = line[:len(line) - len(line.lstrip())]
                lines[i] = f'{indent}{{ path: \'gst\', element: <Navigate to="/company-settings" replace /> }},'
                break
        text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')
    path.write_text(text, encoding='utf-8')
    print(f'patched: {path.relative_to(ROOT)} (GST redirected)')


def main() -> None:
    if not FRONTEND.exists():
        raise SystemExit('Frontend SimpleSoft introuvable. Lancez le bootstrap après clonage.')
    patch_sidebar()
    patch_router()
    print('Navigation fiscale multi-pays appliquée.')


if __name__ == '__main__':
    main()
