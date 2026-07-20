from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Prefetch
from .models import Customer, CustomerPriceConfig
from .serializers import CustomerSerializer, NextCustomerCodeSerializer, CustomerPriceConfigSerializer
from authentication.permissions import IsAdminOrReadCreate
from pos_backend.pagination import StableOrderingFilter


class CustomerNextCodeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response({'next_code': Customer.next_code_preview()})


class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class   = CustomerSerializer
    permission_classes = [IsAdminOrReadCreate]
    filter_backends    = [filters.SearchFilter, StableOrderingFilter]
    search_fields      = ['CustomerName', 'CustomerCode', 'PhoneNumber', 'EmailId']
    ordering_fields    = ['id', 'CustomerName', 'CustomerCode', 'CreatedOn']
    ordering           = ['-CreatedOn', 'id']

    def get_queryset(self):
        active_configs = CustomerPriceConfig.objects.filter(IsActive=True).select_related('FixedPriceCodeID')
        return (
            Customer.objects
            .select_related('CreatedBy')
            .only(
                'id', 'CustomerCode', 'CustomerName', 'Address', 'PhoneNumber',
                'WhatsappNumber', 'IsWhatsappSameAsPhone', 'EmailId', 'IsGSTCustomer',
                'GSTNo', 'PriceCode', 'PriceCodeType', 'Customer_Redeem_Points',
                'IsActive', 'CreatedOn', 'UpdatedAt', 'CreatedBy', 'CreatedBy__username',
            )
            .prefetch_related(Prefetch('price_configs', queryset=active_configs, to_attr='_active_price_config'))
            .all()
        )


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = CustomerSerializer
    permission_classes = [IsAdminOrReadCreate]

    def get_queryset(self):
        active_configs = CustomerPriceConfig.objects.filter(IsActive=True).select_related('FixedPriceCodeID')
        return (
            Customer.objects
            .select_related('CreatedBy')
            .prefetch_related(Prefetch('price_configs', queryset=active_configs, to_attr='_active_price_config'))
            .all()
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.CustomerName
        self.perform_destroy(instance)
        return Response({'message': f'Customer "{name}" deleted successfully.'}, status=status.HTTP_200_OK)


class CustomerPriceConfigView(APIView):
    """GET /api/customers/{pk}/price-config/ — fetch active price config for a customer"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        try:
            customer = Customer.objects.get(pk=pk)
        except Customer.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)
        cfg = CustomerPriceConfig.objects.filter(CustomerID=customer, IsActive=True).select_related('FixedPriceCodeID').first()
        if not cfg:
            return Response({'detail': 'No active price config found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CustomerPriceConfigSerializer(cfg).data)
