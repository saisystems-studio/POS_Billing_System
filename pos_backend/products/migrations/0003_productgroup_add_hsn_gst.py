from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0002_add_unit_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='productgroup',
            name='HSNCode',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='productgroup',
            name='GSTPercent',
            field=models.IntegerField(blank=True, default=0, null=True),
        ),
    ]
