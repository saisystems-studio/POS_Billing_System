from django.db import models

from authentication.models import User as Login
from products.models import Product


class BarcodeGenerator(models.Model):
    id = models.AutoField(primary_key=True, unique=True, db_column='Id')
    ProductId = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='barcode_generator_records',
        db_column='ProductId',
    )
    Product_Price_Code_Id = models.CharField(
        max_length=100,
        db_column='Product_Price_Code_Id',
    )
    SellingPrice = models.DecimalField(max_digits=18, decimal_places=2)
    MRP = models.DecimalField(max_digits=18, decimal_places=2)
    CreatedBy = models.ForeignKey(
        Login,
        on_delete=models.PROTECT,
        related_name='barcode_generator_records',
        db_column='CreatedBy',
    )
    CreatedOn = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'BarcodeGenerator_tbl'
        ordering = ['-CreatedOn']
        constraints = [
            models.CheckConstraint(
                check=models.Q(MRP__gte=models.F('SellingPrice')),
                name='ck_barcode_mrp_gte_selling',
            ),
        ]
        indexes = [
            models.Index(fields=['ProductId'], name='idx_barcode_product'),
        ]

    def __str__(self):
        return f"{self.ProductId.ProductName} - {self.SellingPrice}"
