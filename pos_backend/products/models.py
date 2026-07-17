# Product models

from django.db import models
from django.conf import settings

class ProductGroup(models.Model):
    GroupName = models.CharField(max_length=200)
    HSNCode   = models.CharField(max_length=20, null=True, blank=True)
    GSTPercent = models.IntegerField(default=0, null=True, blank=True)
    IsActive  = models.BooleanField(default=True)
    CreatedOn = models.DateTimeField(auto_now_add=True)
    CreatedBy = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='product_groups',db_column='CreatedBy')

    class Meta:
        db_table = 'ProductGroup_tbl'
        ordering = ['GroupName']
        indexes = [
            models.Index(fields=['GroupName'], name='idx_group_name'),]

    def __str__(self):
        return self.GroupName


class Product(models.Model):
    GroupId = models.ForeignKey(
        ProductGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        db_column='GroupId'
    )
    ProductCode = models.CharField(max_length=50, unique=True, editable=False)
    ProductName = models.CharField(max_length=200)
    ProductNameTamil = models.CharField(max_length=200, null=True, blank=True)
    HSNCode = models.CharField(max_length=20, null=True, blank=True)
    GSTPercent = models.IntegerField(default=0)
    Quantity = models.IntegerField(null=True, blank=True)
    Units = models.CharField(max_length=100)
    UnitId = models.ForeignKey(
        'Unit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='products',
        db_column='UnitId',
    )
    Description = models.TextField(null=True, blank=True)
    IsActive  = models.BooleanField(default=True)
    CreatedOn = models.DateTimeField(auto_now_add=True)
    UpdatedAt = models.DateTimeField(auto_now=True)
    CreatedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='products', db_column='CreatedBy')

    class Meta:
        db_table = 'Product_tbl'
        ordering = ['-CreatedOn']
        indexes = [
            models.Index(fields=['ProductName'], name='idx_product_name'),
            models.Index(fields=['CreatedOn'],   name='idx_product_created'),
            models.Index(fields=['GroupId'],      name='idx_product_group'),
            models.Index(fields=['ProductCode'], name='idx_product_code'),
            models.Index(fields=['IsActive', 'id'], name='idx_product_active_id'),
            models.Index(fields=['IsActive', 'ProductName', 'id'], name='idx_product_active_name_id'),
            models.Index(fields=['IsActive', 'ProductCode', 'id'], name='idx_product_active_code_id'),
        ]

    def save(self, *args, **kwargs):
        if not self.ProductCode:
            super().save(*args, **kwargs)
            self.ProductCode = f"POD_{str(self.id).zfill(3)}"
            kwargs['force_insert'] = False
            super().save(update_fields=['ProductCode'])
        else:
            super().save(*args, **kwargs)

    @classmethod
    def next_code_preview(cls):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT ISNULL(MAX(id), 0) FROM Product_tbl")
            row = cursor.fetchone()
        next_id = (row[0] if row else 0) + 1
        return f"POD_{str(next_id).zfill(3)}"

    def __str__(self):
        return self.ProductName


# Fixed price tier names used in Product_Price_Details_tbl
PRICE_NAME_CHOICES = [
    ('A',      'Price A'),
    ('B',      'Price B'),
    ('C',      'Price C'),
    ('D',      'Price D'),
    ('Retail', 'Retail Price'),
]


class ProductPriceDetails(models.Model):
    ProductId = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='prices',
        db_column='ProductId'
    )
    PriceCodeID = models.ForeignKey(
        'PriceCodeList',
        on_delete=models.PROTECT,
        related_name='product_prices',
        db_column='PriceCodeID',
        null=True
    )
    PriceName = models.CharField(
        max_length=20,
        choices=PRICE_NAME_CHOICES,
        default='Retail'
    )
    ProductPrice = models.DecimalField(max_digits=10, decimal_places=2)
    CreatedOn = models.DateTimeField(auto_now_add=True)
    CreatedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='product_prices',
        db_column='CreatedBy'
    )

    class Meta:
        db_table = 'Product_Price_Details_tbl'
        ordering = ['ProductId', 'PriceName']
        indexes = [
            models.Index(fields=['ProductId'], name='idx_price_product'),
            models.Index(fields=['PriceCodeID'], name='idx_price_code'),
            models.Index(fields=['ProductId', 'PriceCodeID'], name='idx_price_product_code'),
        ]
        unique_together = [('ProductId', 'PriceCodeID')]

    def __str__(self):
        return f"{self.ProductId.ProductName} — {self.PriceName}: {self.ProductPrice}"

class PriceCodeList(models.Model):
    """Master table for price codes: A, B, C, D, Retail"""
    PriceCodeName = models.CharField(max_length=20, unique=True)
    DisplayLabel  = models.CharField(max_length=50)
    SortOrder     = models.IntegerField(default=0)
    IsActive      = models.BooleanField(default=True)
    CreatedOn     = models.DateTimeField(auto_now_add=True)
    CreatedBy     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='price_codes',
        db_column='CreatedBy'
    )

    class Meta:
        db_table = 'PriceCodeList_tbl'
        ordering = ['SortOrder', 'id']
        indexes = [
            models.Index(fields=['IsActive', 'SortOrder', 'id'], name='idx_pricecode_active_sort'),
            models.Index(fields=['PriceCodeName'], name='idx_pricecode_name'),
        ]

    def __str__(self):
        return self.DisplayLabel


class Unit(models.Model):
    """
    Unit_tbl — unit master for product units
    """
    UnitName  = models.CharField(max_length=200, unique=True)
    UQC       = models.CharField(max_length=50, null=True, blank=True)
    Decimal   = models.BooleanField(default=False)
    CreatedOn = models.DateTimeField(auto_now_add=True)
    CreatedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='units',
        db_column='CreatedBy',
    )

    class Meta:
        db_table = 'Unit_tbl'
        ordering = ['UnitName']

    def __str__(self):
        return self.UnitName


class ProductImportHistory(models.Model):
    FileDataHash = models.CharField(max_length=64)
    OriginalFileName = models.CharField(max_length=255)
    TotalRows = models.IntegerField(default=0)
    ImportedPage = models.CharField(max_length=50, blank=True, default='')
    ImportedBy = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='product_imports',
        db_column='ImportedBy',
    )
    ImportedOn = models.DateTimeField(auto_now_add=True)
    ImportStatus = models.CharField(max_length=20)

    class Meta:
        db_table = 'ProductImportHistory_tbl'
        ordering = ['-ImportedOn']
        indexes = [
            models.Index(fields=['FileDataHash'], name='idx_product_import_hash'),
            models.Index(fields=['ImportStatus'], name='idx_product_import_status'),
        ]

    def __str__(self):
        return f"{self.OriginalFileName} - {self.ImportStatus}"
