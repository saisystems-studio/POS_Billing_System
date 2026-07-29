from rest_framework import serializers

from products.models import Product, ProductPriceDetails

from .models import BarcodeGenerator


class BarcodeProductOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'ProductCode', 'ProductName', 'Units']


class BarcodePriceOptionSerializer(serializers.ModelSerializer):
    PriceCodeID = serializers.IntegerField(source='PriceCodeID.id', read_only=True)
    PriceCodeName = serializers.CharField(source='PriceCodeID.PriceCodeName', read_only=True)
    DisplayLabel = serializers.CharField(source='PriceCodeID.DisplayLabel', read_only=True)

    class Meta:
        model = ProductPriceDetails
        fields = ['id', 'PriceCodeID', 'PriceCodeName', 'DisplayLabel', 'PriceName', 'ProductPrice']


class BarcodeGeneratorSerializer(serializers.ModelSerializer):
    ProductName = serializers.CharField(source='ProductId.ProductName', read_only=True)
    ProductCode = serializers.CharField(source='ProductId.ProductCode', read_only=True)
    PriceCodeName = serializers.CharField(source='Product_Price_Code_Id', read_only=True)
    CreatedByUsername = serializers.CharField(source='CreatedBy.username', read_only=True)

    class Meta:
        model = BarcodeGenerator
        fields = [
            'id', 'ProductId', 'ProductName', 'ProductCode',
            'Product_Price_Code_Id', 'PriceCodeName',
            'SellingPrice', 'MRP', 'CreatedBy', 'CreatedByUsername', 'CreatedOn',
        ]
        read_only_fields = [
            'id', 'ProductName', 'ProductCode', 'PriceCodeName',
            'CreatedBy', 'CreatedByUsername', 'CreatedOn',
        ]

    def validate_ProductId(self, value):
        if not value.IsActive:
            raise serializers.ValidationError("Selected product is inactive.")
        return value

    def validate_SellingPrice(self, value):
        if value <= 0:
            raise serializers.ValidationError("Selling Price must be greater than zero.")
        return value

    def validate_MRP(self, value):
        if value <= 0:
            raise serializers.ValidationError("MRP must be greater than zero.")
        return value

    def validate(self, attrs):
        product = attrs.get('ProductId')
        selling_price = attrs.get('SellingPrice')
        mrp = attrs.get('MRP')

        if selling_price is not None and mrp is not None and mrp < selling_price:
            raise serializers.ValidationError({'MRP': 'MRP cannot be less than Selling Price.'})
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['CreatedBy'] = request.user
        return super().create(validated_data)
