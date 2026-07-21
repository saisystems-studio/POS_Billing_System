# Pagination

from rest_framework.pagination import PageNumberPagination
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response


class StableOrderingFilter(OrderingFilter):
    """Append the primary key so SQL Server pagination is deterministic."""

    def get_ordering(self, request, queryset, view):
        ordering = list(super().get_ordering(request, queryset, view) or [])
        pk_name = queryset.model._meta.pk.name
        if not any(field.lstrip('-') == pk_name for field in ordering):
            ordering.append(pk_name)
        return ordering

class StandardResultsPagination(PageNumberPagination):
    page_size = 13
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'results': data,
        })
