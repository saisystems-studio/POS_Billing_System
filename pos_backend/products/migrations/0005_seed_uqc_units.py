from django.db import migrations


UQC_UNITS = [
    ('PCS', 'Pieces'),
    ('KG', 'Kilogram'),
    ('GM', 'Gram'),
    ('LTR', 'Litre'),
    ('ML', 'Millilitre'),
    ('PKT', 'Packet'),
    ('BOX', 'Box'),
    ('BTL', 'Bottle'),
    ('CUP', 'Cup'),
    ('DOZ', 'Dozen'),
]


def seed_uqc_units(apps, schema_editor):
    Unit = apps.get_model('products', 'Unit')
    User = apps.get_model('authentication', 'User')
    user = User.objects.order_by('id').first()
    if not user:
        return

    for code, name in UQC_UNITS:
        unit = Unit.objects.filter(UQC__iexact=code).first()
        if unit:
            if unit.UnitName != name:
                unit.UnitName = name
                unit.save(update_fields=['UnitName'])
            continue

        if Unit.objects.filter(UnitName__iexact=name).exists():
            continue

        Unit.objects.create(UQC=code, UnitName=name, Decimal=False, CreatedBy=user)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_product_unit_fk'),
    ]

    operations = [
        migrations.RunPython(seed_uqc_units, migrations.RunPython.noop),
    ]
