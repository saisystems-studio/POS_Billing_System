"""
Custom permission classes for Ba_db Business Management System.

Role-based access control enforced in Django backend.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    """
    Allow access only to users with Admin role.
    Used for user management and destructive operations.
    """
    
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'Admin'
        )


class IsAdminOrReadCreate(BasePermission):
    """
    Admin users: Full CRUD access
    Regular users: Read (GET, HEAD, OPTIONS) + Create (POST) only
    No edit or delete for regular users.
    
    This enforces the business rule:
    - User role: can view and add records
    - Admin role: can view, add, edit, delete records
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin can do everything
        if request.user.role == 'Admin':
            return True
        
        # Regular user can only GET (list/detail) and POST (create)
        if request.method in SAFE_METHODS or request.method == 'POST':
            return True
        
        # PUT, PATCH, DELETE are Admin-only
        return False
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin can do everything
        if request.user.role == 'Admin':
            return True
        
        # Regular users can only read
        return request.method in SAFE_METHODS
