# Root URL configuration 

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication endpoints (login, register, profile, user management)
    path('api/auth/', include('authentication.urls')),

    # Business module endpoints
    path('api/', include('products.urls')),
    path('api/', include('barcodegenerator.urls')),
    path('api/', include('customers.urls')),
    path('api/', include('dashboard.urls')),
    path('api/', include('billing.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
