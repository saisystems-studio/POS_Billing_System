import logging
import os
from pathlib import Path
import subprocess
import sys
import time

import pyodbc


DB_NAME = "BanustoresPOS_db"
INSTANCE = r".\SQLEXPRESS"
ODBC_DRIVER = "ODBC Driver 17 for SQL Server"
SQL_SERVICE = r"MSSQL$SQLEXPRESS"
APP_DATA = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "POSBilling"
PROVISIONED_MARKER = APP_DATA / ".provisioned"
ODBC_CONN_STR = (
    f"DRIVER={{{ODBC_DRIVER}}};SERVER={INSTANCE};"
    "DATABASE=master;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;"
)


def get_prereqs_dir():
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "prereqs")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "prereqs")


def odbc_driver_installed():
    return ODBC_DRIVER in pyodbc.drivers()


def install_odbc_driver():
    logging.info("ODBC Driver 17 not found; installing...")
    msi = os.path.join(get_prereqs_dir(), "msodbcsql17.msi")
    result = subprocess.run(
        [
            "msiexec",
            "/i",
            msi,
            "/quiet",
            "/norestart",
            "IACCEPTMSODBCSQLLICENSETERMS=YES",
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )
    logging.info(
        "ODBC Driver 17 installer exited with code %s. stdout=%r stderr=%r",
        result.returncode,
        result.stdout,
        result.stderr,
    )
    if result.returncode not in (0, 3010):
        raise RuntimeError(
            f"ODBC Driver 17 installation failed with exit code "
            f"{result.returncode}. See app.log for installer output."
        )
    logging.info("ODBC Driver 17 installed.")


def query_sql_express_service():
    try:
        return subprocess.run(
            ["sc.exe", "query", SQL_SERVICE],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception:
        logging.exception("Failed querying SQL Express service")
        return None


def sql_express_service_exists():
    """Return True only when Windows confirms the exact service exists."""
    result = query_sql_express_service()
    if result is None:
        return False
    exists = result.returncode == 0
    if not exists:
        logging.info(
            "SQL Express service query returned %s. stdout=%r stderr=%r",
            result.returncode,
            result.stdout,
            result.stderr,
        )
    return exists


def sql_express_running():
    result = query_sql_express_service()
    return (
        result is not None
        and result.returncode == 0
        and "RUNNING" in result.stdout.upper()
    )


def provisioned_marker_exists():
    return PROVISIONED_MARKER.is_file()


def write_provisioned_marker():
    APP_DATA.mkdir(parents=True, exist_ok=True)
    PROVISIONED_MARKER.write_text(
        "POS Billing provisioning completed\n", encoding="utf-8"
    )
    logging.info("Provisioning marker written to %s", PROVISIONED_MARKER)


def requires_admin_provisioning():
    """Only installation and service startup require elevation."""
    if not odbc_driver_installed():
        return True
    if not sql_express_service_exists():
        return True
    return not sql_express_running()


def install_sql_express():
    logging.info(
        "SQL Server Express not found; installing (can take several minutes)..."
    )
    installer = os.path.join(get_prereqs_dir(), "SQLEXPR_x64_ENU.exe")
    command = [
        installer,
        "/ACTION=Install",
        "/QUIET",
        "/IACCEPTSQLSERVERLICENSETERMS",
        "/INSTANCENAME=SQLEXPRESS",
        "/FEATURES=SQLEngine",
        r"/SQLSVCACCOUNT=NT AUTHORITY\NETWORK SERVICE",
        r"/SQLSYSADMINACCOUNTS=BUILTIN\Administrators",
        "/TCPENABLED=0",
        "/NPENABLED=0",
    ]
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=1200
        )
    except subprocess.TimeoutExpired as exc:
        logging.error(
            "SQL Express installer timed out. stdout=%r stderr=%r",
            exc.stdout,
            exc.stderr,
        )
        raise

    logging.info(
        "SQL Express installer exited with code %s. stdout=%r stderr=%r",
        result.returncode,
        result.stdout,
        result.stderr,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"SQL Server Express installation failed with exit code "
            f"{result.returncode}. See app.log for installer output."
        )

    for _ in range(60):
        if sql_express_running():
            logging.info("SQL Server Express installed and running.")
            return
        time.sleep(5)
    raise RuntimeError("SQL Server Express installed but service did not start")


def start_sql_express():
    result = subprocess.run(
        ["sc.exe", "start", SQL_SERVICE],
        capture_output=True,
        text=True,
        timeout=30,
    )
    logging.info(
        "SQL Express service start returned %s. stdout=%r stderr=%r",
        result.returncode,
        result.stdout,
        result.stderr,
    )
    if result.returncode != 0 and not sql_express_running():
        raise RuntimeError(
            f"Could not start SQL Server Express service "
            f"(exit code {result.returncode})."
        )


def wait_for_sql_express(timeout_seconds=60):
    logging.info("Waiting for SQL Server Express to be reachable...")
    for _ in range(timeout_seconds // 5):
        try:
            conn = pyodbc.connect(ODBC_CONN_STR, timeout=5)
            conn.close()
            return True
        except pyodbc.Error:
            time.sleep(5)
    return False


def database_exists(cursor, db_name):
    cursor.execute(
        "SELECT 1 FROM sys.databases WHERE name = ?",
        db_name,
    )
    return cursor.fetchone() is not None


def get_default_database_files(cursor, db_name):
    cursor.execute(
        "SELECT "
        "CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)), "
        "CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(4000))"
    )
    data_dir, log_dir = cursor.fetchone()
    if not data_dir:
        raise RuntimeError("SQL Server did not report its default database data path.")
    log_dir = log_dir or data_dir
    return (
        str(Path(data_dir) / f"{db_name}.mdf"),
        str(Path(log_dir) / f"{db_name}_log.ldf"),
    )


def sql_server_file_exists(cursor, path):
    # Ask SQL Server itself so this works even when the desktop user's Windows
    # token cannot read the protected SQL DATA directory.
    cursor.execute("EXEC master.dbo.xp_fileexist ?", path)
    row = cursor.fetchone()
    return bool(row and row[0])


def database_files_are_unattached(cursor, paths):
    placeholders = ", ".join("?" for _ in paths)
    cursor.execute(
        f"SELECT physical_name FROM sys.master_files "
        f"WHERE physical_name IN ({placeholders})",
        *paths,
    )
    return cursor.fetchone() is None


def attach_existing_database(cursor, db_name, data_file, log_file):
    if not database_files_are_unattached(cursor, (data_file, log_file)):
        raise RuntimeError(
            "Existing database files are already attached to another database. "
            "No files were modified; review app.log and SQL Server configuration."
        )

    safe_name = db_name.replace("]", "]]")
    safe_data = data_file.replace("'", "''")
    safe_log = log_file.replace("'", "''")
    logging.warning(
        "Database '%s' is not registered, but its data files exist; "
        "attaching the existing files instead of creating or overwriting them.",
        db_name,
    )
    cursor.execute(
        f"CREATE DATABASE [{safe_name}] ON "
        f"(FILENAME = N'{safe_data}'), (FILENAME = N'{safe_log}') FOR ATTACH"
    )
    logging.info("Existing database files attached as '%s'.", db_name)


def ensure_database_exists():
    # ODBC_CONN_STR always targets master, which remains connectable before the
    # application database exists. CREATE DATABASE requires autocommit.
    conn = pyodbc.connect(ODBC_CONN_STR, autocommit=True, timeout=10)
    try:
        cursor = conn.cursor()
        if database_exists(cursor, DB_NAME):
            logging.info("Database '%s' already exists; skipping creation.", DB_NAME)
            return

        data_file, log_file = get_default_database_files(cursor, DB_NAME)
        data_exists = sql_server_file_exists(cursor, data_file)
        log_exists = sql_server_file_exists(cursor, log_file)
        if data_exists and log_exists:
            attach_existing_database(cursor, DB_NAME, data_file, log_file)
            return
        if data_exists or log_exists:
            raise RuntimeError(
                f"Database '{DB_NAME}' is not registered, but only one of its "
                f"expected files exists. No files were modified. Data: {data_file}; "
                f"Log: {log_file}. See app.log for recovery details."
            )

        logging.info("Database '%s' does not exist; creating it.", DB_NAME)
        cursor.execute(f"CREATE DATABASE [{DB_NAME}]")
        logging.info("Database '%s' created successfully.", DB_NAME)
    finally:
        conn.close()


def run_migrations():
    from django.core.management import call_command

    call_command("migrate", interactive=False, verbosity=1)
    logging.info("Migrations applied.")


def ensure_default_admin_exists():
    from authentication.models import User

    if User.objects.exists():
        logging.info("Users already exist; skipping default admin creation.")
        return

    default_username = "admin"
    default_password = "ChangeMe@123"
    user = User.objects.create_superuser(
        username=default_username,
        email="admin@example.com",
        password=default_password,
    )
    user.role = "Admin"
    user.save()
    logging.warning(
        "No users existed; created default admin account. "
        "Username: %s | Password: %s - CHANGE THIS PASSWORD IMMEDIATELY.",
        default_username,
        default_password,
    )


def provision():
    logging.info("=== provision() started ===")
    restart_needed = False

    logging.info("Checking exact ODBC driver: %s", ODBC_DRIVER)
    if not odbc_driver_installed():
        install_odbc_driver()

    marker_exists = provisioned_marker_exists()
    service_exists = sql_express_service_exists()
    if marker_exists and service_exists:
        logging.info(
            "Provisioning marker and SQLEXPRESS service found; skipping installation."
        )
    elif marker_exists:
        logging.warning(
            "Provisioning marker exists but SQLEXPRESS service is missing; "
            "falling back to full provisioning."
        )

    if not service_exists:
        install_sql_express()
    elif not sql_express_running():
        start_sql_express()

    if not wait_for_sql_express():
        raise RuntimeError(
            "Timed out waiting for SQL Server Express to accept connections"
        )

    ensure_database_exists()
    run_migrations()
    ensure_default_admin_exists()
    write_provisioned_marker()

    logging.info(
        "=== provision() completed, restart_needed=%s ===", restart_needed
    )
    return restart_needed
