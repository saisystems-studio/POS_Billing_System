# Dashboard, Company Info, UserSettings and Notifications URL configuration.

from django.urls import path
from .views import (
    DashboardSummaryView,
    # New CompanyConfig (CompanyInfo_tbl)
    CompanyConfigPublicView,
    CompanyConfigNextCodeView,
    CompanyConfigListCreateView,
    CompanyConfigDetailView,
    CompanyConfigHistoryView,
    # Legacy CompanyInfo (Company_Info) — kept for backward compat
    CompanyInfoView,
    CompanyInfoDetailView,
    CompanyInfoPublicView,
    # Settings & Notifications
    UserSettingsView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
)

urlpatterns = [
    # Dashboard
    path('dashboard/', DashboardSummaryView.as_view(), name='dashboard'),

    # ── New Company Config endpoints (CompanyInfo_tbl) ──
    path('company-info/public/',     CompanyConfigPublicView.as_view(),      name='company_config_public'),
    path('company-info/next-code/',  CompanyConfigNextCodeView.as_view(),    name='company_config_next_code'),
    path('company-info/history/',    CompanyConfigHistoryView.as_view(),     name='company_config_history'),
    path('company-info/',            CompanyConfigListCreateView.as_view(),  name='company_config_list'),
    path('company-info/<int:pk>/',   CompanyConfigDetailView.as_view(),      name='company_config_detail'),

    # ── Legacy Company Info endpoints (Company_Info) — backward compat ──
    path('company/public/', CompanyInfoPublicView.as_view(),             name='company_public'),
    path('company/',        CompanyInfoView.as_view(),                   name='company_list'),
    path('company/<int:pk>/', CompanyInfoDetailView.as_view(),           name='company_detail'),

    # User Settings
    path('settings/', UserSettingsView.as_view(), name='user_settings'),

    # Notifications
    path('notifications/',               NotificationListView.as_view(),       name='notification_list'),
    path('notifications/read-all/',      NotificationMarkAllReadView.as_view(), name='notification_read_all'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(),    name='notification_read'),
]
