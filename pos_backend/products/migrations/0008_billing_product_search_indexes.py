from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0007_productimporthistory_hash_not_unique'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['IsActive', 'id'], name='idx_product_active_id'),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['IsActive', 'ProductName', 'id'], name='idx_product_active_name_id'),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(fields=['IsActive', 'ProductCode', 'id'], name='idx_product_active_code_id'),
        ),
    ]
