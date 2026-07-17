# Dashboard, Company Info, UserSettings and Notification serializers.

import re
from rest_framework import serializers
from .models import CompanyInfo, CompanyConfig, CompanyConfigHistory, UserSettings, Notification

PHONE_RE = re.compile(r'^[6-9]\d{9}$')
GST_RE   = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')


def clean_phone(value: str) -> str:
    return re.sub(r'\D', '', value or '')


# ─── Legacy CompanyInfo (Company_Info table) ─────────────────────────────────

class CompanyInfoSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)

    class Meta:
        model = CompanyInfo
        fields = [
            'id', 'CompanyName', 'IsGSTEnabled', 'GSTNo',
            'PhoneNumber', 'EmailId', 'Address', 'Logo',
            'CreatedOn', 'UpdatedAt', 'CreatedBy', 'CreatedByUsername',
        ]
        read_only_fields = ['id', 'CreatedOn', 'UpdatedAt', 'CreatedBy', 'CreatedByUsername']

    def validate_PhoneNumber(self, value):
        digits = clean_phone(value)
        if not PHONE_RE.match(digits):
            raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number.")
        return digits

    def validate_GSTNo(self, value):
        if value and value.strip():
            gst = value.strip().upper()
            if len(gst) != 15:
                raise serializers.ValidationError("GST Number must be exactly 15 characters.")
            if not gst[:2].isdigit():
                raise serializers.ValidationError("GST Number must start with a 2-digit state code.")
            return gst
        return None

    def validate(self, attrs):
        is_gst = attrs.get('IsGSTEnabled', getattr(self.instance, 'IsGSTEnabled', False))
        gst_no = attrs.get('GSTNo', getattr(self.instance, 'GSTNo', None))
        if is_gst and not gst_no:
            raise serializers.ValidationError({'GSTNo': 'GST Number is required when GST is enabled.'})
        if not is_gst:
            attrs['GSTNo'] = None
        return attrs

    def create(self, validated_data):
        validated_data['CreatedBy'] = self.context['request'].user
        return super().create(validated_data)


# ─── CompanyConfig (CompanyInfo_tbl) ─────────────────────────────────────────

class CompanyConfigSerializer(serializers.ModelSerializer):
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)

    class Meta:
        model  = CompanyConfig
        fields = [
            'id', 'CompanyCode', 'CompanyName', 'PhoneNumber', 'Email', 'Address',
            'IsGSTRegistered', 'GSTNumber', 'CompanyLogo',
            'CreatedBy', 'CreatedByUsername', 'CreatedOn', 'UpdatedAt',
        ]
        read_only_fields = ['id', 'CompanyCode', 'CreatedBy', 'CreatedByUsername', 'CreatedOn', 'UpdatedAt']

    def validate_CompanyName(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Company name is required.")
        return v

    def validate_PhoneNumber(self, value):
        digits = clean_phone(value)
        if not PHONE_RE.match(digits):
            raise serializers.ValidationError("Enter a valid 10-digit Indian mobile number (starts with 6–9).")
        return digits

    def validate_Email(self, value):
        # Email is optional — only validate format if a value is provided
        v = (value or '').strip()
        return v if v else None

    def validate_Address(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Address is required.")
        return v

    def validate_GSTNumber(self, value):
        if value and value.strip():
            gst = value.strip().upper()
            if len(gst) != 15:
                raise serializers.ValidationError("GST Number must be exactly 15 characters.")
            if not GST_RE.match(gst):
                raise serializers.ValidationError(
                    "Invalid GST Number format. Expected: 2-digit state code + PAN + 1 + Z + check."
                )
            return gst
        return None

    def validate(self, attrs):
        is_gst  = attrs.get('IsGSTRegistered', getattr(self.instance, 'IsGSTRegistered', False))
        gst_num = attrs.get('GSTNumber', getattr(self.instance, 'GSTNumber', None))

        if is_gst and not gst_num:
            raise serializers.ValidationError({'GSTNumber': 'GST Number is required when GST is registered.'})

        if is_gst and gst_num:
            # Duplicate check — case-insensitive, exclude current record
            qs = CompanyConfig.objects.filter(GSTNumber__iexact=gst_num)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'GSTNumber': 'This GST number is already registered.'})

        if not is_gst:
            attrs['GSTNumber'] = None

        return attrs

    def create(self, validated_data):
        validated_data['CreatedBy'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # CreatedBy never changes on update
        validated_data.pop('CreatedBy', None)
        return super().update(instance, validated_data)


# ─── CompanyConfigHistory ─────────────────────────────────────────────────────

class CompanyConfigHistorySerializer(serializers.ModelSerializer):
    ChangedByUsername = serializers.CharField(source='ChangedBy.username', read_only=True)
    CompanyLogo       = serializers.SerializerMethodField()

    class Meta:
        model  = CompanyConfigHistory
        fields = [
            'id', 'CompanyName', 'PhoneNumber', 'Email', 'Address',
            'IsGSTRegistered', 'GSTNumber', 'CompanyLogo',
            'ChangedBy', 'ChangedByUsername', 'ChangedOn',
        ]
        read_only_fields = fields

    def get_CompanyLogo(self, obj):
        request = self.context.get('request')
        if obj.CompanyLogo:
            return request.build_absolute_uri(obj.CompanyLogo.url) if request else obj.CompanyLogo.url
        return None


# ─── UserSettings ─────────────────────────────────────────────────────────────

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserSettings
        fields = ['id', 'theme', 'notifications_enabled', 'keyboard_shortcuts_enabled', 'keyboard_shortcuts']
        read_only_fields = ['id']

    def validate_keyboard_shortcuts(self, value):
        if not isinstance(value, (list, dict)):
            raise serializers.ValidationError("Must be a list or dict.")
        return value


# ─── Notification ─────────────────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notification
        fields = ['id', 'title', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']
