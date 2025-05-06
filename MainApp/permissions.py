from rest_framework import permissions
from .models import Map


class IsMapOwner(permissions.BasePermission):
    """
    Разрешение, позволяющее только владельцу карты получать доступ к её детальному представлению.
    
    Используется для ограничения доступа к картам в REST API.
    """

    def has_object_permission(self, request, view, obj):
        """
        Проверяет, является ли пользователь владельцем карты.
        
        Args:
            request: Объект HttpRequest с аутентифицированным пользователем
            view: Экземпляр представления API
            obj: Проверяемый объект (карта или другой объект)
            
        Returns:
            bool: True, если пользователь является владельцем карты, иначе False
        """
        if isinstance(obj, Map):
            return obj.owner == request.user
        return False