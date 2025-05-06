from rest_framework import permissions
from .models import Map


class IsMapOwner(permissions.BasePermission):
    """
    Permission to allow only the map owner to access its detailed representation
    """

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Map):
            return obj.owner == request.user
        return False