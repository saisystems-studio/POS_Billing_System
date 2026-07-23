from pathlib import Path
from datetime import timedelta
import sys
from decouple import AutoConfig


def env_bool(value):
    normalized = str(value).strip().lower()
    if normalized in {'1', 'true', 'yes', 'y', 'on', 'debug', 'development', 'dev'}:
        return True
    if normalized in {'0', 'false', 'no', 'n', 'off', 'release', 'production', 'prod', ''}:
        return False
    raise ValueError(f'Invalid boolean value: {value}')

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
IS_FROZEN = bool(getattr(sys, 'frozen', False))
BUNDLE_DIR = Path(getattr(sys, '_MEIPASS', BASE_DIR))
FRONTEND_DIST = BUNDLE_DIR / 'frontend_dist' if IS_FROZEN else BASE_DIR / 'frontend_dist'
CONFIG_DIR = Path(sys.executable).resolve().parent if IS_FROZEN else BASE_DIR
config = AutoConfig(search_path=str(CONFIG_DIR))

# ---------------------------------------------------------------------------
# Core security settings
# ---------------------------------------------------------------------------

SECRET_KEY = config('SECRET_KEY', default='development-only-change-me')

DEBUG = False if IS_FROZEN else config('DEBUG', default=False, cast=env_bool)

ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1',
    cast=lambda v: [s.strip() for s in v.split(',')],
)

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local apps
    'authentication',
    'products.apps.ProductsConfig',
    'barcodegenerator',
    'customers',
    'dashboard',
    'billing',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',        # must be before CommonMiddleware
    'django.middleware.gzip.GZipMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'pos_backend.middleware.ApiTimingMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'pos_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [FRONTEND_DIST],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'pos_backend.wsgi.application'
ASGI_APPLICATION = 'pos_backend.asgi.application'

# ---------------------------------------------------------------------------
# Database — Microsoft SQL Server (SQLEXPRESS) via mssql-django
# Windows Authentication — no username or password required.
# ---------------------------------------------------------------------------

DATABASES = {
    'default': {
        'ENGINE': 'mssql',
        'NAME': config('DB_NAME', default='BanustoresPOS_db'),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_SERVER', default=config('DB_HOST', default='.\\SQLEXPRESS')),
        'PORT': config('DB_PORT', default=''),
        'OPTIONS': {
            'driver': config('DB_DRIVER', default='ODBC Driver 17 for SQL Server'),
            'extra_params': config(
                'DB_EXTRA_PARAMS',
                default='Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;',
            ),
        },
    }
}

# ---------------------------------------------------------------------------
# Custom user model
# ---------------------------------------------------------------------------

AUTH_USER_MODEL = 'authentication.User'

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------

STATIC_URL = '/static/'
STATIC_ROOT = BUNDLE_DIR / 'staticfiles' if IS_FROZEN else BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
WHITENOISE_ROOT = FRONTEND_DIST

MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    # JWT Bearer tokens
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),

    # All endpoints require authentication unless explicitly overridden
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),

    # Pagination — page size 20, max 100 (Requirement 6.1, 12.1, 21.1)
    'DEFAULT_PAGINATION_CLASS': 'pos_backend.pagination.StandardResultsPagination',
    'PAGE_SIZE': 20,

    # Filter backends — search and ordering (Requirement 6.3, 6.4, 12.3, 12.4)
    'DEFAULT_FILTER_BACKENDS': [
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],

    # Throttling — relaxed for POS internal use (not a public API)
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/min',
        'user': '600/min',  # 10 req/sec — comfortable for multi-tab POS cashier use
        'auth': '30/min',
    },
}

# ---------------------------------------------------------------------------
# JWT configuration (djangorestframework-simplejwt)
# Access token: 60 minutes, Refresh token: 7 days (Requirement 1.2)
# ---------------------------------------------------------------------------

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
}

# ---------------------------------------------------------------------------
# CORS — only allow the Vite dev server origin (Requirement 22.3)
# Note: once the frontend is served BY Django on the same origin (packaged
# build), these settings become inert for that build since requests are
# same-origin. Left in unconditionally on purpose -- still required for the
# `npm run dev` workflow on port 5173/5174, and harmless otherwise.
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = [
    config('FRONTEND_URL', default='http://localhost:5173'),
    'http://localhost:5174',  
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'django_errors.log',
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
