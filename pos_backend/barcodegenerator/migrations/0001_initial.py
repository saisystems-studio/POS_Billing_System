from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0005_seed_uqc_units'),
    ]

    operations = [
        migrations.CreateModel(
            name='BarcodeGenerator',
            fields=[
                ('id', models.AutoField(db_column='Id', primary_key=True, serialize=False, unique=True)),
                ('SellingPrice', models.DecimalField(decimal_places=2, max_digits=18)),
                ('MRP', models.DecimalField(decimal_places=2, max_digits=18)),
                ('CreatedOn', models.DateTimeField(auto_now_add=True)),
                ('CreatedBy', models.ForeignKey(db_column='CreatedBy', on_delete=django.db.models.deletion.PROTECT, related_name='barcode_generator_records', to=settings.AUTH_USER_MODEL)),
                ('ProductId', models.ForeignKey(db_column='ProductId', on_delete=django.db.models.deletion.PROTECT, related_name='barcode_generator_records', to='products.product')),
                ('Product_Price_Code_Id', models.ForeignKey(db_column='Product_Price_Code_Id', on_delete=django.db.models.deletion.PROTECT, related_name='barcode_generator_records', to='products.productpricedetails')),
            ],
            options={
                'db_table': 'BarcodeGenerator_tbl',
                'ordering': ['-CreatedOn'],
                'indexes': [
                    models.Index(fields=['ProductId'], name='idx_barcode_product'),
                    models.Index(fields=['Product_Price_Code_Id'], name='idx_barcode_price'),
                ],
                'constraints': [
                    models.CheckConstraint(check=models.Q(('MRP__gte', models.F('SellingPrice'))), name='ck_barcode_mrp_gte_selling'),
                ],
            },
        ),
        migrations.RunSQL(
            sql="""
IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[BarcodeGenerator_tbl]')
      AND c.name = N'CreatedOn'
)
BEGIN
    ALTER TABLE [dbo].[BarcodeGenerator_tbl]
    ADD CONSTRAINT [DF_BarcodeGenerator_CreatedOn]
    DEFAULT GETDATE() FOR [CreatedOn]
END
""",
            reverse_sql="""
IF EXISTS (
    SELECT 1
    FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID(N'[dbo].[BarcodeGenerator_tbl]')
      AND name = N'DF_BarcodeGenerator_CreatedOn'
)
BEGIN
    ALTER TABLE [dbo].[BarcodeGenerator_tbl]
    DROP CONSTRAINT [DF_BarcodeGenerator_CreatedOn]
END
""",
        ),
    ]
