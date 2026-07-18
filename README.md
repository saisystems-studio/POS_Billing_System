# Banu Store POS — Business Management System

Full-stack Point of Sale system built with Django REST Framework and React.js, backed by Microsoft SQL Server.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Axios, Vite |
| Backend | Python 3.13, Django 4.2, Django REST Framework 3.15 |
| Auth | SimpleJWT (access 60 min / refresh 7 days) |
| Database | Microsoft SQL Server 2017+ (ODBC Driver 17) |
| DB Adapter | mssql-django 1.4 (patched for SQL Server v17) |

---

## Project Structure

```
TASK/
├── pos_backend/          # Django project
│   ├── authentication/   # JWT auth, users, roles
│   ├── billing/          # Bills, line items
│   ├── customers/        # Customer master
│   ├── dashboard/        # Company info, settings, notifications
│   ├── products/         # Products, groups, price codes
│   ├── pos_backend/      # Django settings, urls, wsgi
│   ├── .env              # Environment variables (not in git)
│   ├── manage.py
│   ├── patch_mssql.py    # One-time patch for mssql-django on SQL Server 2017
│   └── requirements.txt
└── pos_frontend/         # React + Vite project
    ├── src/
    │   ├── components/   # Layout, ProtectedRoute, ConfirmModal, LoadingSpinner
    │   ├── context/      # AuthContext, ToastContext
    │   ├── data/         # India states/districts
    │   ├── pages/        # billing/, customers/, products/, Settings, Dashboard, Login
    │   └── services/     # api.js, authService, billingService, customerService, etc.
    ├── .env
    └── package.json
```

---

## Prerequisites

