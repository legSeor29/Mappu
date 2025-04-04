from rest_framework.permissions import BasePermission


class IsMapOwner(BasePermission):
    """Проверяет, является ли пользователь владельцем карты"""

    def has_object_permission(self, request, view, obj):
        # Для GET, HEAD, OPTIONS разрешаем доступ всем
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        # Для остальных методов проверяем владельца
        return obj.owner == request.user