import logging
import time


logger = logging.getLogger('pos_backend.performance')


class ApiTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = (time.monotonic() - started) * 1000
        if request.path.startswith('/api/') and elapsed_ms >= 1000:
            logger.warning(
                'Slow API request %.0fms %s %s status=%s',
                elapsed_ms,
                request.method,
                request.path,
                getattr(response, 'status_code', '-'),
            )
        return response
