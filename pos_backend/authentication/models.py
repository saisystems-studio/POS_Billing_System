"""
Authentication models for Ba_db Business Management System.

Login_tbl: Stores user authentication with roles (Admin/User)
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Custom user model mapped to Login_tbl.
    
    Extends Django's AbstractUser to include role management.
    Password is automatically hashed by Django.
    CreatedOn is auto-populated.
    
    Roles:
      - Admin: Full CRUD + User Management
      - User: Read + Create only (no Edit/Delete)
    """
    
    ROLE_CHOICES = [
        ('Admin', 'Admin'),
        ('User', 'User'),
    ]
    
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='User')
    
    # Django's AbstractUser already provides:
    # - username (NVARCHAR 150) → maps to UserName
    # - password (hashed) → maps to Password
    # - email (NVARCHAR 254)
    # - date_joined (DATETIME) → maps to CreatedOn
    
    class Meta:
        db_table = 'Login_tbl'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.username} ({self.role})"
    
    @property
    def is_admin(self):
        """Check if user has Admin role."""
        return self.role == 'Admin'
