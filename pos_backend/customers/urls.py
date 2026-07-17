from django.urls import path
from .views import CustomerListCreateView, CustomerDetailView, CustomerNextCodeView, CustomerPriceConfigView

urlpatterns = [
    path('customers/next-code/',          CustomerNextCodeView.as_view(),    name='customer_next_code'),
    path('customers/<int:pk>/price-config/', CustomerPriceConfigView.as_view(), name='customer_price_config'),
    path('customers/',                    CustomerListCreateView.as_view(),  name='customer_list'),
    path('customers/<int:pk>/',           CustomerDetailView.as_view(),      name='customer_detail'),
]
