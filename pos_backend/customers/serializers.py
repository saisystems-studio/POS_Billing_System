import re
from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from .models import Customer, CustomerPriceConfig
from products.models import PriceCodeList

PHONE_RE = re.compile(r'^[6-9]\d{9}$')
GST_RE   = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')


def clean_phone(value: str) -> str:
    return re.sub(r'\D', '', value or '')


class CustomerPriceConfigSerializer(serializers.ModelSerializer):
    PriceCodeLabel = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = CustomerPriceConfig
        fields = ['id', 'PriceCodeType', 'FixedPriceCodeID', 'PriceCodeLabel', 'IsActive', 'CreatedOn']
        read_only_fields = ['id', 'IsActive', 'CreatedOn', 'PriceCodeLabel']

    def get_PriceCodeLabel(self, obj):
        if obj.FixedPriceCodeID:
            return obj.FixedPriceCodeID.DisplayLabel
        return None


class CustomerSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)
    next_code         = serializers.SerializerMethodField(read_only=True)
    PriceConfig       = serializers.SerializerMethodField(read_only=True)

    # Write-only price config fields
    PriceCodeType      = serializers.ChoiceField(choices=[('Fixed', 'Fixed'), ('Random', 'Random')], write_only=False, required=False, default='Fixed')
    FixedPriceCodeID   = serializers.PrimaryKeyRelatedField(
        queryset=PriceCodeList.objects.all(), required=False, allow_null=True, write_only=True
    )

    class Meta:
        model  = Customer
        fields = [
            'id', 'CustomerCode', 'next_code',
            'CustomerName', 'Address', 'PhoneNumber',
            'WhatsappNumber', 'IsWhatsappSameAsPhone',
            'EmailId', 'IsGSTCustomer', 'GSTNo',
            'PriceCode', 'PriceCodeType', 'FixedPriceCodeID',
            'PriceConfig',
            'Customer_Redeem_Points', 'IsActive',
            'CreatedOn', 'UpdatedAt', 'CreatedBy', 'CreatedByUsername',
        ]
        read_only_fields = [
            'id', 'CustomerCode', 'next_code', 'PriceConfig',
            'Customer_Redeem_Points', 'CreatedOn', 'UpdatedAt',
            'CreatedBy', 'CreatedByUsername',
        ]

    def get_next_code(self, obj):
        return None

    def get_PriceConfig(self, obj):
        cached = getattr(obj, '_active_price_config', None)
        cfg = cached[0] if cached is not None and cached else None
        if cached is None:
            cfg = (
                obj.price_configs
                .filter(IsActive=True)
                .select_related('FixedPriceCodeID')
                .first()
            )
        if cfg:
            return CustomerPriceConfigSerializer(cfg).data
        return None

    def validate_CustomerName(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("CustomerName cannot be empty.")
        return value.strip()

    def validate_PhoneNumber(self, value):
        if not value or not str(value).strip():
            return None  # nullable
        digits = clean_phone(value)
        if not PHONE_RE.match(digits):
            raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number (starts with 6–9).")
        qs = Customer.objects.filter(PhoneNumber=digits)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A customer with this phone number already exists.")
        return digits

    def validate_WhatsappNumber(self, value):
        if not value or not str(value).strip():
            return None
        digits = clean_phone(value)
        if digits and not PHONE_RE.match(digits):
            raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number (starts with 6–9).")
        return digits if digits else None

    def validate_GSTNo(self, value):
        if not value or not value.strip():
            return None
        gst = value.strip().upper()
        if len(gst) != 15:
            raise serializers.ValidationError("GST Number must be exactly 15 characters.")
        if not gst[:2].isdigit():
            raise serializers.ValidationError("GST Number must start with a valid 2-digit state code.")
        return gst

    def validate(self, attrs):
        is_gst = attrs.get('IsGSTCustomer', getattr(self.instance, 'IsGSTCustomer', False))
        gst_no = attrs.get('GSTNo', getattr(self.instance, 'GSTNo', None))
        if is_gst and not gst_no:
            raise serializers.ValidationError({'GSTNo': 'GST Number is required for GST customers.'})
        if not is_gst:
            attrs['GSTNo'] = None

        price_type = attrs.get('PriceCodeType', 'Random')
        fixed_code = attrs.get('FixedPriceCodeID', None)
        if price_type == 'Fixed' and not fixed_code:
            raise serializers.ValidationError({'FixedPriceCodeID': 'Default Price Code is required for Fixed price type.'})
        if price_type == 'Random':
            attrs['FixedPriceCodeID'] = None
        # Address fields are optional — no mandatory check
        return attrs

    def create(self, validated_data):
        price_code_type = validated_data.pop('PriceCodeType', 'Fixed')
        fixed_price_code = validated_data.pop('FixedPriceCodeID', None)
        validated_data.setdefault('PriceCode', 'Retail')
        validated_data['PriceCodeType'] = price_code_type
        validated_data['CreatedBy'] = self.context['request'].user
        with transaction.atomic():
            customer = super().create(validated_data)
            CustomerPriceConfig.objects.create(
                CustomerID=customer,
                PriceCodeType=price_code_type,
                FixedPriceCodeID=fixed_price_code,
                CreatedBy=self.context['request'].user,
            )
        return customer

    def update(self, instance, validated_data):
        price_code_type = validated_data.pop('PriceCodeType', None)
        fixed_price_code = validated_data.pop('FixedPriceCodeID', None)
        with transaction.atomic():
            customer = super().update(instance, validated_data)
            if price_code_type is not None:
                # Deactivate old config, create new one
                CustomerPriceConfig.objects.filter(CustomerID=customer, IsActive=True).update(IsActive=False)
                CustomerPriceConfig.objects.create(
                    CustomerID=customer,
                    PriceCodeType=price_code_type,
                    FixedPriceCodeID=fixed_price_code,
                    CreatedBy=self.context['request'].user,
                )
        return customer


class NextCustomerCodeSerializer(serializers.Serializer):
    next_code = serializers.CharField()
