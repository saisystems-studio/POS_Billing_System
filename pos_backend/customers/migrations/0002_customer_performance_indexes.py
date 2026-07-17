from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_active_name_id' AND object_id = OBJECT_ID('Customer_tbl'))
                CREATE INDEX idx_customer_active_name_id ON Customer_tbl (IsActive, CustomerName, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_active_code_id' AND object_id = OBJECT_ID('Customer_tbl'))
                CREATE INDEX idx_customer_active_code_id ON Customer_tbl (IsActive, CustomerCode, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_active_phone_id' AND object_id = OBJECT_ID('Customer_tbl'))
                CREATE INDEX idx_customer_active_phone_id ON Customer_tbl (IsActive, PhoneNumber, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cust_price_fixed_active' AND object_id = OBJECT_ID('CustomerPriceConfig_tbl'))
                CREATE INDEX idx_cust_price_fixed_active ON CustomerPriceConfig_tbl (CustomerID, IsActive, FixedPriceCodeID);
            """,
            reverse_sql="""
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cust_price_fixed_active' AND object_id = OBJECT_ID('CustomerPriceConfig_tbl'))
                DROP INDEX idx_cust_price_fixed_active ON CustomerPriceConfig_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_active_phone_id' AND object_id = OBJECT_ID('Customer_tbl'))
                DROP INDEX idx_customer_active_phone_id ON Customer_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_active_code_id' AND object_id = OBJECT_ID('Customer_tbl'))
                DROP INDEX idx_customer_active_code_id ON Customer_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_active_name_id' AND object_id = OBJECT_ID('Customer_tbl'))
                DROP INDEX idx_customer_active_name_id ON Customer_tbl;
            """,
        ),
    ]
