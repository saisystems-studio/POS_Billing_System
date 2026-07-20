from decimal import Decimal
from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Prefetch

from .models import Billing, BillingHeader, BillingConfig
from .serializers import (
    BillingCreateSerializer,
    BillingUpdateSerializer,
    BillingHeaderReadSerializer,
    BillingHeaderListSerializer,
    BillingCustomerDropdownSerializer,
    BillingConfigSerializer,
    display_bill_no,
)
from customers.models import Customer, CustomerPriceConfig
from products.models import PriceCodeList
from authentication.permissions import IsAdminOrReadCreate, IsAdminRole
from pos_backend.pagination import StableOrderingFilter


class BillingHeaderListView(generics.ListAPIView):
    """GET /api/billing/ — paginated bill list with search and date filters"""
    serializer_class   = BillingHeaderListSerializer
    permission_classes = [IsAdminOrReadCreate]
    filter_backends    = [filters.SearchFilter, StableOrderingFilter]
    search_fields      = ['BillNo', 'CustomerID__CustomerName', 'CustomerID__CustomerCode']
    ordering_fields    = ['id', 'CreatedOn', 'GrandTotal', 'BillNo']
    ordering           = ['-CreatedOn', 'id']

    def get_queryset(self):
        qs = (
            BillingHeader.objects
            .select_related('CustomerID', 'CreatedBy')
            .only(
                'id', 'BillNo', 'BillDate', 'CustomerID', 'CustomerID__CustomerName',
                'PriceCodeType', 'IsGSTBill', 'ItemCount', 'SubTotal', 'TotalDiscount',
                'GSTAmount', 'TotalCGST', 'TotalSGST', 'TotalIGST', 'GrandTotal',
                'EarnedPoints', 'CreatedBy', 'CreatedBy__username', 'CreatedOn',
            )
            .all()
        )
        # Date range filters
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        specific_date = self.request.query_params.get('date')
        if specific_date:
            qs = qs.filter(BillDate__date=specific_date)
        else:
            if date_from:
                qs = qs.filter(BillDate__date__gte=date_from)
            if date_to:
                qs = qs.filter(BillDate__date__lte=date_to)
        return qs


class BillingHeaderDetailView(generics.RetrieveDestroyAPIView):
    """GET/DELETE /api/billing/{pk}/"""
    serializer_class   = BillingHeaderReadSerializer
    permission_classes = [IsAdminOrReadCreate]

    def get_queryset(self):
        return BillingHeader.objects.select_related('CustomerID', 'CreatedBy', 'DefaultPriceCodeID').prefetch_related('line_items__ProductID', 'line_items__PriceCodeID').all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        bill_no  = display_bill_no(instance.BillNo)
        with transaction.atomic():
            customer = instance.CustomerID
            points   = Decimal(str(instance.EarnedPoints))
            customer.Customer_Redeem_Points = max(Decimal('0'), customer.Customer_Redeem_Points - points)
            customer.save(update_fields=['Customer_Redeem_Points'])
            instance.delete()
        return Response({'message': f'Bill {bill_no} deleted.'}, status=status.HTTP_200_OK)


class BillingCreateView(APIView):
    """POST /api/billing/create/ — create full bill with header + lines"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        ser = BillingCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        header = ser.save()
        out    = BillingHeaderReadSerializer(header)
        return Response(out.data, status=status.HTTP_201_CREATED)


class BillingUpdateView(APIView):
    """PUT /api/billing/{pk}/edit/ — Admin only: edit existing bill"""
    permission_classes = [IsAdminRole]

    def get_object(self, pk):
        try:
            return BillingHeader.objects.select_related('CustomerID', 'CreatedBy').prefetch_related('line_items').get(pk=pk)
        except BillingHeader.DoesNotExist:
            return None

    def put(self, request, pk, *args, **kwargs):
        instance = self.get_object(pk)
        if not instance:
            return Response({'detail': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)
        ser = BillingUpdateSerializer(instance, data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        updated = ser.save()
        out = BillingHeaderReadSerializer(
            BillingHeader.objects.select_related('CustomerID', 'CreatedBy', 'DefaultPriceCodeID')
            .prefetch_related('line_items__ProductID', 'line_items__PriceCodeID')
            .get(pk=updated.pk)
        )
        return Response(out.data, status=status.HTTP_200_OK)


class BillingCustomerDropdownView(generics.ListAPIView):
    """GET /api/billing/customers/ — all active customers with their price config"""
    serializer_class   = BillingCustomerDropdownSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None
    filter_backends    = [filters.SearchFilter]
    search_fields      = ['CustomerName', 'CustomerCode', 'PhoneNumber', 'WhatsappNumber', 'GSTNo']

    def get_queryset(self):
        active_configs_qs = CustomerPriceConfig.objects.filter(IsActive=True).select_related('FixedPriceCodeID')
        return (
            Customer.objects
            .filter(IsActive=True)
            .only(
                'id', 'CustomerCode', 'CustomerName', 'PhoneNumber',
                'Customer_Redeem_Points', 'IsGSTCustomer', 'GSTNo',
            )
            .prefetch_related(
                Prefetch(
                    'price_configs',
                    queryset=active_configs_qs,
                    to_attr='_active_price_config',
                )
            )
            .order_by('CustomerName')
        )

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        try:
            limit = min(max(int(self.request.query_params.get('limit', 50)), 1), 100)
        except (TypeError, ValueError):
            limit = 50
        return qs[:limit]


class BillingConfigView(APIView):
    """
    GET  /api/billing/config/ — get billing config (any authenticated user)
    PATCH /api/billing/config/ — update billing config (Admin only)
    """
    permission_classes = [IsAuthenticated]

    def _get_or_create(self):
        obj, _ = BillingConfig.objects.get_or_create(pk=1, defaults={
            'ShowDiscount': False, 'SkipEnabled': False, 'SkippedColumns': [],
        })
        return obj

    def get(self, request, *args, **kwargs):
        obj = self._get_or_create()
        return Response(BillingConfigSerializer(obj).data)

    def patch(self, request, *args, **kwargs):
        if not request.user.role == 'Admin':
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_or_create()
        obj.UpdatedBy = request.user
        ser = BillingConfigSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        obj.UpdatedBy = request.user
        obj.save(update_fields=['UpdatedBy'])
        return Response(BillingConfigSerializer(obj).data)
