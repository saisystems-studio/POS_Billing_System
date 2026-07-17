from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from products.models import PriceCodeList, Product, ProductGroup, ProductPriceDetails

from .models import BarcodeGenerator


class BarcodeGeneratorApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username='tester', password='pass123', role='User')
        self.other_user = get_user_model().objects.create_user(username='other', password='pass123', role='User')
        self.group = ProductGroup.objects.create(GroupName='General', CreatedBy=self.user)
        self.product = Product.objects.create(
            GroupId=self.group,
            ProductCode='POD_001',
            ProductName='Mug',
            Units='Pcs',
            HSNCode='1234',
            GSTPercent=18,
            CreatedBy=self.user,
        )
        self.other_product = Product.objects.create(
            GroupId=self.group,
            ProductCode='POD_002',
            ProductName='Plate',
            Units='Pcs',
            HSNCode='4321',
            GSTPercent=18,
            CreatedBy=self.user,
        )
        self.price_code = PriceCodeList.objects.create(
            PriceCodeName='Retail',
            DisplayLabel='Retail',
            SortOrder=1,
            CreatedBy=self.user,
        )
        self.inactive_price_code = PriceCodeList.objects.create(
            PriceCodeName='B',
            DisplayLabel='Price B',
            SortOrder=2,
            IsActive=False,
            CreatedBy=self.user,
        )
        self.price_row = ProductPriceDetails.objects.create(
            ProductId=self.product,
            PriceCodeID=self.price_code,
            PriceName='Retail',
            ProductPrice=Decimal('100.00'),
            CreatedBy=self.user,
        )
        self.other_price_row = ProductPriceDetails.objects.create(
            ProductId=self.other_product,
            PriceCodeID=self.price_code,
            PriceName='Retail',
            ProductPrice=Decimal('150.00'),
            CreatedBy=self.user,
        )
        self.inactive_price_row = ProductPriceDetails.objects.create(
            ProductId=self.product,
            PriceCodeID=self.inactive_price_code,
            PriceName='B',
            ProductPrice=Decimal('120.00'),
            CreatedBy=self.user,
        )
        self.url = reverse('barcode_generator')

    def auth(self):
        self.client.force_authenticate(user=self.user)

    def payload(self, **overrides):
        data = {
            'ProductId': self.product.id,
            'Product_Price_Code_Id': self.price_row.id,
            'SellingPrice': '100.00',
            'MRP': '120.00',
            'CreatedBy': self.other_user.id,
        }
        data.update(overrides)
        return data

    def test_successful_record_creation_uses_authenticated_user(self):
        self.auth()
        res = self.client.post(self.url, self.payload(), format='json')
        self.assertEqual(res.status_code, 201)
        record = BarcodeGenerator.objects.get()
        self.assertEqual(record.CreatedBy_id, self.user.id)
        self.assertIsNotNone(record.CreatedOn)

    def test_missing_product_validation(self):
        self.auth()
        res = self.client.post(self.url, self.payload(ProductId=None), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('ProductId', res.data)

    def test_missing_price_code_validation(self):
        self.auth()
        res = self.client.post(self.url, self.payload(Product_Price_Code_Id=None), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Product_Price_Code_Id', res.data)

    def test_invalid_product_id(self):
        self.auth()
        res = self.client.post(self.url, self.payload(ProductId=999999), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('ProductId', res.data)

    def test_invalid_price_details_id(self):
        self.auth()
        res = self.client.post(self.url, self.payload(Product_Price_Code_Id=999999), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Product_Price_Code_Id', res.data)

    def test_price_code_must_belong_to_product(self):
        self.auth()
        res = self.client.post(self.url, self.payload(Product_Price_Code_Id=self.other_price_row.id), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Product_Price_Code_Id', res.data)

    def test_negative_selling_price(self):
        self.auth()
        res = self.client.post(self.url, self.payload(SellingPrice='-1.00'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('SellingPrice', res.data)

    def test_negative_mrp(self):
        self.auth()
        res = self.client.post(self.url, self.payload(MRP='-1.00'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('MRP', res.data)

    def test_mrp_lower_than_selling_price(self):
        self.auth()
        res = self.client.post(self.url, self.payload(SellingPrice='100.00', MRP='90.00'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('MRP', res.data)

    def test_inactive_price_code_rejected(self):
        self.auth()
        res = self.client.post(self.url, self.payload(Product_Price_Code_Id=self.inactive_price_row.id), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Product_Price_Code_Id', res.data)

    def test_unauthorized_access_rejected(self):
        res = self.client.post(self.url, self.payload(), format='json')
        self.assertIn(res.status_code, (401, 403))
