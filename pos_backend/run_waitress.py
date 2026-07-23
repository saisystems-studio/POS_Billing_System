"""
Desktop launcher for POS Billing System.
Starts the Django backend (via Waitress) in a background thread,
then opens it in a native desktop window (no browser chrome) via pywebview.

Run with: python main.py
"""
import os
import sys
import threading
import logging

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')

import django
django.setup()

import webview
from waitress import serve
from pos_backend.wsgi import application

HOST = '127.0.0.1'
PORT = 8000

logging.basicConfig(
    filename=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.log'),
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
)


def start_backend():
    """Runs forever in a background thread. Never returns during normal operation."""
    try:
        logging.info(f"Starting Waitress on http://{HOST}:{PORT}")
        serve(application, host=HOST, port=PORT, threads=8,
              connection_limit=200, channel_timeout=120)
    except Exception:
        logging.exception("Backend server crashed")


if __name__ == '__main__':
    server_thread = threading.Thread(target=start_backend, daemon=True)
    server_thread.start()

    # daemon=True means this thread dies automatically when the main
    # process exits (i.e. when the window is closed) — no separate
    # shutdown handling needed for the server itself.

    window = webview.create_window(
        title='POS Billing System',
        url=f'http://{HOST}:{PORT}',
        width=1400,
        height=900,
        min_size=(1000, 700),
        confirm_close=False,
    )

    webview.start()
    # webview.start() blocks here until the window is closed.
    # Once it returns, the process exits and the daemon thread stops with it.