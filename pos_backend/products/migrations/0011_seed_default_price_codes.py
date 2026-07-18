from django.conf import settings
from django.db import migrations


DEFAULT_PRICE_CODES = [
    {'PriceCodeName': 'A', 'DisplayLabel': 'Price A', 'SortOrder': 1, 'IsActive': True},
    {'PriceCodeName': 'B', 'DisplayLabel': 'Price B', 'SortOrder': 2, 'IsActive': True},
    {'PriceCodeName': 'C', 'DisplayLabel': 'Price C', 'SortOrder': 3, 'IsActive': True},
    {'PriceCodeName': 'D', 'DisplayLabel': 'Price D', 'SortOrder': 4, 'IsActive': True},
    {'PriceCodeName': 'Retail', 'DisplayLabel': 'Retail Price', 'SortOrder': 5, 'IsActive': True},
]


def seed_default_price_codes(apps, schema_editor):
    PriceCodeList = apps.get_model('products', 'PriceCodeList')
    user_app_label, user_model_name = settings.AUTH_USER_MODEL.split('.')
    User = apps.get_model(user_app_label, user_model_name)
    using = schema_editor.connection.alias

    seed_user = (
        User.objects.using(using).filter(is_active=True, is_superuser=True).order_by('id').first()
        or User.objects.using(using).filter(is_active=True).order_by('id').first()
        or User.objects.using(using).order_by('id').first()
    )
    if not seed_user:
        return

    for row in DEFAULT_PRICE_CODES:
        if PriceCodeList.objects.using(using).filter(PriceCodeName=row['PriceCodeName']).exists():
            continue
        PriceCodeList.objects.using(using).update_or_create(
            PriceCodeName=row['PriceCodeName'],
            defaults={
                'DisplayLabel': row['DisplayLabel'],
                'SortOrder': row['SortOrder'],
                'IsActive': row['IsActive'],
                'CreatedBy': seed_user,
            },
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0010_pos_performance_indexes'),
    ]

    operations = [
        migrations.RunPython(seed_default_price_codes, noop_reverse),
    ]
