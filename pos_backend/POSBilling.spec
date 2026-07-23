# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

datas = [
    ('staticfiles', 'staticfiles'),
    ('frontend_dist', 'frontend_dist'),
    ('pos_backend\\templates', 'pos_backend\\templates'),
    ('.env.example', '.'),
    ('authentication\\migrations', 'authentication\\migrations'),
    ('products\\migrations', 'products\\migrations'),
    ('barcodegenerator\\migrations', 'barcodegenerator\\migrations'),
    ('customers\\migrations', 'customers\\migrations'),
    ('dashboard\\migrations', 'dashboard\\migrations'),
    ('billing\\migrations', 'billing\\migrations'),
    # Only prerequisites used by provision_db.py. This Qt build does not use
    # WebView2, and the bundled Python runtime does not require the .NET 4.8
    # installer.
    ('prereqs\\msodbcsql17.msi', 'prereqs'),
    ('prereqs\\SQLEXPR_x64_ENU.exe', 'prereqs'),
]
binaries = []
hiddenimports = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'waitress', 'waitress.runner', 'pyodbc', 'mssql', 'webview',
    'webview.platforms.qt', 'PyQt6', 'PyQt6.QtWebEngineCore',
    'rest_framework', 'corsheaders', 'whitenoise', 'pos_backend.middleware',
    'products.apps', 'PIL',
]
hiddenimports += collect_submodules('authentication')
hiddenimports += collect_submodules('products')
hiddenimports += collect_submodules('barcodegenerator')
hiddenimports += collect_submodules('customers')
hiddenimports += collect_submodules('dashboard')
hiddenimports += collect_submodules('billing')
hiddenimports += collect_submodules('whitenoise')
a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='POSBilling',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='POSBilling',
)
# EXE + COLLECT intentionally creates an onedir build. Do not replace it with
# onefile: extraction increases cold-start time and complicates Qt resources.
