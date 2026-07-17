from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_seed_uqc_units'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductImportHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('FileDataHash', models.CharField(max_length=64, unique=True)),
                ('OriginalFileName', models.CharField(max_length=255)),
                ('TotalRows', models.IntegerField(default=0)),
                ('ImportedPage', models.CharField(blank=True, default='', max_length=50)),
                ('ImportedOn', models.DateTimeField(auto_now_add=True)),
                ('ImportStatus', models.CharField(max_length=20)),
                ('ImportedBy', models.ForeignKey(db_column='ImportedBy', on_delete=django.db.models.deletion.PROTECT, related_name='product_imports', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'ProductImportHistory_tbl',
                'ordering': ['-ImportedOn'],
                'indexes': [
                    models.Index(fields=['FileDataHash'], name='idx_product_import_hash'),
                    models.Index(fields=['ImportStatus'], name='idx_product_import_status'),
                ],
            },
        ),
    ]
