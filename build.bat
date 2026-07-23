@echo off
setlocal
cd /d "%~dp0"

if not exist "pos_backend\.venv\Scripts\python.exe" (
  echo Missing pos_backend\.venv. Create it and install requirements.txt first.
  exit /b 1
)

pushd pos_frontend
call npm ci || exit /b 1
call npm run build || exit /b 1
popd

if not exist "pos_backend\frontend_dist" mkdir "pos_backend\frontend_dist"
robocopy "pos_frontend\dist" "pos_backend\frontend_dist" /MIR /NFL /NDL /NJH /NJS
if errorlevel 8 exit /b %errorlevel%

pushd pos_backend
.venv\Scripts\python.exe manage.py collectstatic --noinput --clear || exit /b 1
.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm POSBilling.spec || exit /b 1
popd

echo Build complete: pos_backend\dist\POSBilling\POSBilling.exe
endlocal