- **Python 3.12 or 3.13** (3.13 recommended)
- **Node.js 18+**
- **Microsoft SQL Server 2017+** (Express is fine)
- **ODBC Driver 17 for SQL Server** — [Download](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

---

## Backend Setup

### 1. Create and activate virtual environment

```powershell
cd pos_backend
python -m venv .venv
.venv\Scripts\activate
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Patch mssql-django (required every time venv is recreated)

`mssql-django 1.4` rejects SQL Server 2017 by default. Run the included patch script once:

```powershell
python patch_mssql.py
```

You should see:
```
✓ Patched: ...\.venv\Lib\site-packages\mssql\base.py
```

### 4. Configure environment variables

Create `.env` in `pos_backend/` (copy from `.env.example`):

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_NAME=BanustoresPOS_db
DB_HOST=.\SQLEXPRESS
DB_PORT=
FRONTEND_URL=http://localhost:5173
```

> Windows Authentication is used — no DB_USER / DB_PASSWORD needed for SQLEXPRESS.

### 5. Create the database in SQL Server

```sql
CREATE DATABASE BanustoresPOS_db;
```

### 6. Run migrations

```powershell
python manage.py migrate
```

### 7. Create admin user

```powershell
python manage.py createsuperuser
```

### 8. Start the server

```powershell
python manage.py runserver
```


cd d:\TASK\pos_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python patch_mssql.py(venc deactivate and delete)
python manage.py migrate
python manage.py runserver

Backend runs at → `http://localhost:8000`

---

## Frontend Setup

### 1. Install dependencies

```powershell
cd pos_frontend
npm install
```

### 2. Configure environment

Create `.env` in `pos_frontend/` (copy from `.env.example`):

```env
VITE_API_URL=http://localhost:8000/api
```

### 3. Start the dev server

```powershell
npm run dev
```

Frontend runs at → `http://localhost:5173`

---

## Daily Start (after first setup)

Open **two terminals**:

**Terminal 1 — Backend**
```powershell
cd pos_backend
.venv\Scripts\activate
python manage.py runserver
```

**Terminal 2 — Frontend**
```powershell
cd pos_frontend
npm run dev
```

---

## User Roles

| Role | Permissions |
|---|---|
| Admin | Full CRUD — products, customers, billing, settings, price codes, company info |
| User | Read + Create only (no edit/delete) |

---

## API Endpoints

### Authentication
| Method | URL | Description |
|---|---|---|
| POST | `/api/auth/login/` | Login, returns JWT tokens |
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET | `/api/auth/profile/` | Get current user profile |
| PATCH | `/api/auth/profile/update/` | Update profile |
| POST | `/api/auth/change-password/` | Change password |
| GET | `/api/auth/users/` | List users (Admin only) |

### Products
| Method | URL | Description |
|---|---|---|
| GET | `/api/products/` | List products (paginated, searchable) |
| POST | `/api/products/create-with-prices/` | Create product |
| PUT | `/api/products/create-with-prices/{id}/` | Update product (Admin) |
| DELETE | `/api/products/{id}/` | Delete/deactivate product (Admin) |
| GET | `/api/product-groups/` | List product groups |
| GET | `/api/product-groups/dropdown/` | Active groups for dropdowns |
| GET | `/api/price-codes/` | Active price codes (A, B, C, D, Retail) |
| POST | `/api/product-price-save/` | Save all price rates for a product (Admin) |
| GET | `/api/products/for-billing/` | Products with prices for billing |
| GET | `/api/products/for-price-page/` | All active products for price code list (Admin) |

### Customers
| Method | URL | Description |
|---|---|---|
| GET | `/api/customers/` | List customers (paginated, searchable) |
| POST | `/api/customers/` | Create customer |
| GET | `/api/customers/{id}/` | Get customer detail |
| PUT | `/api/customers/{id}/` | Update customer (Admin) |
| DELETE | `/api/customers/{id}/` | Delete customer (Admin) |
| GET | `/api/customers/next-code/` | Preview next customer code |

### Billing
| Method | URL | Description |
|---|---|---|
| GET | `/api/billing/` | List bills (paginated) |
| POST | `/api/billing/` | Create bill with line items |
| GET | `/api/billing/{id}/` | Bill detail |

### Dashboard & Settings
| Method | URL | Description |
|---|---|---|
| GET | `/api/dashboard/` | Summary stats |
| GET/POST | `/api/company/` | Company info |
| PUT | `/api/company/{id}/` | Update company info (Admin) |
| GET/PATCH | `/api/settings/` | User preferences (theme, notifications, keyboard shortcuts) |

---

## Database Tables

| Table | Description |
|---|---|
| `Login_tbl` | Users (custom auth model) |
| `Product_tbl` | Products |
| `ProductGroup_tbl` | Product categories |
| `Product_Price_Details_tbl` | Per-product price tiers |
| `PriceCodeList_tbl` | Price code master (A, B, C, D, Retail) |
| `Customer_tbl` | Customer master |
| `BillingHeader_tbl` | Bill header |
| `Billing_tbl` | Bill line items |
| `Company_Info` | Company profile |
| `User_Settings` | Per-user theme/notification/shortcut preferences |
| `Notification_tbl` | In-app notifications |

---

## Known Issues & Fixes

### SQL Server v17 not supported error

`mssql-django 1.4` throws `NotSupportedError: SQL Server v17 is not supported` after a fresh venv install. This is a bug in the library's version detection. **Always run the patch after installing requirements:**

```powershell
python patch_mssql.py
```

This is safe — it only adds version 17, 18, 19 to the supported list and clears the bytecode cache.

### pyodbc on Python 3.13

`pyodbc==5.1.0` has no pre-built wheel for Python 3.13 and requires Visual C++ Build Tools to compile. Use `pyodbc==5.2.0` (already in `requirements.txt`) which ships pre-built wheels for Python 3.13.

---

## Production Build

### Frontend
```powershell
cd pos_frontend
npm run build
# Output in dist/ — serve with Nginx or any static host
```

### Backend
```env
DEBUG=False
ALLOWED_HOSTS=yourdomain.com
SECRET_KEY=strong-random-key
```

```powershell
python manage.py collectstatic
# Use gunicorn or waitress as WSGI server
```

---

## License

Proprietary — Banu Store POS System
