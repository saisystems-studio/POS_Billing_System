# Product views

from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from pos_backend.pagination import StandardResultsPagination
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Prefetch, Q
from decimal import Decimal, InvalidOperation
from io import BytesIO
import base64
import hashlib
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from .models import ProductGroup, Product, ProductPriceDetails, PriceCodeList, PRICE_NAME_CHOICES, Unit, ProductImportHistory
from .serializers import (
    ProductGroupSerializer, ProductGroupDropdownSerializer, ProductSerializer,
    ProductListSerializer, ProductPriceDetailsSerializer, ProductWithPricesCreateSerializer,
    PriceCodeListSerializer, ProductForBillingSerializer, ProductPricePageSerializer, PriceRowSaveSerializer,
    UnitSerializer,
)
from authentication.permissions import IsAdminOrReadCreate, IsAdminRole
from rest_framework.permissions import IsAuthenticated

PRICE_NAMES = [c[0] for c in PRICE_NAME_CHOICES]


class PriceCodePagePagination(StandardResultsPagination):
    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'page': self.page.number,
            'current_page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'total_pages': self.page.paginator.num_pages,
            'has_next': self.page.has_next(),
            'has_previous': self.page.has_previous(),
            'results': data,
        })


# â”€â”€â”€ ProductGroup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ProductGroupListCreateView(generics.ListCreateAPIView):
    serializer_class   = ProductGroupSerializer
    permission_classes = [IsAdminOrReadCreate]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['GroupName']
    ordering_fields    = ['GroupName', 'CreatedOn']
    ordering           = ['GroupName']

    def get_queryset(self):
        qs = ProductGroup.objects.select_related('CreatedBy').all()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(IsActive=is_active.lower() == 'true')
        return qs


class ProductGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ProductGroupSerializer
    permission_classes = [IsAdminOrReadCreate]

    def get_queryset(self):
        return ProductGroup.objects.select_related('CreatedBy').all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.GroupName
        self.perform_destroy(instance)
        return Response({'message': f'Product group "{name}" deleted.'}, status=status.HTTP_200_OK)


class ProductGroupDropdownView(generics.ListAPIView):
    """Active product groups for dropdowns â€” no pagination."""
    serializer_class   = ProductGroupDropdownSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        return ProductGroup.objects.filter(IsActive=True).only('id', 'GroupName', 'IsActive').order_by('GroupName')


