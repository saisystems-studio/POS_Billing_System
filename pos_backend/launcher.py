"""Frozen desktop entry point: Waitress + Django + pywebview (Qt)."""

import html
import ctypes
import logging
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

HOST = '127.0.0.1'
STARTUP_TIMEOUT_SECONDS = 10

# Set before importing webview so QtWebEngine keeps desktop animations active.
os.environ.setdefault('QT_API', 'pyqt6')
os.environ.setdefault(
    'QTWEBENGINE_CHROMIUM_FLAGS',
    '--enable-gpu-rasterization --ignore-gpu-blocklist '
    '--enable-native-gpu-memory-buffers --disable-background-timer-throttling '
    '--disable-renderer-backgrounding --disable-backgrounding-occluded-windows',
)


def writable_app_dir():
    root = os.environ.get('LOCALAPPDATA') or str(Path.home())
    path = Path(root) / 'POSBilling'
    path.mkdir(parents=True, exist_ok=True)
    return path


APP_DATA = writable_app_dir()
logging.basicConfig(filename=APP_DATA / 'app.log', level=logging.INFO,
                    format='%(asctime)s %(levelname)s %(message)s')


def configure_environment():
    key_file = APP_DATA / 'secret.key'
    if key_file.exists():
        secret_key = key_file.read_text(encoding='utf-8').strip()
    else:
        secret_key = secrets.token_urlsafe(50)
        key_file.write_text(secret_key, encoding='utf-8')
    os.environ.setdefault('SECRET_KEY', secret_key)
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        candidate.bind((HOST, 0))
        return candidate.getsockname()[1]


def wait_until_ready(url, timeout=STARTUP_TIMEOUT_SECONDS):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    return
        except (OSError, URLError) as exc:
            last_error = exc
        time.sleep(0.1)
    raise TimeoutError(f'Django did not become ready within {timeout}s: {last_error}')


def error_document(exc):
    details = html.escape(str(exc))
    log_path = html.escape(str(APP_DATA / 'app.log'))
    return f'''<!doctype html><html><body style="font:15px system-ui;padding:30px;
      max-width:840px;margin:auto;color:#172b3a">
      <h2>POS Billing System could not start</h2>
      <p>SQL Server is unreachable or the application configuration is invalid.</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#f5f5f5;
        padding:16px;border-radius:6px;max-height:440px;overflow:auto">{details}</pre>
      <p>Check that SQL Server Express and ODBC Driver 17 are installed, then review:<br>{log_path}</p>
    </body></html>'''


def splash_document():
    return '''<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0; min-height: 100vh; display: grid; place-items: center;
            color: #17324d; background: linear-gradient(145deg, #f5fbff, #e8f3fa);
            font-family: "Segoe UI", system-ui, sans-serif;
          }
          main { text-align: center; padding: 36px; }
          .spinner {
            width: 48px; height: 48px; margin: 0 auto 22px;
            border: 5px solid #c9dfec; border-top-color: #1677a8;
            border-radius: 50%; animation: spin .85s linear infinite;
          }
          h2 { margin: 0 0 10px; font-size: 22px; }
          p { margin: 0; color: #547086; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <main>
          <div class="spinner" aria-hidden="true"></div>
          <h2>Starting POS Billing System</h2>
          <p>Please wait while the application gets ready...</p>
        </main>
      </body>
    </html>'''


def is_admin():
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def relaunch_as_admin():
    parameters = subprocess.list2cmdline(sys.argv[1:])
    result = ctypes.windll.shell32.ShellExecuteW(
        None, 'runas', sys.executable, parameters, None, 1
    )
    if result <= 32:
        raise RuntimeError('Administrator permission is required to install SQL prerequisites.')
    logging.info("Elevated POS Billing process started; exiting original process.")
    # SystemExit is not caught by the Exception handlers below, and webview.start()
    # has not been called yet, so the original process cannot continue into its GUI.
    raise SystemExit(0)


def elevate_if_required():
    from provision_db import requires_admin_provisioning

    if requires_admin_provisioning() and not is_admin():
        relaunch_as_admin()


def provision_database():
    from provision_db import provision

    import django
    django.setup()
    provision()


def start_application(splash):
    import webview

    try:
        provision_database()
        from django.db import connections
        connections['default'].ensure_connection()

        from pos_backend.wsgi import application
        from waitress import serve

        port = free_port()
        url = f'http://{HOST}:{port}/'
        server = threading.Thread(
            target=serve,
            kwargs={'app': application, 'host': HOST, 'port': port, 'threads': 8},
            name='waitress', daemon=True,
        )
        server.start()
        wait_until_ready(f'{url}health/')
        webview.create_window('POS Billing System', url=url, width=1400, height=900,
                              min_size=(1000, 700))
        splash.destroy()
    except Exception as exc:
        logging.exception('Desktop startup failed')
        splash.set_title('POS Billing System - Startup Error')
        splash.resize(900, 700)
        splash.load_html(error_document(exc))


def main():
    configure_environment()
    # This preflight runs before any window or GUI loop exists. A successful
    # runas relaunch raises SystemExit, so the non-elevated process ends here.
    elevate_if_required()

    import webview

    splash = webview.create_window(
        'POS Billing System',
        html=splash_document(),
        width=560,
        height=340,
        min_size=(560, 340),
        resizable=True,
    )
    webview.start(start_application, (splash,), gui='qt')


if __name__ == '__main__':
    main()
