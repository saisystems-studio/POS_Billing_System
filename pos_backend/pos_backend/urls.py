# Root URL configuration

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.generic import TemplateView
from django.views.static import serve as serve_static
from django.http import JsonResponse


def health(request):
    """Process readiness probe; intentionally does not query the database."""
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('products.urls')),
    path('api/', include('barcodegenerator.urls')),
    path('api/', include('customers.urls')),
    path('api/', include('dashboard.urls')),
    path('api/', include('billing.urls')),
    re_path(r'^media/(?P<path>.*)$', serve_static, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^(?!api/|admin/|media/|health/).*$', TemplateView.as_view(template_name='index.html')),
]
