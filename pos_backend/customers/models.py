from django.db import models
from django.conf import settings

class Customer(models.Model):
    PRICE_CODE_TYPE_CHOICES = [
        ('Fixed',  'Fixed Price'),
        ('Random', 'Random Price'),
    ]

    CustomerCode   = models.CharField(max_length=50, unique=True, editable=False)
    CustomerName   = models.CharField(max_length=200)
    # Stores pipe-separated address: "State | Country | PinCode | GSTType | GSTNo"
    Address        = models.TextField(null=True, blank=True)
    PhoneNumber    = models.CharField(max_length=10, null=True, blank=True)   # Made nullable
    WhatsappNumber = models.CharField(max_length=10, null=True, blank=True)  # 10-digit
    IsWhatsappSameAsPhone = models.BooleanField(default=False)
    EmailId        = models.EmailField(max_length=100, null=True, blank=True)
    IsGSTCustomer  = models.BooleanField(default=False)
    GSTNo          = models.CharField(max_length=20, null=True, blank=True)
    # PriceCode / PriceCodeType kept for backward-compat with existing data & invoice logic.
    # They are no longer shown in the Customer UI but remain in the database.
    PriceCode      = models.CharField(max_length=100, default='Retail')
    PriceCodeType  = models.CharField(
        max_length=10,
        choices=PRICE_CODE_TYPE_CHOICES,
        default='Fixed',
    )
    Customer_Redeem_Points = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00
    )
    IsActive   = models.BooleanField(default=True)
    CreatedOn  = models.DateTimeField(auto_now_add=True)
    UpdatedAt  = models.DateTimeField(auto_now=True)
    CreatedBy  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='customers',
        db_column='CreatedBy',
    )

    class Meta:
        db_table = 'Customer_tbl'
        ordering = ['-CreatedOn']
        indexes = [
            models.Index(fields=['CustomerCode'], name='idx_customer_code'),
            models.Index(fields=['CustomerName'], name='idx_customer_name'),
            models.Index(fields=['PhoneNumber'],  name='idx_customer_phone'),
        ]

    # ── Auto-generate CustomerCode as CUS_001, CUS_002, … ──────────────────
    def save(self, *args, **kwargs):
        if not self.CustomerCode:
            # First save to get the auto-increment id
            super().save(*args, **kwargs)
            self.CustomerCode = f"CUS_{str(self.id).zfill(3)}"
            kwargs['force_insert'] = False
            super().save(update_fields=['CustomerCode'])
        else:
            super().save(*args, **kwargs)

    @classmethod
    def next_code_preview(cls):
        """
        Return the CustomerCode that will be assigned to the *next* new customer.
        Used by the frontend Add form to pre-fill the read-only code field.
        """
        from django.db import connection
        # Find the current max id — next record will be max_id + 1
        # Works even when the table is empty.
        with connection.cursor() as cursor:
            cursor.execute("SELECT ISNULL(MAX(id), 0) FROM Customer_tbl")
            row = cursor.fetchone()
        next_id = (row[0] if row else 0) + 1
        return f"CUS_{str(next_id).zfill(3)}"

    def __str__(self):
        return f"{self.CustomerCode} - {self.CustomerName}"


class CustomerPriceConfig(models.Model):
    """Customer price configuration - replaces old PriceCode/PriceCodeType logic"""
    PRICE_TYPE_CHOICES = [
        ('Fixed', 'Fixed Price'),
        ('Random', 'Random Price'),
    ]
    
    CustomerID = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='price_configs',
        db_column='CustomerID'
    )
    PriceCodeType = models.CharField(max_length=10, choices=PRICE_TYPE_CHOICES)
    FixedPriceCodeID = models.ForeignKey(
        'products.PriceCodeList',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='customer_configs',
        db_column='FixedPriceCodeID'
    )
    IsActive = models.BooleanField(default=True)
    CreatedOn = models.DateTimeField(auto_now_add=True)
    CreatedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='customer_price_configs',
        db_column='CreatedBy'
    )

    class Meta:
        db_table = 'CustomerPriceConfig_tbl'
        ordering = ['-CreatedOn']
        indexes = [
            models.Index(fields=['CustomerID', 'IsActive'], name='idx_cust_price_active'),
        ]

    def __str__(self):
        return f"{self.CustomerID.CustomerName} - {self.PriceCodeType}"
