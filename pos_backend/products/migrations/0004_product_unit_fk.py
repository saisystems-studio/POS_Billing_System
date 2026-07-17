from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_productgroup_add_hsn_gst'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='UnitId',
            field=models.ForeignKey(
                blank=True,
                db_column='UnitId',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='products',
                to='products.unit',
            ),
        ),
    ]
