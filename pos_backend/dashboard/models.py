# Dashboard and Company Information models

from django.db import models
from django.conf import settings

class CompanyInfo(models.Model):
    """Legacy table — kept for migration compatibility only. Use CompanyConfig instead."""
    CompanyName  = models.CharField(max_length=100)
    HasGST       = models.BooleanField(default=False)
    IsGSTEnabled = models.BooleanField(default=False)
    GSTNumber    = models.CharField(max_length=30, null=True, blank=True)
    GSTNo        = models.CharField(max_length=15, null=True, blank=True)
    PhoneNumber  = models.CharField(max_length=10)
    EmailId      = models.EmailField(max_length=100, null=True, blank=True)
    Address      = models.TextField(null=True, blank=True)
    Logo         = models.ImageField(upload_to='company_logos/', null=True, blank=True)
    CreatedOn    = models.DateTimeField(auto_now_add=True)
    UpdatedAt    = models.DateTimeField(auto_now=True)
    CreatedBy    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='company_info',
        db_column='CreatedBy',
    )

    class Meta:
        db_table = 'Company_Info'
        verbose_name = 'Company Information (Legacy)'

    def __str__(self):
        return self.CompanyName


class CompanyConfig(models.Model):
    """
    Single-company configuration table.
    db_table = CompanyInfo_tbl
    Only one record exists at all times.
    """
    CompanyCode      = models.CharField(max_length=50, unique=True, editable=False, null=True, blank=True)
    CompanyName      = models.CharField(max_length=200)
    PhoneNumber      = models.CharField(max_length=10)
    Email            = models.EmailField(max_length=200, null=True, blank=True)  # optional
    Address          = models.TextField()
    IsGSTRegistered  = models.BooleanField(default=False)
    GSTNumber        = models.CharField(max_length=15, null=True, blank=True)
    CompanyLogo      = models.ImageField(upload_to='company_logos/', null=True, blank=True)
    CreatedBy        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='company_config_records',
        db_column='CreatedBy',
    )
    CreatedOn        = models.DateTimeField(auto_now_add=True)
    UpdatedAt        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'CompanyInfo_tbl'
        verbose_name = 'Company Configuration'

    def save(self, *args, **kwargs):
        if not self.CompanyCode:
            super().save(*args, **kwargs)
            self.CompanyCode = f"COM_{str(self.id).zfill(3)}"
            kwargs['force_insert'] = False
            super().save(update_fields=['CompanyCode'])
        else:
            super().save(*args, **kwargs)

    @classmethod
    def next_code_preview(cls):
        """Return the CompanyCode that will be assigned to the next new record."""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT ISNULL(MAX(id), 0) FROM CompanyInfo_tbl")
            row = cursor.fetchone()
        next_id = (row[0] if row else 0) + 1
        return f"COM_{str(next_id).zfill(3)}"

    def __str__(self):
        return self.CompanyName


class CompanyConfigHistory(models.Model):
    """
    Snapshot of CompanyConfig saved before each update.
    Maintained automatically by the view layer on every PUT/PATCH.
    """
    CompanyName      = models.CharField(max_length=200)
    PhoneNumber      = models.CharField(max_length=10)
    Email            = models.EmailField(max_length=200, null=True, blank=True)
    Address          = models.TextField()
    IsGSTRegistered  = models.BooleanField(default=False)
    GSTNumber        = models.CharField(max_length=15, null=True, blank=True)
    CompanyLogo      = models.ImageField(upload_to='company_logos/', null=True, blank=True)
    ChangedBy        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='company_config_history',
        db_column='ChangedBy',
    )
    ChangedOn        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'CompanyInfo_History_tbl'
        ordering = ['-ChangedOn']
        verbose_name = 'Company Config History'

    def __str__(self):
        return f"{self.CompanyName} — {self.ChangedOn:%Y-%m-%d %H:%M}"


class UserSettings(models.Model):
    THEME_CHOICES = [('light', 'Light Mode'), ('dark', 'Dark Mode')]
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='settings',
    )
    theme                      = models.CharField(max_length=10, choices=THEME_CHOICES, default='light')
    notifications_enabled      = models.BooleanField(default=True)
    keyboard_shortcuts_enabled = models.BooleanField(default=True)
    keyboard_shortcuts         = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'User_Settings'
        verbose_name = 'User Settings'

    def __str__(self):
        return f"{self.user.username} — {self.theme}"


class Notification(models.Model):
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title      = models.CharField(max_length=200)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Notification_tbl'
        ordering = ['-created_at']
        verbose_name = 'Notification'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        MAX = 100
        ids = (Notification.objects.filter(user=self.user)
               .order_by('-created_at').values_list('id', flat=True)[MAX:])
        if ids:
            Notification.objects.filter(id__in=list(ids)).delete()

    def __str__(self):
        return f"{self.user.username}: {self.title}"
