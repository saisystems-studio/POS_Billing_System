from django.db import migrations, models


def create_index_if_missing(table_name, index_name, columns):
    column_sql = ', '.join(f'[{column}]' for column in columns)
    return f"""
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'{index_name}'
      AND object_id = OBJECT_ID(N'[{table_name}]')
)
BEGIN
    CREATE INDEX [{index_name}] ON [{table_name}] ({column_sql});
END
"""


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0008_billing_product_search_indexes'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    create_index_if_missing(
                        'Product_Price_Details_tbl',
                        'idx_price_code',
                        ['PriceCodeID'],
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    create_index_if_missing(
                        'Product_Price_Details_tbl',
                        'idx_price_product_code',
                        ['ProductId', 'PriceCodeID'],
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    create_index_if_missing(
                        'PriceCodeList_tbl',
                        'idx_pricecode_active_sort',
                        ['IsActive', 'SortOrder', 'id'],
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    create_index_if_missing(
                        'PriceCodeList_tbl',
                        'idx_pricecode_name',
                        ['PriceCodeName'],
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='productpricedetails',
                    index=models.Index(fields=['PriceCodeID'], name='idx_price_code'),
                ),
                migrations.AddIndex(
                    model_name='productpricedetails',
                    index=models.Index(fields=['ProductId', 'PriceCodeID'], name='idx_price_product_code'),
                ),
                migrations.AddIndex(
                    model_name='pricecodelist',
                    index=models.Index(fields=['IsActive', 'SortOrder', 'id'], name='idx_pricecode_active_sort'),
                ),
                migrations.AddIndex(
                    model_name='pricecodelist',
                    index=models.Index(fields=['PriceCodeName'], name='idx_pricecode_name'),
                ),
            ],
        ),
    ]
