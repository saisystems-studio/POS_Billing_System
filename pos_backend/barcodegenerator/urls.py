from django.urls import path

from .views import (
    BarcodeGeneratorListCreateView,
    BarcodeProductOptionsView,
    BarcodeProductPriceCodesView,
)

urlpatterns = [
    path('barcode-generator/', BarcodeGeneratorListCreateView.as_view(), name='barcode_generator'),
    path('barcode-generator/products/', BarcodeProductOptionsView.as_view(), name='barcode_products'),
    path(
        'barcode-generator/products/<int:product_id>/price-codes/',
        BarcodeProductPriceCodesView.as_view(),
        name='barcode_product_price_codes',
    ),
]
