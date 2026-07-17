"""
Run this once after: pip install -r requirements.txt
It patches mssql-django to support SQL Server v17 (2017) and above.

Usage:
    python patch_mssql.py
"""
import os, sys, re

def find_mssql_base():
    for path in sys.path:
        candidate = os.path.join(path, 'mssql', 'base.py')
        if os.path.isfile(candidate):
            return candidate
    # fallback: search site-packages inside .venv
    here = os.path.dirname(os.path.abspath(__file__))
    for root, dirs, files in os.walk(os.path.join(here, '.venv')):
        if 'base.py' in files and os.path.basename(root) == 'mssql':
            return os.path.join(root, 'base.py')
    return None

def patch(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    old = """    _sql_server_versions = {
        9: 2005,
        10: 2008,
        11: 2012,
        12: 2014,
        13: 2016,
        14: 2017,
        15: 2019,
        16: 2022,
    }"""

    new = """    _sql_server_versions = {
        9: 2005,
        10: 2008,
        11: 2012,
        12: 2014,
        13: 2016,
        14: 2017,
        15: 2019,
        16: 2022,
        17: 2022,
        18: 2022,
        19: 2022,
    }"""

    if '17: 2022' in content:
        print("✓ Already patched — nothing to do.")
        return

    if old not in content:
        print("✗ Could not find the version dict to patch. mssql-django may have changed.")
        sys.exit(1)

    patched = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(patched)

    # Delete cached bytecode so Python picks up the new source
    pycache = os.path.join(os.path.dirname(filepath), '__pycache__')
    if os.path.isdir(pycache):
        for fname in os.listdir(pycache):
            if fname.startswith('base') and fname.endswith('.pyc'):
                os.remove(os.path.join(pycache, fname))

    print(f"✓ Patched: {filepath}")

if __name__ == '__main__':
    path = find_mssql_base()
    if not path:
        print("✗ mssql/base.py not found. Is mssql-django installed?")
        sys.exit(1)
    patch(path)
