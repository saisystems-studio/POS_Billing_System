from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0009_price_code_list_performance_indexes'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_product_active_group_id' AND object_id = OBJECT_ID('Product_tbl'))
                CREATE INDEX idx_product_active_group_id ON Product_tbl (IsActive, GroupId, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_product_active_updated_id' AND object_id = OBJECT_ID('Product_tbl'))
                CREATE INDEX idx_product_active_updated_id ON Product_tbl (IsActive, UpdatedAt, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_unit_uqc_name' AND object_id = OBJECT_ID('Unit_tbl'))
                CREATE INDEX idx_unit_uqc_name ON Unit_tbl (UQC, UnitName);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_price_active_code_product' AND object_id = OBJECT_ID('Product_Price_Details_tbl'))
                CREATE INDEX idx_price_active_code_product ON Product_Price_Details_tbl (PriceCodeID, ProductId);
            """,
            reverse_sql="""
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_price_active_code_product' AND object_id = OBJECT_ID('Product_Price_Details_tbl'))
                DROP INDEX idx_price_active_code_product ON Product_Price_Details_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_unit_uqc_name' AND object_id = OBJECT_ID('Unit_tbl'))
                DROP INDEX idx_unit_uqc_name ON Unit_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_product_active_updated_id' AND object_id = OBJECT_ID('Product_tbl'))
                DROP INDEX idx_product_active_updated_id ON Product_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_product_active_group_id' AND object_id = OBJECT_ID('Product_tbl'))
                DROP INDEX idx_product_active_group_id ON Product_tbl;
            """,
        ),
    ]
