"""
Authentication URL configuration.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    RegisterView,
    ProfileView,
    ProfileUpdateView,
    ChangePasswordView,
    UserManagementView,
    UserManagementDetailView,
)

urlpatterns = [
    # Authentication endpoints
    path('login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Profile management
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile/update/', ProfileUpdateView.as_view(), name='profile_update'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    
    # Admin user management
    path('users/', UserManagementView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserManagementDetailView.as_view(), name='user_detail'),
]
