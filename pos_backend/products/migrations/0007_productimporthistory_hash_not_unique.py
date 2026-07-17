from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_product_import_history'),
    ]

    operations = [
        migrations.AlterField(
            model_name='productimporthistory',
            name='FileDataHash',
            field=models.CharField(max_length=64),
        ),
    ]
