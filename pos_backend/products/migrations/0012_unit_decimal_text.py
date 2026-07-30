from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0011_seed_default_price_codes'),
    ]

    operations = [
        migrations.AlterField(
            model_name='unit',
            name='Decimal',
            field=models.CharField(default='', max_length=50),
        ),
    ]
