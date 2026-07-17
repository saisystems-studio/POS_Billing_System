from django.urls import path
from .views import (
    BillingHeaderListView,
    BillingHeaderDetailView,
    BillingCreateView,
    BillingUpdateView,
    BillingCustomerDropdownView,
    BillingConfigView,
)

urlpatterns = [
    path('billing/create/',       BillingCreateView.as_view(),          name='billing_create'),
    path('billing/customers/',    BillingCustomerDropdownView.as_view(), name='billing_customers'),
    path('billing/config/',       BillingConfigView.as_view(),           name='billing_config'),
    path('billing/',              BillingHeaderListView.as_view(),       name='billing_list'),
    path('billing/<int:pk>/',     BillingHeaderDetailView.as_view(),     name='billing_detail'),
    path('billing/<int:pk>/edit/', BillingUpdateView.as_view(),          name='billing_edit'),
]