# â”€â”€â”€ Product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ProductNextCodeView(APIView):
    """GET /api/products/next-code/ â€” preview next ProductCode. Any authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response({'next_code': Product.next_code_preview()})


class ProductListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrReadCreate]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['ProductName', 'ProductNameTamil', 'Units', 'Description', 'ProductCode']
    ordering_fields    = ['id', 'ProductName', 'CreatedOn', 'Quantity', 'GroupId__GroupName']
    ordering           = ['-CreatedOn']

    def get_queryset(self):
        price_rows = (
            ProductPriceDetails.objects
            .select_related('PriceCodeID')
            .only(
                'id', 'ProductId', 'PriceCodeID', 'PriceCodeID__PriceCodeName',
                'PriceCodeID__DisplayLabel', 'PriceName', 'ProductPrice',
            )
        )
        qs = (
            Product.objects
            .select_related('CreatedBy', 'GroupId', 'UnitId')
            .only(
                'id', 'GroupId', 'GroupId__GroupName', 'ProductCode',
                'ProductName', 'ProductNameTamil', 'HSNCode', 'GSTPercent',
                'Quantity', 'Units', 'UnitId', 'UnitId__UQC', 'UnitId__UnitName',
                'Description', 'IsActive', 'CreatedOn', 'UpdatedAt', 'CreatedBy',
                'CreatedBy__username',
            )
            .prefetch_related(Prefetch('prices', queryset=price_rows))
            .all()
        )
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(IsActive=is_active.lower() == 'true')
        group_id = self.request.query_params.get('group_id')
        if group_id:
            qs = qs.filter(GroupId=group_id)
        return qs

    def paginate_queryset(self, queryset):
        if str(self.request.query_params.get('all', '')).lower() == 'true':
            return None
        return super().paginate_queryset(queryset)

    def get_serializer_class(self):
        return ProductListSerializer if self.request.method == 'GET' else ProductSerializer


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ProductSerializer
    permission_classes = [IsAdminOrReadCreate]

    def get_queryset(self):
        return Product.objects.select_related('CreatedBy', 'GroupId', 'UnitId').prefetch_related('prices').all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.ProductName
        # Check if used in any billing row
        if instance.billings.exists():
            instance.IsActive = False
            instance.save(update_fields=['IsActive'])
            return Response(
                {'message': f'Product "{name}" deactivated (used in billing).'},
                status=status.HTTP_200_OK,
            )
        self.perform_destroy(instance)
        return Response({'message': f'Product "{name}" deleted.'}, status=status.HTTP_200_OK)


class ProductWithPricesCreateView(APIView):
    """Create/update product basic info only (no prices â€” use PriceCodeListSaveView)."""
    permission_classes = [IsAdminOrReadCreate]

    def post(self, request, *args, **kwargs):
        serializer = ProductWithPricesCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        user = request.user
        unit = data.get('UnitId')
        with transaction.atomic():
            product = Product.objects.create(
                GroupId=data.get('GroupId'),
                ProductName=data['ProductName'],
                ProductNameTamil=data.get('ProductNameTamil') or None,
                HSNCode=data.get('HSNCode') or None,
                GSTPercent=data.get('GSTPercent', 0),
                Quantity=data.get('Quantity'),
                Units=unit.UnitName if unit else data['Units'],
                UnitId=unit,
                Description=data.get('Description') or None,
                IsActive=data.get('IsActive', True),
                CreatedBy=user,
            )
        out = Product.objects.select_related('CreatedBy', 'GroupId', 'UnitId').prefetch_related('prices').get(pk=product.pk)
        return Response(ProductSerializer(out, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def put(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if not pk:
            return Response({'detail': 'Product ID required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductWithPricesCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        unit = data.get('UnitId')
        with transaction.atomic():
            product.GroupId         = data.get('GroupId')
            product.ProductName     = data['ProductName']
            product.ProductNameTamil= data.get('ProductNameTamil') or None
            product.HSNCode         = data.get('HSNCode') or None
            product.GSTPercent      = data.get('GSTPercent', 0)
            product.Quantity        = data.get('Quantity')
            product.Units           = unit.UnitName if unit else data['Units']
            product.UnitId          = unit
            product.Description     = data.get('Description') or None
            product.IsActive        = data.get('IsActive', True)
            product.save()
        out = Product.objects.select_related('CreatedBy', 'GroupId', 'UnitId').prefetch_related('prices').get(pk=product.pk)
        return Response(ProductSerializer(out, context={'request': request}).data, status=status.HTTP_200_OK)


# â”€â”€â”€ Product Price â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ProductPriceListCreateView(generics.ListCreateAPIView):
    serializer_class   = ProductPriceDetailsSerializer
    permission_classes = [IsAdminOrReadCreate]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['ProductId__ProductName', 'PriceName']
    ordering_fields    = ['ProductId', 'PriceName', 'ProductPrice', 'CreatedOn']
    ordering           = ['ProductId', 'PriceName']

    def get_queryset(self):
        qs = ProductPriceDetails.objects.select_related('ProductId', 'CreatedBy', 'PriceCodeID').all()
        product_id = self.request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(ProductId=product_id)
        return qs


class ProductPriceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ProductPriceDetailsSerializer
    permission_classes = [IsAdminOrReadCreate]

    def get_queryset(self):
        return ProductPriceDetails.objects.select_related('ProductId', 'CreatedBy').all()

    def destroy(self, request, *args, **kwargs):
        self.get_object()
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'message': 'Price record deleted.'}, status=status.HTTP_200_OK)


# â”€â”€â”€ Admin-only: save all 5 rates for one product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class PriceCodeListSaveView(APIView):
    """POST /api/product-price-save/ â€” Admin only. Save/update all rates for one product."""
    permission_classes = [IsAdminRole]

    def post(self, request, *args, **kwargs):
        ser = PriceRowSaveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        product   = ser.validated_data['ProductId']
        prices_in = ser.validated_data['prices']
        user      = request.user
        active_price_codes = {
            pc.id: pc
            for pc in PriceCodeList.objects.filter(
                pk__in=[int(pc_id) for pc_id in prices_in.keys()],
                IsActive=True,
            )
        }
        with transaction.atomic():
            for pc_id_str, price_val in prices_in.items():
                pc_id = int(pc_id_str)
                pc = active_price_codes.get(pc_id)
                if not pc:
                    return Response({'detail': f'PriceCodeID {pc_id} not found.'}, status=status.HTTP_400_BAD_REQUEST)
                obj, created = ProductPriceDetails.objects.get_or_create(
                    ProductId=product,
                    PriceCodeID=pc,
                    defaults={
                        'ProductPrice': price_val,
                        'PriceName': pc.PriceCodeName,
                        'CreatedBy': user,
                    },
                )
                if not created:
                    obj.ProductPrice = price_val
                    obj.save(update_fields=['ProductPrice'])
        return Response({'message': 'Rates saved.'}, status=status.HTTP_200_OK)


# â”€â”€â”€ PriceCodeList master â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class PriceCodeListView(generics.ListAPIView):
    """GET /api/price-codes/ â€” active price codes for dropdowns (all authenticated users)."""
    serializer_class   = PriceCodeListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def get_queryset(self):
        return PriceCodeList.objects.filter(IsActive=True).only(
            'id', 'PriceCodeName', 'DisplayLabel', 'SortOrder', 'IsActive',
        ).order_by('SortOrder', 'id')


# â”€â”€â”€ Products for billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ProductsForBillingView(generics.ListAPIView):
    serializer_class   = ProductPricePageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None

    def _limit(self):
        try:
            return min(max(int(self.request.query_params.get('limit', 50)), 1), 100)
        except (TypeError, ValueError):
            return 50

    def _cursor(self):
        try:
            cursor = int(self.request.query_params.get('cursor') or 0)
            return max(cursor, 0)
        except (TypeError, ValueError):
            return 0

    def get_queryset(self):
        search = (self.request.query_params.get('search') or '').strip()
        cursor = self._cursor()
        qs = (
            Product.objects
            .filter(IsActive=True)
            .only(
                'id', 'ProductCode', 'ProductName',
            )
        )
        if cursor:
            qs = qs.filter(id__gt=cursor)
        if search:
            qs = qs.filter(
                Q(ProductCode__istartswith=search) |
                Q(ProductCode__icontains=search) |
                Q(ProductName__icontains=search) |
                Q(ProductNameTamil__icontains=search) |
                Q(Units__icontains=search) |
                Q(UnitId__UnitName__icontains=search) |
                Q(UnitId__UQC__icontains=search) |
                Q(GroupId__GroupName__icontains=search)
            )
        active_prices = ProductPriceDetails.objects.select_related('PriceCodeID').filter(PriceCodeID__IsActive=True)
        return qs.prefetch_related(Prefetch('prices', queryset=active_prices)).order_by('id')

    def list(self, request, *args, **kwargs):
        limit = self._limit()
        rows = list(self.get_queryset()[:limit + 1])
        page = rows[:limit]
        serializer = self.get_serializer(page, many=True)
        return Response({
            'results': serializer.data,
            'next_cursor': page[-1].id if len(rows) > limit and page else None,
            'has_more': len(rows) > limit,
        })


# â”€â”€â”€ All products for Price Code List page (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class AllProductsForPricePageView(generics.ListAPIView):
    """GET /api/products/for-price-page/ â€” all active products with their existing rates."""
    serializer_class   = ProductForBillingSerializer
    permission_classes = [IsAdminRole]
    pagination_class   = PriceCodePagePagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['ProductName', 'ProductCode']
    ordering_fields    = ['id', 'ProductName', 'ProductCode']
    ordering           = ['id']

    def get_queryset(self):
        active_prices = ProductPriceDetails.objects.select_related('PriceCodeID').filter(PriceCodeID__IsActive=True)
        return (
            Product.objects
            .filter(IsActive=True)
            .select_related('GroupId', 'UnitId')
            .only(
                'id', 'ProductCode', 'ProductName', 'ProductNameTamil',
                'GroupId__GroupName', 'Units', 'UnitId__UQC', 'UnitId__UnitName',
                'GSTPercent', 'HSNCode',
            )
            .prefetch_related(Prefetch('prices', queryset=active_prices))
            .order_by('id')
        )

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                limit = min(max(int(limit), 1), 100)
                return qs[:limit]
            except (TypeError, ValueError):
                return qs
        return qs


# â”€â”€â”€ Product Excel import/template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

COMMON_IMPORT_HEADERS = [
    'S.No',
    'Product Group',
    'Particulars (English)',
    'Particulars (Tamil)',
    'Price A',
    'Price B',
    'Price C',
    'Price D',
    'Retail',
]
COMMON_PRICE_COLUMNS = [
    ('Price A', 'A'),
    ('Price B', 'B'),
    ('Price C', 'C'),
    ('Price D', 'D'),
    ('Retail', 'Retail'),
]
DEFAULT_IMPORT_UNIT_CODE = 'PCS'
DEFAULT_IMPORT_UNIT_NAME = 'Pieces'
INVALID_TEMPLATE_MESSAGE = 'Invalid Excel template. Please download and use the latest template.'


def _col_name(index):
    name = ''
    while index:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name


def _sheet_xml(rows):
    lines = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
             '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
    for r_idx, row in enumerate(rows, 1):
        lines.append(f'<row r="{r_idx}">')
        for c_idx, value in enumerate(row, 1):
            ref = f'{_col_name(c_idx)}{r_idx}'
            text = str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            lines.append(f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>')
        lines.append('</row>')
    lines.append('</sheetData></worksheet>')
    return ''.join(lines)


def _build_template_xlsx():
    out = BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>''')
        z.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''')
        z.writestr('xl/workbook.xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>''')
        z.writestr('xl/_rels/workbook.xml.rels', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>''')
        z.writestr('xl/worksheets/sheet1.xml', _sheet_xml([COMMON_IMPORT_HEADERS]))
    out.seek(0)
    return out.getvalue()


def _read_xlsx(file_obj):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    with zipfile.ZipFile(file_obj) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('m:si', ns):
                shared.append(''.join(t.text or '' for t in si.findall('.//m:t', ns)))
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
        sheets = {}
        for sheet in wb.findall('m:sheets/m:sheet', ns):
            name = sheet.attrib['name']
            rel_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = rel_map[rel_id].lstrip('/')
            path = target if target.startswith('xl/') else f'xl/{target}'
            root = ET.fromstring(z.read(path))
            data = []
            for row in root.findall('m:sheetData/m:row', ns):
                values = {}
                max_col = 0
                for cell in row.findall('m:c', ns):
                    ref = cell.attrib.get('r', '')
                    letters = ''.join(ch for ch in ref if ch.isalpha())
                    col = 0
                    for ch in letters:
                        col = col * 26 + ord(ch.upper()) - 64
                    max_col = max(max_col, col)
                    val = ''
                    if cell.attrib.get('t') == 'inlineStr':
                        val = ''.join(t.text or '' for t in cell.findall('.//m:t', ns))
                    else:
                        v = cell.find('m:v', ns)
                        if v is not None and v.text is not None:
                            val = shared[int(v.text)] if cell.attrib.get('t') == 's' else v.text
                    values[col] = str(val).strip()
                if max_col:
                    data.append([values.get(i, '') for i in range(1, max_col + 1)])
            sheets[name] = data
        return sheets


def _normalize_text(value):
    return re.sub(r'\s+', ' ', str(value or '').strip()).casefold()


def _clean_text(value):
    return re.sub(r'\s+', ' ', str(value or '').strip())


def _parse_import_price(value):
    raw = str(value or '').strip()
    if raw == '':
        return None
    try:
        price = Decimal(raw.replace(',', ''))
    except Exception as exc:
        raise ValueError('invalid') from exc
    if price < 0:
        raise ValueError('negative')
    return price.quantize(Decimal('0.01'))


def _find_default_import_unit(user):
    unit = Unit.objects.filter(UQC__iexact=DEFAULT_IMPORT_UNIT_CODE).first()
    if not unit:
        unit = Unit.objects.filter(UnitName__iexact=DEFAULT_IMPORT_UNIT_NAME).first()
    if not unit:
        unit = Unit.objects.create(
            UQC=DEFAULT_IMPORT_UNIT_CODE,
            UnitName=DEFAULT_IMPORT_UNIT_NAME,
            Decimal=False,
            CreatedBy=user,
        )
    return unit


def _build_error_xlsx(errors_by_row):
    rows = [COMMON_IMPORT_HEADERS + ['Error Reason']]
    for row, reason in errors_by_row:
        rows.append(row + [reason])
    out = BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>''')
        z.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''')
        z.writestr('xl/workbook.xml', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Errors" sheetId="1" r:id="rId1"/></sheets></workbook>''')
        z.writestr('xl/_rels/workbook.xml.rels', '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>''')
        z.writestr('xl/worksheets/sheet1.xml', _sheet_xml(rows))
    return out.getvalue()


def _validation_response(errors_by_row):
    error_xlsx = _build_error_xlsx(errors_by_row)
    return Response({
        'success': False,
        'message': 'Excel Import Rejected',
        'detail': 'Import validation failed.',
        'errors': [{'row': row[0] or idx + 2, 'error': reason} for idx, (row, reason) in enumerate(errors_by_row)],
        'rejected_rows': [{'row': row[0] or idx + 2, 'reason': reason} for idx, (row, reason) in enumerate(errors_by_row)],
        'error_file_name': 'Product_Import_Errors.xlsx',
        'error_file_base64': base64.b64encode(error_xlsx).decode('ascii'),
        'summary': {
            'total_rows': len(errors_by_row),
            'imported_rows': 0,
            'rejected_rows': len(errors_by_row),
            'duplicate_rows': len(errors_by_row),
            'groups_created': 0,
            'new_groups_created': 0,
            'existing_groups_reused': 0,
            'products_created': 0,
            'products_updated': 0,
            'products_restored': 0,
            'existing_products_skipped': 0,
            'products_skipped_as_duplicates': 0,
            'prices_created': 0,
            'prices_updated': 0,
            'prices_created_or_updated': 0,
            'rows_skipped': 0,
            'rows_failed': len(errors_by_row),
        },
    }, status=status.HTTP_400_BAD_REQUEST)


def _load_common_import_rows(upload):
    sheets = _read_xlsx(upload)
    rows = sheets.get('Products')
    if not rows:
        raise ValueError(INVALID_TEMPLATE_MESSAGE)
    header = [(cell or '').replace('\ufeff', '').strip() for cell in rows[0]]
    if header != COMMON_IMPORT_HEADERS:
        raise ValueError(INVALID_TEMPLATE_MESSAGE)
    data_rows = []
    for excel_row, row in enumerate(rows[1:], 2):
        padded = (row + [''] * len(COMMON_IMPORT_HEADERS))[:len(COMMON_IMPORT_HEADERS)]
        if not any(str(cell or '').strip() for cell in padded):
            continue
        data_rows.append((excel_row, padded))
    if len(data_rows) > 5000:
        raise ValueError('Import supports up to 5,000 rows.')
    return data_rows


def _prepare_common_import(upload):
    data_rows = _load_common_import_rows(upload)
    errors_by_row = []
    prepared = []
    seen_product_keys = set()

    for excel_row, row in data_rows:
        padded = [_clean_text(cell) for cell in row]
        row_errors = []
        group_name = padded[1]
        english_name = padded[2]
        tamil_name = padded[3]
        group_key = _normalize_text(group_name)
        product_key = _normalize_text(english_name)

        if not group_name:
            row_errors.append('Missing Product Group.')
        if not english_name:
            row_errors.append('Missing Particulars (English).')
        duplicate_key = (group_key, product_key)
        if group_key and product_key:
            if duplicate_key in seen_product_keys:
                row_errors.append('Duplicate Product Group and Product Name inside this Excel file.')
            else:
                seen_product_keys.add(duplicate_key)

        prices = {}
        for col_idx, (header, code) in enumerate(COMMON_PRICE_COLUMNS, 4):
            try:
                prices[code] = _parse_import_price(padded[col_idx])
            except ValueError as exc:
                reason = str(exc)
                if reason == 'negative':
                    row_errors.append(f'{header} cannot be negative.')
                else:
                    row_errors.append(f'{header} must be numeric.')

        if row_errors:
            errors_by_row.append((padded, ' '.join(row_errors)))
            continue

        prepared.append({
            'excel_row': excel_row,
            'group_name': group_name,
            'group_key': group_key,
            'english_name': english_name,
            'product_key': product_key,
            'tamil_name': tamil_name or None,
            'prices': prices,
        })

    hash_rows = []
    for item in prepared:
        hash_rows.append({
            'group': item['group_key'],
            'product': item['product_key'],
            'tamil': _normalize_text(item['tamil_name']),
            'prices': {code: (str(item['prices'][code]) if item['prices'][code] is not None else '') for _, code in COMMON_PRICE_COLUMNS},
        })
    payload = json.dumps(sorted(hash_rows, key=lambda r: (r['group'], r['product'])), separators=(',', ':'), sort_keys=True)
    data_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    return prepared, errors_by_row, data_hash


def _run_common_product_import(upload, user, imported_page):
    prepared, errors_by_row, data_hash = _prepare_common_import(upload)
    if errors_by_row:
        return _validation_response(errors_by_row)

    price_codes = {pc.PriceCodeName.casefold(): pc for pc in PriceCodeList.objects.filter(IsActive=True)}
    missing_codes = [code for _, code in COMMON_PRICE_COLUMNS if code.casefold() not in price_codes]
    if missing_codes:
        error_row = [''] * len(COMMON_IMPORT_HEADERS)
        error_row[0] = '-'
        return _validation_response([(error_row, f'Missing price-code master records: {", ".join(missing_codes)}.')])

    groups_created = 0
    new_group_keys = set()
    existing_group_keys_reused = set()
    products_created = 0
    products_restored = 0
    products_skipped_as_duplicates = 0
    prices_created = 0
    prices_updated = 0
    skipped_rows = []

    with transaction.atomic():
        list(ProductImportHistory.objects.select_for_update().filter(FileDataHash=data_hash))

        default_unit = _find_default_import_unit(user)
        groups = {_normalize_text(g.GroupName): g for g in ProductGroup.objects.select_for_update().all()}
        products = {}
        for product in Product.objects.select_related('GroupId').select_for_update().all():
            if product.GroupId:
                products[(_normalize_text(product.GroupId.GroupName), _normalize_text(product.ProductName))] = product

        for item in prepared:
            group = groups.get(item['group_key'])
            if not group:
                group = ProductGroup.objects.create(
                    GroupName=item['group_name'],
                    HSNCode='0000',
                    GSTPercent=0,
                    IsActive=True,
                    CreatedBy=user,
                )
                groups[item['group_key']] = group
                new_group_keys.add(item['group_key'])
                groups_created += 1
            elif item['group_key'] not in new_group_keys:
                existing_group_keys_reused.add(item['group_key'])

            product_lookup = (item['group_key'], item['product_key'])
            product = products.get(product_lookup)
            if product:
                if product.IsActive:
                    products_skipped_as_duplicates += 1
                    skipped_rows.append({
                        'row': item['excel_row'],
                        'group': item['group_name'],
                        'product': item['english_name'],
                        'reason': 'Product already exists under this Product Group. Duplicate row skipped.',
                    })
                    continue

                update_fields = []
                if not product.IsActive:
                    product.IsActive = True
                    update_fields.append('IsActive')
                    products_restored += 1
                if product.GroupId_id != group.id:
                    product.GroupId = group
                    update_fields.append('GroupId')
                if product.ProductName != item['english_name']:
                    product.ProductName = item['english_name']
                    update_fields.append('ProductName')
                if (product.ProductNameTamil or None) != item['tamil_name']:
                    product.ProductNameTamil = item['tamil_name']
                    update_fields.append('ProductNameTamil')
                if not product.Units:
                    product.Units = default_unit.UnitName
                    update_fields.append('Units')
                if not product.UnitId_id:
                    product.UnitId = default_unit
                    update_fields.append('UnitId')
                if update_fields:
                    product.save(update_fields=update_fields)
            else:
                product = Product.objects.create(
                    GroupId=group,
                    ProductName=item['english_name'],
                    ProductNameTamil=item['tamil_name'],
                    HSNCode=None,
                    GSTPercent=0,
                    Quantity=None,
                    Units=default_unit.UnitName,
                    UnitId=default_unit,
                    Description=None,
                    IsActive=True,
                    CreatedBy=user,
                )
                products[product_lookup] = product
                products_created += 1

            for _, code in COMMON_PRICE_COLUMNS:
                if item['prices'][code] is None:
                    continue
                pc = price_codes[code.casefold()]
                price_obj, created = ProductPriceDetails.objects.select_for_update().update_or_create(
                    ProductId=product,
                    PriceCodeID=pc,
                    defaults={
                        'ProductPrice': item['prices'][code],
                        'PriceName': pc.PriceCodeName,
                        'CreatedBy': user,
                    },
                )
                if created:
                    prices_created += 1
                else:
                    prices_updated += 1

        ProductImportHistory.objects.create(
            FileDataHash=data_hash,
            OriginalFileName=upload.name,
            TotalRows=len(prepared),
            ImportedPage=(imported_page or '').strip()[:50],
            ImportedBy=user,
            ImportStatus='SUCCESS',
        )

    summary = {
        'total_rows': len(prepared),
        'imported_rows': products_created + products_restored,
        'rejected_rows': 0,
        'duplicate_rows': products_skipped_as_duplicates,
        'groups_created': groups_created,
        'new_groups_created': groups_created,
        'existing_groups_reused': len(existing_group_keys_reused),
        'products_created': products_created,
        'products_updated': 0,
        'products_restored': products_restored,
        'existing_products_skipped': products_skipped_as_duplicates,
        'products_skipped_as_duplicates': products_skipped_as_duplicates,
        'prices_created': prices_created,
        'prices_updated': prices_updated,
        'prices_created_or_updated': prices_created + prices_updated,
        'rows_skipped': products_skipped_as_duplicates,
        'rows_failed': 0,
    }
    if products_created or products_restored or prices_created or prices_updated:
        message = 'Import completed. Missing products were added or restored; existing products were skipped.'
    else:
        message = 'All products in this Excel already exist. No duplicate data was stored.'
    return Response({
        'success': True,
        'message': message,
        'imported': products_created,
        'updated': 0,
        'restored': products_restored,
        'skipped_duplicates': products_skipped_as_duplicates,
        'skipped_rows': skipped_rows,
        'summary': summary,
        **summary,
    }, status=status.HTTP_200_OK)


class ProductImportTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = _build_template_xlsx()
        response = HttpResponse(data, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="Product_Import_Template.xlsx"'
        return response


class ProductImportView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'success': False, 'message': 'Excel Import Rejected', 'detail': 'Excel file is required.', 'errors': [], 'rejected_rows': []}, status=status.HTTP_400_BAD_REQUEST)
        if not upload.name.lower().endswith('.xlsx'):
            return Response({'success': False, 'message': 'Excel Import Rejected', 'detail': 'Workbook must be an .xlsx file.', 'errors': [], 'rejected_rows': []}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return _run_common_product_import(upload, request.user, request.data.get('imported_page', ''))
        except ValueError as exc:
            return Response({'success': False, 'message': 'Excel Import Rejected', 'detail': str(exc), 'errors': [], 'rejected_rows': []}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'detail': f'Invalid workbook: {exc}'}, status=status.HTTP_400_BAD_REQUEST)


# â”€â”€â”€ Unit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class UnitListCreateView(generics.ListCreateAPIView):
    """GET /api/units/ â€” list + POST create unit"""
    serializer_class   = UnitSerializer
    permission_classes = [IsAdminOrReadCreate]
    pagination_class   = None
    filter_backends    = [filters.SearchFilter]
    search_fields      = ['UnitName', 'UQC']

    def get_queryset(self):
        return Unit.objects.select_related('CreatedBy').order_by('UnitName')


class UnitDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = UnitSerializer
    permission_classes = [IsAdminOrReadCreate]

    def get_queryset(self):
        return Unit.objects.select_related('CreatedBy').all()
