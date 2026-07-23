"""
Desktop launcher for POS Billing System.
Opens the installed Chrome or Edge browser in app mode.

Run with: python main.py
"""
import os
import secrets
import sys
import ctypes
import threading
import logging
import shutil
import subprocess
import time
from pathlib import Path

MUTEX_NAME = "Global\\POSBillingSystem_SingleInstanceMutex"


def ensure_single_instance():
    """
    Prevents multiple copies of the app from running simultaneously.
    If another instance is already running, this one exits immediately.
    """
    create_mutex = ctypes.windll.kernel32.CreateMutexW
    create_mutex.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
    create_mutex.restype = ctypes.c_void_p

    mutex = create_mutex(None, False, MUTEX_NAME)
    if not mutex:
        raise ctypes.WinError()

    ERROR_ALREADY_EXISTS = 183
    if ctypes.windll.kernel32.GetLastError() == ERROR_ALREADY_EXISTS:
        ctypes.windll.kernel32.CloseHandle(mutex)

        ctypes.windll.user32.MessageBoxW(
            None,
            "POS Billing System is already running.\n"
            "Check your taskbar for the open window.",
            "Already Running",
            0x40,
        )
        sys.exit(0)

    return mutex


_singleton_mutex = ensure_single_instance()

if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')


def ensure_secret_key():
    """
    Generates a SECRET_KEY once per machine and persists it in
    %LOCALAPPDATA%\\POSBilling\\secret.key. On every subsequent launch,
    reuses the same key instead of generating a new one — regenerating
    it on every launch would silently invalidate all existing login
    sessions/JWTs every time the app restarts.
    """
    config_dir = Path(os.environ['LOCALAPPDATA']) / 'POSBilling'
    config_dir.mkdir(parents=True, exist_ok=True)
    key_file = config_dir / 'secret.key'

    if key_file.exists():
        key = key_file.read_text().strip()
    else:
        key = secrets.token_urlsafe(50)
        key_file.write_text(key)

    os.environ['SECRET_KEY'] = key


ensure_secret_key()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')

import django
django.setup()

from waitress import serve
from pos_backend.wsgi import application

HOST = '127.0.0.1'
PORT = 8000
IS_DEV = os.environ.get('POS_DEV', '0') == '1'
logging.basicConfig(
    filename=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.log'),
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
)


def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def relaunch_as_admin():
    global _singleton_mutex
    if _singleton_mutex:
        ctypes.windll.kernel32.CloseHandle(_singleton_mutex)
        _singleton_mutex = None

    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, " ".join(sys.argv), None, 1
    )
    sys.exit(0)


def needs_elevation():
    from provision_db import odbc_driver_installed, sql_express_service_exists
    return (
        not odbc_driver_installed()
        or not sql_express_service_exists()
    )


_backend_ready = threading.Event()


def start_backend():
    try:
        from provision_db import provision
        restart_needed = provision()

        if restart_needed:
            ctypes.windll.user32.MessageBoxW(
                None,
                "Setup is almost complete. Please RESTART your computer, "
                "then open POS Billing System again.",
                "Restart Required",
                0x40,
            )
            os._exit(0)

        logging.info(f"Starting Waitress on http://{HOST}:{PORT}")
        _backend_ready.set()
        serve(application, host=HOST, port=PORT, threads=4,
              connection_limit=200, channel_timeout=120)
    except Exception:
        logging.exception("Backend server crashed or failed to provision")
        ctypes.windll.user32.MessageBoxW(
            None,
            "Setup could not be completed. Please check app.log for details.",
            "Setup Failed",
            0x10,
        )
        os._exit(1)


def find_browser():
    for browser in ['chrome.exe', 'msedge.exe']:
        path = shutil.which(browser)
        if path:
            return path

    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


if __name__ == '__main__':
    if needs_elevation() and not is_admin():
        relaunch_as_admin()

    server_thread = threading.Thread(target=start_backend, daemon=True)
    server_thread.start()

    # Wait for first-run database provisioning before loading the UI.
    _backend_ready.wait()
    time.sleep(3)

    browser_path = find_browser()
    if browser_path:
        subprocess.Popen([
            browser_path,
            f'--app=http://{HOST}:{PORT}',
            '--window-size=1400,900',
        ])
    else:
        import webbrowser
        webbrowser.open(f'http://{HOST}:{PORT}')

    server_thread.join()
