# Dashboard, Company Info, UserSettings and Notification views.

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction

from products.models import Product, ProductPriceDetails
from customers.models import Customer
from .models import CompanyInfo, CompanyConfig, CompanyConfigHistory, UserSettings, Notification
from .serializers import (
    CompanyInfoSerializer,
    CompanyConfigSerializer,
    CompanyConfigHistorySerializer,
    UserSettingsSerializer,
    NotificationSerializer,
)
from authentication.permissions import IsAdminRole, IsAdminOrReadCreate


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        company = CompanyConfig.objects.first()
        return Response({
            'total_products':      Product.objects.count(),
            'total_customers':     Customer.objects.count(),
            'total_price_records': ProductPriceDetails.objects.count(),
            'company_name':        company.CompanyName if company else None,
        })


# ─── Public endpoint (no auth) ───────────────────────────────────────────────

class CompanyConfigPublicView(APIView):
    """
    GET /api/company-info/public/
    Returns GST status and company name — no authentication required.
    Used by Login page and ProductForm for GST visibility.
    """
    permission_classes = []

    def get(self, request, *args, **kwargs):
        company = CompanyConfig.objects.first()
        return Response({
            'id':              company.id if company else None,
            'CompanyName':     company.CompanyName if company else '',
            'IsGSTRegistered': company.IsGSTRegistered if company else False,
            'GSTNumber':       company.GSTNumber if company else None,
            'CompanyLogo':     request.build_absolute_uri(company.CompanyLogo.url)
                               if company and company.CompanyLogo else None,
        })


# ─── Legacy public endpoint (backward compat for existing code) ──────────────

class CompanyInfoPublicView(APIView):
    """
    GET /api/company/public/
    Legacy endpoint — maps CompanyConfig fields to old names.
    """
    permission_classes = []

    def get(self, request, *args, **kwargs):
        company = CompanyConfig.objects.first()
        # Also check legacy table as fallback
        if not company:
            legacy = CompanyInfo.objects.first()
            return Response({
                'CompanyName':   legacy.CompanyName if legacy else '',
                'IsGSTEnabled':  legacy.IsGSTEnabled if legacy else False,
                'GSTNo':         legacy.GSTNo if legacy else None,
                'Logo':          request.build_absolute_uri(legacy.Logo.url)
                                 if legacy and legacy.Logo else None,
            })
        return Response({
            'CompanyName':   company.CompanyName,
            'IsGSTEnabled':  company.IsGSTRegistered,
            'GSTNo':         company.GSTNumber,
            'Logo':          request.build_absolute_uri(company.CompanyLogo.url)
                             if company.CompanyLogo else None,
        })


# ─── CompanyConfig CRUD (CompanyInfo_tbl) ────────────────────────────────────

class CompanyConfigNextCodeView(APIView):
    """GET /api/company-info/next-code/ — preview the next CompanyCode. Admin only."""
    permission_classes = [IsAdminRole]

    def get(self, request, *args, **kwargs):
        return Response({'next_code': CompanyConfig.next_code_preview()})


class CompanyConfigListCreateView(APIView):
    """
    GET  /api/company-info/  — authenticated users can read
    POST /api/company-info/  — Admin only; enforces single-record constraint
    """
    permission_classes = [IsAdminOrReadCreate]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, *args, **kwargs):
        company = CompanyConfig.objects.select_related('CreatedBy').first()
        if not company:
            return Response(None)
        return Response(CompanyConfigSerializer(company, context={'request': request}).data)

    def post(self, request, *args, **kwargs):
        if not request.user.role == 'Admin':
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        if CompanyConfig.objects.exists():
            return Response(
                {'detail': 'Company information already exists. Use PUT/PATCH to update.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            ser = CompanyConfigSerializer(data=request.data, context={'request': request})
            ser.is_valid(raise_exception=True)
            ser.save()
        return Response(ser.data, status=status.HTTP_201_CREATED)


class CompanyConfigDetailView(APIView):
    """
    GET    /api/company-info/{id}/
    PUT    /api/company-info/{id}/  — Admin only
    PATCH  /api/company-info/{id}/  — Admin only
    DELETE /api/company-info/{id}/  — Admin only
    """
    permission_classes = [IsAdminOrReadCreate]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def _get_object(self, pk):
        try:
            return CompanyConfig.objects.select_related('CreatedBy').get(pk=pk)
        except CompanyConfig.DoesNotExist:
            return None

    def get(self, request, pk, *args, **kwargs):
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CompanyConfigSerializer(obj, context={'request': request}).data)

    def put(self, request, pk, *args, **kwargs):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk, *args, **kwargs):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        if not request.user.role == 'Admin':
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            # ── Snapshot current state into history before overwriting ──
            CompanyConfigHistory.objects.create(
                CompanyName     = obj.CompanyName,
                PhoneNumber     = obj.PhoneNumber,
                Email           = obj.Email or None,
                Address         = obj.Address,
                IsGSTRegistered = obj.IsGSTRegistered,
                GSTNumber       = obj.GSTNumber,
                CompanyLogo     = obj.CompanyLogo.name if obj.CompanyLogo else None,
                ChangedBy       = request.user,
            )
            ser = CompanyConfigSerializer(obj, data=request.data, partial=partial, context={'request': request})
            ser.is_valid(raise_exception=True)
            ser.save()
        return Response(ser.data)

    def delete(self, request, pk, *args, **kwargs):
        if not request.user.role == 'Admin':
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if obj.CompanyLogo:
            obj.CompanyLogo.delete(save=False)
        obj.delete()
        return Response({'message': 'Company information deleted.'}, status=status.HTTP_200_OK)


# ─── Company Config History (admin only) ─────────────────────────────────────

class CompanyConfigHistoryView(APIView):
    """
    GET /api/company-info/history/
    Returns all history snapshots, most recent first. Admin only.
    """
    permission_classes = [IsAdminRole]

    def get(self, request, *args, **kwargs):
        qs = CompanyConfigHistory.objects.select_related('ChangedBy').all()
        ser = CompanyConfigHistorySerializer(qs, many=True, context={'request': request})
        return Response(ser.data)


# ─── Legacy CompanyInfo views (Company_Info table — kept for backward compat) ─

class CompanyInfoView(generics.ListCreateAPIView):
    queryset           = CompanyInfo.objects.select_related('CreatedBy').all()
    serializer_class   = CompanyInfoSerializer
    permission_classes = [IsAdminOrReadCreate]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        if CompanyInfo.objects.exists():
            return Response(
                {'detail': 'Company information already exists. Use the update endpoint.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)


class CompanyInfoDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = CompanyInfo.objects.select_related('CreatedBy').all()
    serializer_class   = CompanyInfoSerializer
    permission_classes = [IsAdminOrReadCreate]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.Logo:
            instance.Logo.delete(save=False)
        self.perform_destroy(instance)
        return Response({'message': 'Company information deleted.'}, status=status.HTTP_200_OK)


# ─── User Settings ────────────────────────────────────────────────────────────

class UserSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_or_create(self, user):
        obj, _ = UserSettings.objects.get_or_create(user=user)
        return obj

    def get(self, request, *args, **kwargs):
        obj = self._get_or_create(request.user)
        return Response(UserSettingsSerializer(obj).data)

    def patch(self, request, *args, **kwargs):
        obj = self._get_or_create(request.user)
        ser = UserSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    serializer_class   = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)[:100]


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, *args, **kwargs):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notif).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read.'})
