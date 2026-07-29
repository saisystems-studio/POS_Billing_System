from django.db import transaction
from rest_framework import filters, generics
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import IsAdminOrReadCreate
from products.models import Product, ProductPriceDetails

from .models import BarcodeGenerator
from .serializers import (
    BarcodeGeneratorSerializer,
    BarcodePriceOptionSerializer,
    BarcodeProductOptionSerializer,
)


class BarcodeProductOptionsView(generics.ListAPIView):
    serializer_class = BarcodeProductOptionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            Product.objects
            .filter(IsActive=True)
            .values('id', 'ProductName')
            .order_by('ProductName', 'id')
        )


class BarcodeProductPriceCodesView(generics.ListAPIView):
    serializer_class = BarcodePriceOptionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filter_backends = [filters.SearchFilter]
    search_fields = ['PriceName', 'PriceCodeID__PriceCodeName', 'PriceCodeID__DisplayLabel']

    def get_queryset(self):
        return (
            ProductPriceDetails.objects
            .filter(ProductId_id=self.kwargs['product_id'], ProductId__IsActive=True, PriceCodeID__IsActive=True)
            .select_related('ProductId', 'PriceCodeID')
            .order_by('PriceCodeID__SortOrder', 'PriceCodeID__id')
        )


class BarcodeGeneratorListCreateView(generics.ListCreateAPIView):
    serializer_class = BarcodeGeneratorSerializer
    permission_classes = [IsAdminOrReadCreate]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ProductId__ProductName', 'ProductId__ProductCode']
    ordering_fields = ['CreatedOn', 'ProductId__ProductName', 'SellingPrice', 'MRP']
    ordering = ['-CreatedOn']

    def get_queryset(self):
        return BarcodeGenerator.objects.select_related(
            'ProductId',
            'CreatedBy',
        ).all()

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save()
