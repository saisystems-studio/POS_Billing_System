"""
Authentication serializers for Ba_db Business Management System.

Handles:
- User Registration with validation
- User Profile display
- Profile Update
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    
    Validates:
    - Username required
    - Email required and unique
    - Password confirmation match
    - Secure password hashing on save
    """
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'confirm_password', 'role']
        extra_kwargs = {
            'username': {'required': True},
            'email': {'required': True},
            'role': {'required': False},
        }
    
    def validate_email(self, value):
        """Ensure email is unique."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()
    
    def validate(self, attrs):
        """Validate password confirmation matches."""
        if attrs['password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs
    
    def create(self, validated_data):
        """Create user with hashed password."""
        role = validated_data.pop('role', 'User')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=role,
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for displaying user profile information.
    """
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login', 'role']


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile.
    Allows updating username and email (not role or password).
    """
    
    class Meta:
        model = User
        fields = ['username', 'email']
    
    def validate_email(self, value):
        """Ensure email uniqueness excluding current user."""
        user = self.instance
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer for changing user password.
    Requires current password verification.
    """
    
    old_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    confirm_new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate_old_password(self, value):
        """Verify the current password is correct."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
    
    def validate(self, attrs):
        """Validate new passwords match."""
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError({"confirm_new_password": "New passwords do not match."})
        return attrs
    
    def save(self, **kwargs):
        """Apply the new password."""
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class UserListSerializer(serializers.ModelSerializer):
    """
    Serializer for Admin user management — listing all users.
    """
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']
