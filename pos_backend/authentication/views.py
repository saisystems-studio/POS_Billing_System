"""
Authentication views for Ba_db Business Management System.

Provides:
- User Registration
- JWT Login
- User Profile CRUD
- Change Password
- Admin User Management
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import get_user_model

from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
    UserListSerializer,
    CustomTokenRefreshSerializer,
    revoke_refresh_token,
)
from .permissions import IsAdminRole

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer to include user information in response.
    """
    
    def validate(self, attrs):
        data = super().validate(attrs)

        # Add user information to token response
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'last_login': self.user.last_login.isoformat() if self.user.last_login else None,
        }

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    JWT Login endpoint with user information.
    
    POST /api/auth/login/
    {
        "username": "admin",
        "password": "password123"
    }
    
    Returns:
    {
        "access": "token...",
        "refresh": "token...",
        "user": {
            "id": 1,
            "username": "admin",
            "email": "admin@example.com",
            "role": "Admin"
        }
    }
    """
    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(TokenRefreshView):
    """
    Refresh endpoint backed by the custom revoked-token table.
    """

    serializer_class = CustomTokenRefreshSerializer


class LogoutView(APIView):
    """
    Revoke the submitted refresh token without using Simple JWT blacklist tables.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        raw_refresh = request.data.get('refresh')
        if not raw_refresh:
            return Response({'detail': 'Refresh token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(raw_refresh)
            revoke_refresh_token(refresh)
        except TokenError as exc:
            raise InvalidToken(exc.args[0]) from exc

        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class RegisterView(generics.CreateAPIView):
    """
    User registration endpoint.
    
    POST /api/auth/register/
    {
        "username": "newuser",
        "email": "user@example.com",
        "password": "secure_password123",
        "confirm_password": "secure_password123"
    }
    
    Returns created user info (excluding password).
    """
    
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            'message': 'User registered successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
            }
        }, status=status.HTTP_201_CREATED)


class ProfileView(generics.RetrieveAPIView):
    """
    Get current logged-in user's profile.
    
    GET /api/auth/profile/
    
    Returns user information including role and dates.
    """
    
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class ProfileUpdateView(generics.UpdateAPIView):
    """
    Update current user's profile (username/email only).
    
    PUT/PATCH /api/auth/profile/update/
    {
        "username": "updated_username",
        "email": "newemail@example.com"
    }
    """
    
    serializer_class = ProfileUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """
    Change password for current user.
    
    POST /api/auth/change-password/
    {
        "old_password": "current_password",
        "new_password": "new_secure_password",
        "confirm_new_password": "new_secure_password"
    }
    """
    
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)


class UserManagementView(generics.ListCreateAPIView):
    """
    Admin-only: List all users or create new user.
    
    GET /api/auth/users/
    Returns list of all users
    
    POST /api/auth/users/
    Create new user (Admin only)
    """
    
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserListSerializer
    permission_classes = [IsAdminRole]


class UserManagementDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin-only: Get, Update, or Delete a specific user.
    
    GET/PUT/PATCH/DELETE /api/auth/users/{id}/
    """
    
    queryset = User.objects.all()
    serializer_class = UserListSerializer
    permission_classes = [IsAdminRole]
