from django.contrib import admin
from .models import CustomUser, Node, Edge, Map, HashTag

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    """
    Административная панель для управления пользователями.
    
    Настройки отображения, фильтрации и поиска пользователей.
    """
    list_display = ('username', 'email', 'phone', 'is_active', 'date_joined')
    search_fields = ('username', 'email')
    list_filter = ('is_active', 'date_joined')
    ordering = ('-date_joined',)

@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    """
    Административная панель для управления узлами карт.
    
    Настройки отображения и поиска узлов.
    """
    list_display = ('id', 'name', 'latitude', 'longitude')
    search_fields = ('name',)

@admin.register(Edge)
class EdgeAdmin(admin.ModelAdmin):
    """
    Административная панель для управления связями между узлами.
    
    Настройки отображения и поиска связей.
    """
    list_display = ('id', 'node1', 'node2', 'description')
    search_fields = ('description',)

@admin.register(Map)
class MapAdmin(admin.ModelAdmin):
    """
    Административная панель для управления картами.
    
    Настройки отображения, фильтрации и поиска карт.
    """
    list_display = ('id', 'title', 'owner', 'created_at', 'updated_at')
    search_fields = ('title', 'description')
    list_filter = ('created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('hashtags',)

admin.site.register(HashTag)
