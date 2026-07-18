from django.conf import settings
from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver

from .seed import seed_price_codes


@receiver(post_migrate)
def seed_price_codes_after_migrate(sender, app_config=None, using='default', **kwargs):
    if getattr(app_config, 'label', None) != 'products':
        return
    seed_price_codes(using=using)


@receiver(post_save)
def seed_price_codes_after_user_created(sender, instance, created, using='default', **kwargs):
    if sender._meta.label != settings.AUTH_USER_MODEL:
        return
    if created:
        seed_price_codes(user=instance, using=using)
