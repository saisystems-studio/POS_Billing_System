#!/usr/bin/env sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

cd pos_frontend
npm ci
npm run build
cd ..

rm -rf pos_backend/frontend_dist
mkdir -p pos_backend/frontend_dist
cp -R pos_frontend/dist/. pos_backend/frontend_dist/

cd pos_backend
.venv/bin/python manage.py collectstatic --noinput --clear
.venv/bin/python -m PyInstaller --clean --noconfirm POSBilling.spec
printf '%s\n' 'Build complete: pos_backend/dist/POSBilling/POSBilling'
