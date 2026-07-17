# Billing_tbl: Supermarket billing with customer reward points
#
# Reward point rule: 1 point per ₹100 spent  →  FLOOR(Amount / 100)
# After each successful bill, customer's Customer_Redeem_Points is incremented.

from django.db import models
from django.conf import settings
from customers.models import Customer
from products.models import Product, PriceCodeList


class BillingHeader(models.Model):
    """Header/master record for each bill"""
    BillNo = models.CharField(max_length=50, unique=True)
    BillDate = models.DateTimeField(auto_now_add=True)
    CustomerID = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='billing_headers',
        db_column='CustomerID'
    )
    PriceCodeType = models.CharField(max_length=10)  # Fixed or Random
    DefaultPriceCodeID = models.ForeignKey(
        PriceCodeList,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='billing_headers',
        db_column='DefaultPriceCodeID'
    )
    IsGSTBill = models.BooleanField(default=False)
    ItemCount = models.IntegerField(default=0)
    SubTotal = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    TotalDiscount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    GSTAmount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    TotalCGST = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    TotalSGST = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    TotalIGST = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    GrandTotal = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    EarnedPoints = models.IntegerField(default=0)
    CreatedOn = models.DateTimeField(auto_now_add=True)
    CreatedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='billing_headers',
        db_column='CreatedBy'
    )

    class Meta:
        db_table = 'BillingHeader_tbl'
        ordering = ['-CreatedOn']
        indexes = [
            models.Index(fields=['BillNo'], name='idx_bill_no'),
            models.Index(fields=['CustomerID'], name='idx_billhdr_customer'),
            models.Index(fields=['CreatedOn'], name='idx_billhdr_created'),
        ]

    def save(self, *args, **kwargs):
        if not self.BillNo:
            # First save to get auto-increment id
            super().save(*args, **kwargs)
            self.BillNo = f"INV_{str(self.id).zfill(6)}"
            kwargs['force_insert'] = False
            super().save(update_fields=['BillNo'])
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.BillNo} - {self.CustomerID.CustomerName}"


class Billing(models.Model):
    """Line items for each bill"""
    GST_TYPE_CHOICES = [
        ('NONE', 'No GST'),
        ('CGST_SGST', 'CGST + SGST'),
        ('IGST', 'IGST'),
    ]
    
    BillingHeaderID = models.ForeignKey(
        BillingHeader,
        on_delete=models.CASCADE,
        related_name='line_items',
        db_column='BillingHeaderID',
        null=True
    )
    LineNo = models.IntegerField(default=1)
    CustomerID  = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='billings',
        db_column='CustomerID',
    )
    ProductID   = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='billings',
        db_column='ProductID',
    )
    PriceCodeID = models.ForeignKey(
        PriceCodeList,
        on_delete=models.PROTECT,
        related_name='billings',
        db_column='PriceCodeID',
        null=True
    )
    Qty         = models.DecimalField(max_digits=10, decimal_places=2)
    Price       = models.DecimalField(max_digits=10, decimal_places=2)
    IsDiscountApplied = models.BooleanField(default=False)
    DiscountPercent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    DiscountAmount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    IsGSTApplied = models.BooleanField(default=False)
    GSTPercent = models.IntegerField(default=0)
    GSTAmount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    CGSTAmount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    SGSTAmount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    IGSTAmount = models.DecimalField(max_digits=18, decimal_places=2, default=0.00)
    GSTType = models.CharField(max_length=10, choices=GST_TYPE_CHOICES, default='NONE')
    Amount      = models.DecimalField(max_digits=18, decimal_places=2)
    ChangeableRate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    EarnedPoints = models.IntegerField(default=0)
    CreatedBy   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='billings',
        db_column='CreatedBy',
    )
    CreatedOn   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Billing_tbl'
        ordering = ['-CreatedOn']
        indexes = [
            models.Index(fields=['CustomerID'], name='idx_billing_customer'),
            models.Index(fields=['ProductID'],  name='idx_billing_product'),
            models.Index(fields=['CreatedOn'],  name='idx_billing_created'),
            models.Index(fields=['BillingHeaderID', 'LineNo'], name='idx_billing_header_line'),
        ]
        unique_together = [('BillingHeaderID', 'LineNo')]

    def __str__(self):
        return f"Bill #{self.pk} — {self.CustomerID.CustomerName} — ₹{self.Amount}"

    @staticmethod
    def calculate_earned_points(amount):
        """1 reward point per ₹100 spent (floor division)."""
        try:
            return int(float(amount) // 100)
        except (TypeError, ValueError):
            return 0


class BillingConfig(models.Model):
    """
    Settings → Billing Configuration
    Single-record table — only one config exists at a time.
    """
    ShowDiscount    = models.BooleanField(default=False)  # Discount toggle ON/OFF
    SkipEnabled     = models.BooleanField(default=False)  # Skip column toggle
    SkippedColumns  = models.JSONField(default=list, blank=True)  # list of column keys to skip
    UpdatedAt       = models.DateTimeField(auto_now=True)
    UpdatedBy       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='billing_configs',
        db_column='UpdatedBy',
        null=True, blank=True,
    )

    class Meta:
        db_table = 'BillingConfig_tbl'
        verbose_name = 'Billing Configuration'

    def __str__(self):
        return f"BillingConfig (Discount={self.ShowDiscount}, Skip={self.SkipEnabled})"
