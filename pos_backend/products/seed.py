from django.apps import apps as global_apps
from django.conf import settings


DEFAULT_PRICE_CODES = [
    {'PriceCodeName': 'A', 'DisplayLabel': 'Price A', 'SortOrder': 1, 'IsActive': True},
    {'PriceCodeName': 'B', 'DisplayLabel': 'Price B', 'SortOrder': 2, 'IsActive': True},
    {'PriceCodeName': 'C', 'DisplayLabel': 'Price C', 'SortOrder': 3, 'IsActive': True},
    {'PriceCodeName': 'D', 'DisplayLabel': 'Price D', 'SortOrder': 4, 'IsActive': True},
    {'PriceCodeName': 'Retail', 'DisplayLabel': 'Retail Price', 'SortOrder': 5, 'IsActive': True},
]


def _get_models(apps_registry=None):
    registry = apps_registry or global_apps
    user_app_label, user_model_name = settings.AUTH_USER_MODEL.split('.')
    return (
        registry.get_model('products', 'PriceCodeList'),
        registry.get_model(user_app_label, user_model_name),
    )


def _get_seed_user(UserModel, using='default', user=None):
    if user and getattr(user, 'pk', None):
        return user
    return (
        UserModel.objects.using(using).filter(is_active=True, is_superuser=True).order_by('id').first()
        or UserModel.objects.using(using).filter(is_active=True).order_by('id').first()
        or UserModel.objects.using(using).order_by('id').first()
    )


def seed_price_codes(user=None, using='default', apps_registry=None):
    """
    Create missing default PriceCodeList rows.

    Existing rows are intentionally left unchanged to avoid overwriting
    user-modified labels, sort order, or active status.
    """
    PriceCodeList, UserModel = _get_models(apps_registry)
    seed_user = _get_seed_user(UserModel, using=using, user=user)
    if not seed_user:
        return 0

    created_count = 0
    for row in DEFAULT_PRICE_CODES:
        exists = PriceCodeList.objects.using(using).filter(PriceCodeName=row['PriceCodeName']).exists()
        if exists:
            continue
        _, created = PriceCodeList.objects.using(using).update_or_create(
            PriceCodeName=row['PriceCodeName'],
            defaults={
                'DisplayLabel': row['DisplayLabel'],
                'SortOrder': row['SortOrder'],
                'IsActive': row['IsActive'],
                'CreatedBy': seed_user,
            },
        )
        if created:
            created_count += 1
    return created_count
