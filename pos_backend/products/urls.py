from django.urls import path
from .views import (
    ProductGroupListCreateView, ProductGroupDetailView, ProductGroupDropdownView,
    ProductListCreateView, ProductDetailView, ProductWithPricesCreateView,
    ProductNextCodeView,
    ProductPriceListCreateView, ProductPriceDetailView,
    PriceCodeListView, ProductsForBillingView,
    PriceCodeListSaveView, AllProductsForPricePageView,
    ProductImportView, ProductImportTemplateView,
    UnitListCreateView, UnitDetailView,
)

urlpatterns = [
    # ProductGroup
    path('product-groups/',              ProductGroupListCreateView.as_view(), name='group_list'),
    path('product-groups/dropdown/',     ProductGroupDropdownView.as_view(),   name='group_dropdown'),
    path('product-groups/<int:pk>/',     ProductGroupDetailView.as_view(),     name='group_detail'),

    # Price codes master
    path('price-codes/',                 PriceCodeListView.as_view(),          name='price_codes'),

    # Admin: save all rates for one product
    path('product-price-save/',          PriceCodeListSaveView.as_view(),      name='price_save'),

    # Products
    path('products/next-code/',          ProductNextCodeView.as_view(),        name='product_next_code'),
    path('products/for-billing/',        ProductsForBillingView.as_view(),     name='products_for_billing'),
    path('products/for-price-page/',     AllProductsForPricePageView.as_view(),name='products_for_price_page'),
    path('products/import/',             ProductImportView.as_view(),           name='product_import'),
    path('products/import-template/',    ProductImportTemplateView.as_view(),   name='product_import_template'),
    path('products/create-with-prices/',          ProductWithPricesCreateView.as_view(), name='product_create'),
    path('products/create-with-prices/<int:pk>/', ProductWithPricesCreateView.as_view(), name='product_update'),
    path('products/',                    ProductListCreateView.as_view(),       name='product_list'),
    path('products/<int:pk>/',           ProductDetailView.as_view(),           name='product_detail'),

    # Product price records
    path('product-price/',               ProductPriceListCreateView.as_view(), name='price_list'),
    path('product-price/<int:pk>/',      ProductPriceDetailView.as_view(),     name='price_detail'),

    # Units
    path('units/',           UnitListCreateView.as_view(), name='unit_list'),
    path('units/<int:pk>/',  UnitDetailView.as_view(),     name='unit_detail'),
]
