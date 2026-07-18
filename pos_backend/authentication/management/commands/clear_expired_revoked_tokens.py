from django.core.management.base import BaseCommand
from django.utils import timezone

from authentication.models import RevokedRefreshToken


class Command(BaseCommand):
    help = 'Delete expired revoked refresh token records.'

    def handle(self, *args, **options):
        deleted, _ = RevokedRefreshToken.objects.filter(expires_at__lt=timezone.now()).delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} expired revoked refresh token record(s).'))
