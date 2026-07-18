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
from .seed import DEFAULT_PRICE_CODES, seed_price_codes
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
        is_active = self.request.query_params.get('status', self.request.query_params.get('is_active'))
        if is_active is not None:
            qs = qs.filter(IsActive=is_active.lower() == 'true')
        group_id = self.request.query_params.get('group', self.request.query_params.get('group_id'))
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
        group_id = self.request.query_params.get('group', self.request.query_params.get('group_id'))
        active_prices = ProductPriceDetails.objects.select_related('PriceCodeID').filter(PriceCodeID__IsActive=True)
        qs = (
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
        if group_id:
            qs = qs.filter(GroupId=group_id)
        return qs

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
DEFAULT_IMPORT_GROUP_NAME = 'Primary'
INVALID_TEMPLATE_MESSAGE = 'Invalid Excel template. Please download and use the latest template.'
IMPORT_COL_GROUP = 0
IMPORT_COL_ENGLISH = 1
IMPORT_COL_TAMIL = 2
IMPORT_FIRST_PRICE_COL = 3
IMPORT_HEADER_ALIASES = {
    'Product Name': 'Particulars (English)',
}


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
    for _, row, reason in errors_by_row:
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


def _int_count(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _normalize_import_error_rows(value):
    if isinstance(value, list):
        return value
    if value in (None, ''):
        return []
    if isinstance(value, str):
        return [{'reason': value}]
    if isinstance(value, dict):
        if any(key in value for key in ('row', 'group', 'product', 'reason', 'error', 'detail', 'message')):
            return [value]
        rows = []
        for field, messages in value.items():
            if isinstance(messages, list):
                rows.extend({'field': field, 'reason': str(message)} for message in messages)
            elif messages not in (None, ''):
                rows.append({'field': field, 'reason': str(messages)})
        return rows
    return [{'reason': str(value)}]


def _import_response_payload(
    *,
    status_value,
    message,
    file_name='',
    total_rows=0,
    imported_count=0,
    duplicate_count=0,
    rejected_count=0,
    rejected_rows=None,
    summary=None,
    extra=None,
):
    canonical_rejected_rows = _normalize_import_error_rows(rejected_rows)
    canonical_errors = canonical_rejected_rows
    payload = {
        'status': status_value,
        'success': status_value == 'success',
        'message': message,
        'file_name': file_name or '',
        'total_rows': _int_count(total_rows),
        'imported_count': _int_count(imported_count),
        'duplicate_count': _int_count(duplicate_count),
        'rejected_count': _int_count(rejected_count),
        'rejected_rows': canonical_rejected_rows,
        'errors': canonical_errors,
    }
    if summary:
        payload['summary'] = summary
        payload.update(summary)
    if extra:
        if 'errors' in extra:
            canonical_errors = _normalize_import_error_rows(extra.get('errors'))
        payload.update(extra)
    payload['total_rows'] = _int_count(total_rows)
    payload['imported_count'] = _int_count(imported_count)
    payload['duplicate_count'] = _int_count(duplicate_count)
    payload['rejected_count'] = _int_count(rejected_count)
    payload['rejected_rows'] = canonical_rejected_rows
    payload['errors'] = canonical_errors
    payload.setdefault('database_duplicate_count', _int_count(payload.get('duplicate_existing_database')))
    payload.setdefault('file_duplicate_count', _int_count(payload.get('duplicate_inside_file')))
    return payload


def _import_summary(
    *,
    total_rows,
    imported_count,
    duplicate_count,
    rejected_count,
    groups_created=0,
    existing_group_count=0,
    products_created=0,
    products_restored=0,
    duplicate_existing_database=0,
    duplicate_inside_file=0,
    inactive_existing_products=0,
    prices_created=0,
    prices_updated=0,
    empty_price_values_skipped=0,
):
    price_values_imported = prices_created + prices_updated
    not_imported = duplicate_count + rejected_count
    return {
        'total_rows': total_rows,
        'imported_rows': imported_count,
        'imported_count': imported_count,
        'rejected_rows': rejected_count,
        'rejected_count': rejected_count,
        'invalid_rows_rejected': rejected_count,
        'duplicate_rows': duplicate_count,
        'duplicate_count': duplicate_count,
        'not_imported': not_imported,
        'groups_created': groups_created,
        'new_groups_created': groups_created,
        'existing_groups_reused': existing_group_count,
        'products_created': products_created,
        'products_updated': 0,
        'products_restored': products_restored,
        'reactivated_products': products_restored,
        'duplicate_existing_database': duplicate_existing_database,
        'database_duplicate_count': duplicate_existing_database,
        'existing_duplicates': duplicate_existing_database,
        'duplicate_inside_file': duplicate_inside_file,
        'file_duplicate_count': duplicate_inside_file,
        'duplicates_inside_file': duplicate_inside_file,
        'inactive_existing_products': inactive_existing_products,
        'existing_products_skipped': duplicate_count,
        'products_skipped_as_duplicates': duplicate_count,
        'prices_created': prices_created,
        'prices_updated': prices_updated,
        'prices_created_or_updated': price_values_imported,
        'price_values_imported': price_values_imported,
        'empty_price_values_skipped': empty_price_values_skipped,
        'price_fields_skipped': empty_price_values_skipped,
        'rows_skipped': duplicate_count,
        'rows_failed': rejected_count,
    }


def _validation_response(errors_by_row, file_name='', total_rows=None):
    error_xlsx = _build_error_xlsx(errors_by_row)
    rejected_rows = [
        {'row': excel_row, 'group': row[IMPORT_COL_GROUP], 'product': row[IMPORT_COL_ENGLISH], 'reason': reason}
        for excel_row, row, reason in errors_by_row
    ]
    rejected_count = len(errors_by_row)
    total = total_rows if total_rows is not None else rejected_count
    summary = _import_summary(
        total_rows=total,
        imported_count=0,
        duplicate_count=0,
        rejected_count=rejected_count,
        duplicate_existing_database=0,
        duplicate_inside_file=0,
        inactive_existing_products=0,
    )
    return Response(_import_response_payload(
        status_value='error',
        message='Excel Import Rejected',
        file_name=file_name,
        total_rows=total,
        imported_count=0,
        duplicate_count=0,
        rejected_count=rejected_count,
        rejected_rows=rejected_rows,
        summary=summary,
        extra={
            'detail': 'Import validation failed.',
            'errors': [
                {**row, 'error': row['reason']}
                for row in rejected_rows
            ],
            'error_file_name': 'Product_Import_Errors.xlsx',
            'error_file_base64': base64.b64encode(error_xlsx).decode('ascii'),
        },
    ), status=status.HTTP_400_BAD_REQUEST)


def _load_common_import_rows(upload):
    sheets = _read_xlsx(upload)
    rows = sheets.get('Products')
    if not rows:
        raise ValueError(INVALID_TEMPLATE_MESSAGE)
    header = [
        IMPORT_HEADER_ALIASES.get((cell or '').replace('\ufeff', '').strip(), (cell or '').replace('\ufeff', '').strip())
        for cell in rows[0]
    ]
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
    skipped_duplicate_rows = []
    empty_price_values_skipped = 0

    for excel_row, row in data_rows:
        padded = [_clean_text(cell) for cell in row]
        row_errors = []
        group_was_defaulted = not padded[IMPORT_COL_GROUP]
        group_name = padded[IMPORT_COL_GROUP] or DEFAULT_IMPORT_GROUP_NAME
        padded[IMPORT_COL_GROUP] = DEFAULT_IMPORT_GROUP_NAME if group_was_defaulted else group_name
        group_name = padded[IMPORT_COL_GROUP]
        english_name = padded[IMPORT_COL_ENGLISH]
        tamil_name = padded[IMPORT_COL_TAMIL]
        group_key = _normalize_text(group_name)
        product_key = _normalize_text(english_name)

        if not english_name:
            row_errors.append('Particulars (English) is required.')

        duplicate_key = (group_key, product_key)
        is_duplicate_in_file = False
        if group_key and product_key:
            if duplicate_key in seen_product_keys:
                skipped_duplicate_rows.append({
                    'row': excel_row,
                    'group': group_name,
                    'product': english_name,
                    'reason': 'Duplicate product inside current Excel file',
                    'duplicate_type': 'inside_file',
                })
                continue
            else:
                is_duplicate_in_file = False

        prices = {}
        for col_idx, (header, code) in enumerate(COMMON_PRICE_COLUMNS, IMPORT_FIRST_PRICE_COL):
            try:
                prices[code] = _parse_import_price(padded[col_idx])
            except ValueError as exc:
                reason = str(exc)
                row_errors.append(f'Invalid value in {header}.')
                prices[code] = None
            else:
                if padded[col_idx] == '':
                    empty_price_values_skipped += 1

        if row_errors:
            errors_by_row.append((excel_row, padded, ' '.join(row_errors)))
            continue
        if group_key and product_key and not is_duplicate_in_file:
            seen_product_keys.add(duplicate_key)

        prepared.append({
            'excel_row': excel_row,
            'group_name': group_name,
            'group_was_defaulted': group_was_defaulted,
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
    return {
        'prepared': prepared,
        'errors_by_row': errors_by_row,
        'data_hash': data_hash,
        'skipped_duplicate_rows': skipped_duplicate_rows,
        'empty_price_values_skipped': empty_price_values_skipped,
        'total_rows': len(data_rows),
    }


def _run_common_product_import(upload, user, imported_page):
    prepared_data = _prepare_common_import(upload)
    prepared = prepared_data['prepared']
    errors_by_row = prepared_data['errors_by_row']
    data_hash = prepared_data['data_hash']
    skipped_duplicate_rows = prepared_data['skipped_duplicate_rows']
    empty_price_values_skipped = prepared_data['empty_price_values_skipped']
    total_rows = prepared_data['total_rows']
    if total_rows == 0:
        return _validation_response(
            [(1, [''] * len(COMMON_IMPORT_HEADERS), 'Excel file is empty.')],
            file_name=upload.name,
            total_rows=0,
        )
    if errors_by_row and not prepared and not skipped_duplicate_rows:
        return _validation_response(errors_by_row, file_name=upload.name, total_rows=total_rows)

    required_price_codes = {row['PriceCodeName'] for row in DEFAULT_PRICE_CODES}
    price_codes = {pc.PriceCodeName.casefold(): pc for pc in PriceCodeList.objects.filter(IsActive=True)}
    missing_codes = [code for code in sorted(required_price_codes) if code.casefold() not in price_codes]
    if missing_codes:
        seed_price_codes(user=user)
        price_codes = {pc.PriceCodeName.casefold(): pc for pc in PriceCodeList.objects.filter(IsActive=True)}
        missing_codes = [code for code in sorted(required_price_codes) if code.casefold() not in price_codes]
    if missing_codes:
        error_row = [''] * len(COMMON_IMPORT_HEADERS)
        return _validation_response(
            [(1, error_row, f'Missing price-code master records: {", ".join(missing_codes)}.')],
            file_name=upload.name,
            total_rows=total_rows,
        )

    groups_created = 0
    existing_group_keys_reused = set()
    products_created = 0
    products_restored = 0
    products_skipped_as_duplicates = 0
    inactive_existing_products = 0
    prices_created = 0
    prices_updated = 0
    skipped_rows = list(skipped_duplicate_rows)

    with transaction.atomic():
        list(ProductImportHistory.objects.select_for_update().filter(FileDataHash=data_hash))

        default_unit = _find_default_import_unit(user)
        group_keys_needed = {item['group_key'] for item in prepared}
        groups = {
            _normalize_text(g.GroupName): g
            for g in ProductGroup.objects.select_for_update().all()
        }
        missing_group_items = []
        missing_group_keys = set()
        for item in prepared:
            if item['group_key'] not in groups and item['group_key'] not in missing_group_keys:
                missing_group_keys.add(item['group_key'])
                missing_group_items.append(item)
        if missing_group_items:
            ProductGroup.objects.bulk_create([
                ProductGroup(
                    GroupName=item['group_name'],
                    HSNCode='0000',
                    GSTPercent=0,
                    IsActive=True,
                    CreatedBy=user,
                )
                for item in missing_group_items
            ])
            groups_created = len(missing_group_items)
            groups = {
                _normalize_text(g.GroupName): g
                for g in ProductGroup.objects.select_for_update().all()
            }
        existing_group_keys_reused = group_keys_needed - missing_group_keys

        products = {}
        for product in Product.objects.select_related('GroupId').select_for_update().filter(
            GroupId_id__in=[group.id for group in groups.values()]
        ):
            if product.GroupId:
                products[(_normalize_text(product.GroupId.GroupName), _normalize_text(product.ProductName))] = product

        products_to_create = []
        restored_products = []
        products_to_update = []
        product_items_to_price = []
        temp_code_prefix = f"IMP_{data_hash[:12]}_"

        for item in prepared:
            group = groups.get(item['group_key'])
            if not group:
                error_row = [''] * len(COMMON_IMPORT_HEADERS)
                return _validation_response(
                    [(item['excel_row'], error_row, f'Missing product group: {item["group_name"]}.')],
                    file_name=upload.name,
                    total_rows=total_rows,
                )

            product_lookup = (item['group_key'], item['product_key'])
            product = products.get(product_lookup)
            if product:
                if product.IsActive:
                    products_skipped_as_duplicates += 1
                    skipped_rows.append({
                        'row': item['excel_row'],
                        'group': item['group_name'],
                        'product': item['english_name'],
                        'reason': 'Duplicate product',
                        'duplicate_type': 'existing_database',
                    })
                    continue

                if not product.IsActive:
                    product.IsActive = True
                    products_restored += 1
                    inactive_existing_products += 1
                if product.GroupId_id != group.id:
                    product.GroupId = group
                if product.ProductName != item['english_name']:
                    product.ProductName = item['english_name']
                if (product.ProductNameTamil or None) != item['tamil_name']:
                    product.ProductNameTamil = item['tamil_name']
                if not product.Units:
                    product.Units = default_unit.UnitName
                if not product.UnitId_id:
                    product.UnitId = default_unit
                restored_products.append(product)
                products_to_update.append(product)
                product_items_to_price.append((product, item))
            else:
                temp_code = f"{temp_code_prefix}{item['excel_row']}"
                product = Product(
                    GroupId=group,
                    ProductCode=temp_code,
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
                products_to_create.append(product)
                products[product_lookup] = product
                product_items_to_price.append((product, item))

        if products_to_create:
            Product.objects.bulk_create(products_to_create, batch_size=500)
            temp_codes = [p.ProductCode for p in products_to_create]
            created_products_by_code = {
                p.ProductCode: p
                for p in Product.objects.select_for_update().filter(ProductCode__in=temp_codes)
            }
            products_created = len(created_products_by_code)
            products_to_finalize = []
            for product in products_to_create:
                created = created_products_by_code.get(product.ProductCode)
                if not created:
                    continue
                created.ProductCode = f"POD_{str(created.id).zfill(3)}"
                products_to_finalize.append(created)
            if created_products_by_code:
                product_items_to_price = [
                    (created_products_by_code.get(product.ProductCode, product), item)
                    for product, item in product_items_to_price
                ]
            if products_to_finalize:
                Product.objects.bulk_update(products_to_finalize, ['ProductCode'], batch_size=500)

        if products_to_update:
            Product.objects.bulk_update(
                products_to_update,
                ['IsActive', 'GroupId', 'ProductName', 'ProductNameTamil', 'Units', 'UnitId'],
                batch_size=500,
            )

        product_ids = [product.id for product, _ in product_items_to_price if product.id]
        price_code_ids = [pc.id for pc in price_codes.values()]
        existing_prices = {
            (price.ProductId_id, price.PriceCodeID_id): price
            for price in ProductPriceDetails.objects.select_for_update().filter(
                ProductId_id__in=product_ids,
                PriceCodeID_id__in=price_code_ids,
            )
        }
        prices_to_create = []
        prices_to_update = []
        for product, item in product_items_to_price:
            if not product.id:
                continue
            for _, code in COMMON_PRICE_COLUMNS:
                if item['prices'][code] is None:
                    continue
                pc = price_codes[code.casefold()]
                key = (product.id, pc.id)
                price_obj = existing_prices.get(key)
                if price_obj:
                    if price_obj.ProductPrice != item['prices'][code] or price_obj.PriceName != pc.PriceCodeName:
                        price_obj.ProductPrice = item['prices'][code]
                        price_obj.PriceName = pc.PriceCodeName
                        prices_to_update.append(price_obj)
                    prices_updated += 1
                else:
                    prices_to_create.append(ProductPriceDetails(
                        ProductId=product,
                        PriceCodeID=pc,
                        ProductPrice=item['prices'][code],
                        PriceName=pc.PriceCodeName,
                        CreatedBy=user,
                    ))
                    prices_created += 1
        if prices_to_create:
            ProductPriceDetails.objects.bulk_create(prices_to_create, batch_size=1000)
        if prices_to_update:
            ProductPriceDetails.objects.bulk_update(prices_to_update, ['ProductPrice', 'PriceName'], batch_size=1000)

        ProductImportHistory.objects.create(
            FileDataHash=data_hash,
            OriginalFileName=upload.name,
            TotalRows=total_rows,
            ImportedPage=(imported_page or '').strip()[:50],
            ImportedBy=user,
            ImportStatus='SUCCESS',
        )

    invalid_rows = [
        {'row': excel_row, 'group': row[IMPORT_COL_GROUP], 'product': row[IMPORT_COL_ENGLISH], 'reason': reason}
        for excel_row, row, reason in errors_by_row
    ]
    repeated_product_row_numbers = [row['row'] for row in skipped_duplicate_rows]
    database_duplicate_row_numbers = [
        row['row'] for row in skipped_rows
        if row.get('duplicate_type') == 'existing_database'
    ]
    rejected_row_numbers = [row['row'] for row in invalid_rows]
    duplicate_inside_file = len(skipped_duplicate_rows)
    duplicate_rows = products_skipped_as_duplicates + duplicate_inside_file
    imported_count = products_created + products_restored
    rejected_count = len(errors_by_row)
    summary = _import_summary(
        total_rows=total_rows,
        imported_count=imported_count,
        duplicate_count=duplicate_rows,
        rejected_count=rejected_count,
        groups_created=groups_created,
        existing_group_count=len(existing_group_keys_reused),
        products_created=products_created,
        products_restored=products_restored,
        duplicate_existing_database=products_skipped_as_duplicates,
        duplicate_inside_file=duplicate_inside_file,
        inactive_existing_products=inactive_existing_products,
        prices_created=prices_created,
        prices_updated=prices_updated,
        empty_price_values_skipped=empty_price_values_skipped,
    )
    if imported_count and rejected_count:
        message = 'Excel import completed with warnings.'
    elif imported_count:
        message = 'Excel import completed.'
    elif duplicate_rows:
        message = 'No New Products Imported'
    else:
        message = 'Excel import rejected. No rows were imported.'
    response_status_value = 'error' if imported_count == 0 and duplicate_rows == 0 and rejected_count > 0 else 'success'
    http_status = status.HTTP_400_BAD_REQUEST if response_status_value == 'error' else status.HTTP_200_OK
    error_file_base64 = ''
    if errors_by_row:
        error_file_base64 = base64.b64encode(_build_error_xlsx(errors_by_row)).decode('ascii')
    return Response(_import_response_payload(
        status_value=response_status_value,
        message=message,
        file_name=upload.name,
        total_rows=total_rows,
        imported_count=imported_count,
        duplicate_count=duplicate_rows,
        rejected_count=rejected_count,
        rejected_rows=invalid_rows,
        summary=summary,
        extra={
            'imported': products_created,
            'updated': 0,
            'restored': products_restored,
            'skipped_duplicates': duplicate_rows,
            'skipped_rows': skipped_rows[:50],
            'skipped_rows_total': len(skipped_rows),
            'repeated_product_row_numbers': repeated_product_row_numbers,
            'database_duplicate_row_numbers': database_duplicate_row_numbers,
            'rejected_row_numbers': rejected_row_numbers,
            'error_file_name': 'Product_Import_Errors.xlsx' if error_file_base64 else '',
            'error_file_base64': error_file_base64,
        },
    ), status=http_status)


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
            return Response(_import_response_payload(
                status_value='error',
                message='Excel Import Rejected',
                rejected_count=1,
                rejected_rows=[],
                extra={
                    'detail': 'Excel file is required.',
                    'errors': [{'reason': 'Excel file is required.'}],
                },
            ), status=status.HTTP_400_BAD_REQUEST)
        if not upload.name.lower().endswith('.xlsx'):
            return Response(_import_response_payload(
                status_value='error',
                message='Excel Import Rejected',
                file_name=upload.name,
                rejected_count=1,
                rejected_rows=[],
                extra={
                    'detail': 'Workbook must be an .xlsx file.',
                    'errors': [{'reason': 'Workbook must be an .xlsx file.'}],
                },
            ), status=status.HTTP_400_BAD_REQUEST)
        try:
            return _run_common_product_import(upload, request.user, request.data.get('imported_page', ''))
        except ValueError as exc:
            return Response(_import_response_payload(
                status_value='error',
                message='Excel Import Rejected',
                file_name=upload.name,
                rejected_count=1,
                rejected_rows=[],
                extra={
                    'detail': str(exc),
                    'errors': [{'reason': str(exc)}],
                },
            ), status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            detail = f'Invalid workbook: {exc}'
            return Response(_import_response_payload(
                status_value='error',
                message='Excel Import Rejected',
                file_name=upload.name,
                rejected_count=1,
                rejected_rows=[],
                extra={
                    'detail': detail,
                    'errors': [{'reason': detail}],
                },
            ), status=status.HTTP_400_BAD_REQUEST)


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
