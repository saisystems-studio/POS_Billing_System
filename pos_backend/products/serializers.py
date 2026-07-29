# Product serializers

from decimal import Decimal
from rest_framework import serializers
from .models import ProductGroup, Product, ProductPriceDetails, PriceCodeList, PRICE_NAME_CHOICES, Unit

PRICE_NAMES = [c[0] for c in PRICE_NAME_CHOICES]


class RequiredGSTIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if data is None or data == '':
            self.fail('required')
        return super().to_internal_value(data)


def _normalized_product_name(value):
    return ' '.join((value or '').split()).casefold()


def _has_product_duplicate(name, group, exclude_id=None):
    queryset = Product.objects.filter(GroupId=group).only('id', 'ProductName')
    if exclude_id:
        queryset = queryset.exclude(pk=exclude_id)
    normalized = _normalized_product_name(name)
    return any(_normalized_product_name(item.ProductName) == normalized for item in queryset)


# ─── ProductGroup ────────────────────────────────────────────────────────────

class ProductGroupSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)
    HSNCode = serializers.CharField(max_length=20, required=True, allow_blank=False)
    GSTPercent = serializers.IntegerField(required=True, min_value=0, max_value=100)

    class Meta:
        model = ProductGroup
        fields = ['id', 'GroupName', 'HSNCode', 'GSTPercent', 'IsActive', 'CreatedOn', 'CreatedBy', 'CreatedByUsername']
        read_only_fields = ['id', 'CreatedOn', 'CreatedBy', 'CreatedByUsername']

    def validate_GroupName(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("GroupName cannot be empty.")
        val = value.strip()
        qs = ProductGroup.objects.filter(GroupName__iexact=val)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This product group already exists.")
        return val

    def validate_HSNCode(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("HSN Code is required.")
        return val

    def create(self, validated_data):
        validated_data['CreatedBy'] = self.context['request'].user
        return super().create(validated_data)


class ProductGroupDropdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductGroup
        fields = ['id', 'GroupName', 'HSNCode', 'GSTPercent', 'IsActive']


# ─── PriceCodeList ───────────────────────────────────────────────────────────

class PriceCodeListSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PriceCodeList
        fields = ['id', 'PriceCodeName', 'DisplayLabel', 'SortOrder', 'IsActive']


# ─── ProductPriceDetails ─────────────────────────────────────────────────────

class ProductPriceDetailsSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)
    ProductId_name    = serializers.CharField(source='ProductId.ProductName', read_only=True)

    class Meta:
        model = ProductPriceDetails
        fields = ['id', 'ProductId', 'ProductId_name', 'PriceCodeID', 'PriceName',
                  'ProductPrice', 'CreatedOn', 'CreatedBy', 'CreatedByUsername']
        read_only_fields = ['id', 'CreatedOn', 'CreatedBy', 'CreatedByUsername', 'ProductId_name']

    def create(self, validated_data):
        validated_data['CreatedBy'] = self.context['request'].user
        return super().create(validated_data)


# ─── Admin bulk price-save: one product × 5 codes ───────────────────────────

class PriceRowSaveSerializer(serializers.Serializer):
    """Save all 5 rates for one product in one atomic transaction."""
    ProductId = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(IsActive=True))
    prices    = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0')),
        required=True,
    )

    def validate_prices(self, value):
        codes = list(PriceCodeList.objects.filter(IsActive=True).values_list('id', flat=True))
        for k in value:
            try:
                int(k)
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Key '{k}' must be a price code ID (integer).")
            if int(k) not in codes:
                raise serializers.ValidationError(f"PriceCodeID {k} is not active.")
        return value


# ─── Product serializers ─────────────────────────────────────────────────────

class ProductSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)
    GroupName         = serializers.CharField(source='GroupId.GroupName', read_only=True, default=None)
    UnitCode          = serializers.CharField(source='UnitId.UQC', read_only=True, default=None)
    UnitName          = serializers.CharField(source='UnitId.UnitName', read_only=True, default=None)
    prices            = ProductPriceDetailsSerializer(many=True, read_only=True)
    ProductCode       = serializers.CharField(read_only=True)
    GSTPercent        = RequiredGSTIntegerField(
        required=True, min_value=0, max_value=100,
        error_messages={
            'required': 'GST Percentage is required.',
            'null': 'GST Percentage is required.',
            'invalid': 'Please enter a valid GST percentage.',
            'min_value': 'GST Percentage cannot be negative.',
            'max_value': 'Please enter a valid GST percentage.',
        },
    )

    class Meta:
        model = Product
        fields = [
            'id', 'GroupId', 'GroupName', 'ProductCode',
            'ProductName', 'ProductNameTamil', 'HSNCode', 'GSTPercent',
            'Quantity', 'Units', 'UnitId', 'UnitCode', 'UnitName', 'Description', 'IsActive',
            'CreatedOn', 'UpdatedAt', 'CreatedBy', 'CreatedByUsername', 'prices',
        ]
        read_only_fields = ['id', 'ProductCode', 'CreatedOn', 'UpdatedAt', 'CreatedBy',
                            'CreatedByUsername', 'GroupName', 'UnitCode', 'UnitName']
        extra_kwargs = {
            'HSNCode': {'required': True, 'allow_blank': False, 'allow_null': False},
            'GSTPercent': {'required': True},
        }

    def validate_ProductName(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Product name is required.")
        return ' '.join(value.split())

    def validate_HSNCode(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("HSN is required. Please enter a valid HSN code.")
        if set(val) == {'0'}:
            raise serializers.ValidationError("HSN cannot be 0000. Please enter a proper HSN code.")
        return val

    def validate_Units(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Units cannot be empty.")
        return value.strip()

    def validate_Quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value

    def validate_GSTPercent(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("GST Percent must be between 0 and 100.")
        return value

    def validate(self, attrs):
        hsn = attrs.get('HSNCode', getattr(self.instance, 'HSNCode', None))
        gst = attrs.get('GSTPercent', getattr(self.instance, 'GSTPercent', None))
        field_errors = {}
        normalized_hsn = '' if hsn is None else str(hsn).strip()
        if not normalized_hsn:
            field_errors['HSNCode'] = 'HSN is required. Please enter a valid HSN code.'
        elif set(normalized_hsn) == {'0'}:
            field_errors['HSNCode'] = 'HSN cannot be 0000. Please enter a proper HSN code.'
        if gst is None or gst == '':
            field_errors['GSTPercent'] = 'GST Percentage is required.'
        if field_errors:
            raise serializers.ValidationError(field_errors)
        name = attrs.get('ProductName', getattr(self.instance, 'ProductName', ''))
        group = attrs.get('GroupId', getattr(self.instance, 'GroupId', None))
        if _has_product_duplicate(name, group, self.instance.pk if self.instance else None):
            raise serializers.ValidationError({
                'ProductName': 'Another product with this name already exists in the selected group.'
            })
        return attrs

    def create(self, validated_data):
        validated_data['CreatedBy'] = self.context['request'].user
        return super().create(validated_data)


class ProductListSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)
    GroupName         = serializers.CharField(source='GroupId.GroupName', read_only=True, default=None)
    ProductCode       = serializers.CharField(read_only=True)
    UnitCode          = serializers.CharField(source='UnitId.UQC', read_only=True, default=None)
    UnitName          = serializers.CharField(source='UnitId.UnitName', read_only=True, default=None)
    RetailPrice       = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'GroupId', 'GroupName', 'ProductCode',
            'ProductName', 'ProductNameTamil', 'HSNCode', 'GSTPercent',
            'Quantity', 'Units', 'UnitId', 'UnitCode', 'UnitName', 'RetailPrice', 'Description', 'IsActive',
            'CreatedOn', 'UpdatedAt', 'CreatedBy', 'CreatedByUsername',
        ]
        read_only_fields = ['id', 'ProductCode', 'CreatedOn', 'UpdatedAt', 'CreatedBy',
                            'CreatedByUsername', 'GroupName', 'UnitCode', 'UnitName', 'RetailPrice']

    def get_RetailPrice(self, obj):
        for price in getattr(obj, 'prices', []).all():
            code = getattr(price.PriceCodeID, 'PriceCodeName', None)
            if code == 'Retail':
                return price.ProductPrice
        return None


class ProductWithPricesCreateSerializer(serializers.Serializer):
    GroupId          = serializers.PrimaryKeyRelatedField(queryset=ProductGroup.objects.all(),
                           required=False, allow_null=True)
    ProductName      = serializers.CharField(max_length=200)
    ProductNameTamil = serializers.CharField(max_length=200, required=False, allow_null=True, allow_blank=True)
    HSNCode          = serializers.CharField(max_length=20, required=True, allow_null=False, allow_blank=False)
    GSTPercent       = RequiredGSTIntegerField(
        required=True, min_value=0, max_value=100,
        error_messages={
            'required': 'GST Percentage is required.',
            'null': 'GST Percentage is required.',
            'invalid': 'Please enter a valid GST percentage.',
            'min_value': 'GST Percentage cannot be negative.',
            'max_value': 'Please enter a valid GST percentage.',
        },
    )
    Quantity         = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    Units            = serializers.CharField(max_length=100)
    UnitId           = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all(), required=False, allow_null=True)
    Description      = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    IsActive         = serializers.BooleanField(default=True)

    def validate_ProductName(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Product name is required.")
        return ' '.join(value.split())

    def validate_Units(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Units cannot be empty.")
        return value.strip()

    def validate_HSNCode(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("HSN is required. Please enter a valid HSN code.")
        if set(val) == {'0'}:
            raise serializers.ValidationError("HSN cannot be 0000. Please enter a proper HSN code.")
        return val

    def validate(self, attrs):
        if attrs.get('HSNCode') is None or str(attrs.get('HSNCode')).strip() == '':
            raise serializers.ValidationError({'HSNCode': 'HSN Code is required.'})
        if attrs.get('GSTPercent') is None or attrs.get('GSTPercent') == '':
            raise serializers.ValidationError({'GSTPercent': 'GST Percentage is required.'})
        product_id = self.context.get('product_id')
        if _has_product_duplicate(attrs['ProductName'], attrs.get('GroupId'), product_id):
            raise serializers.ValidationError({
                'ProductName': 'Another product with this name already exists in the selected group.'
            })
        return attrs


# ─── Product for billing (all price tiers + GST) ─────────────────────────────

class PriceTierSerializer(serializers.Serializer):
    PriceCodeID   = serializers.IntegerField(source='PriceCodeID.id')
    PriceCodeName = serializers.CharField(source='PriceCodeID.PriceCodeName')
    DisplayLabel  = serializers.CharField(source='PriceCodeID.DisplayLabel')
    ProductPrice  = serializers.DecimalField(max_digits=10, decimal_places=2)


class ProductForBillingSerializer(serializers.ModelSerializer):
    prices = PriceTierSerializer(many=True, read_only=True)
    ProductNameTamil = serializers.CharField(read_only=True)
    GroupName = serializers.CharField(source='GroupId.GroupName', read_only=True, default=None)
    UnitCode = serializers.CharField(source='UnitId.UQC', read_only=True, default=None)
    UnitName = serializers.CharField(source='UnitId.UnitName', read_only=True, default=None)

    class Meta:
        model  = Product
        fields = ['id', 'ProductCode', 'ProductName', 'ProductNameTamil', 'GroupName', 'Units', 'UnitCode', 'UnitName', 'GSTPercent', 'HSNCode', 'prices']


class ProductPricePageSerializer(serializers.ModelSerializer):
    prices = PriceTierSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'ProductCode', 'ProductName', 'prices']


# ─── Unit ─────────────────────────────────────────────────────────────────────

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Unit
        fields = ['id', 'UnitName', 'UQC', 'Decimal', 'CreatedOn']
        read_only_fields = ['id', 'CreatedOn']

    def validate_UnitName(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Unit name is required.")
        qs = Unit.objects.filter(UnitName__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This unit already exists.")
        return v

    def validate_UQC(self, value):
        v = (value or '').strip().upper()
        if not v:
            return None
        qs = Unit.objects.filter(UQC__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This UQC code already exists.")
        return v

    def create(self, validated_data):
        validated_data['CreatedBy'] = self.context['request'].user
        return super().create(validated_data)
