from django.contrib import admin

from .models import BarcodeGenerator


@admin.register(BarcodeGenerator)
class BarcodeGeneratorAdmin(admin.ModelAdmin):
    list_display = ('id', 'ProductId', 'Product_Price_Code_Id', 'SellingPrice', 'MRP', 'CreatedBy', 'CreatedOn')
    list_filter = ('CreatedOn',)
    search_fields = ('ProductId__ProductName', 'ProductId__ProductCode')
    readonly_fields = ('CreatedBy', 'CreatedOn')
