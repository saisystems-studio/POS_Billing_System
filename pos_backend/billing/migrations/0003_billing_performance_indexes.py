from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0002_add_changeable_rate_and_billing_config'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_created_id' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                CREATE INDEX idx_billhdr_created_id ON BillingHeader_tbl (CreatedOn, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_billdate_id' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                CREATE INDEX idx_billhdr_billdate_id ON BillingHeader_tbl (BillDate, id);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_customer_created' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                CREATE INDEX idx_billhdr_customer_created ON BillingHeader_tbl (CustomerID, CreatedOn);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_billno_created' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                CREATE INDEX idx_billhdr_billno_created ON BillingHeader_tbl (BillNo, CreatedOn);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billing_header_product' AND object_id = OBJECT_ID('Billing_tbl'))
                CREATE INDEX idx_billing_header_product ON Billing_tbl (BillingHeaderID, ProductID);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billing_created_header' AND object_id = OBJECT_ID('Billing_tbl'))
                CREATE INDEX idx_billing_created_header ON Billing_tbl (CreatedOn, BillingHeaderID);
            """,
            reverse_sql="""
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billing_created_header' AND object_id = OBJECT_ID('Billing_tbl'))
                DROP INDEX idx_billing_created_header ON Billing_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billing_header_product' AND object_id = OBJECT_ID('Billing_tbl'))
                DROP INDEX idx_billing_header_product ON Billing_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_billno_created' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                DROP INDEX idx_billhdr_billno_created ON BillingHeader_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_customer_created' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                DROP INDEX idx_billhdr_customer_created ON BillingHeader_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_billdate_id' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                DROP INDEX idx_billhdr_billdate_id ON BillingHeader_tbl;

            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_billhdr_created_id' AND object_id = OBJECT_ID('BillingHeader_tbl'))
                DROP INDEX idx_billhdr_created_id ON BillingHeader_tbl;
            """,
        ),
    ]
