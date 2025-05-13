from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class CustomUser(AbstractUser):
    """
    Расширенная модель пользователя Django с дополнительными полями.
    
    Attributes:
        phone (CharField): Телефонный номер пользователя (опционально)
        image (ImageField): Изображение профиля пользователя
    """
    phone = models.CharField(max_length=20, null=True, blank=True)
    image = models.ImageField(upload_to='profile_pics', default='avatar.png', null=True, blank=True)

    def __str__(self):
        """Возвращает имя пользователя как строковое представление."""
        return self.username

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

class HashTag(models.Model):
    """
    Модель хештега для категоризации карт.
    
    Attributes:
        name (CharField): Название хештега (уникальное)
    """
    name = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        """Возвращает название хештега как строковое представление."""
        return self.name
    
    def save(self, *args, **kwargs):
        """
        Переопределение метода сохранения для преобразования названия в нижний регистр.
        
        Args:
            *args: Позиционные аргументы
            **kwargs: Именованные аргументы
            
        Returns:
            Model: Сохраненный объект модели
        """
        self.name = self.name.lower()
        return super().save(*args, **kwargs)
    
    class Meta:
        verbose_name = 'Хештег'
        verbose_name_plural = 'Хештеги'

class Node(models.Model):
    """
    Модель узла карты с географическими координатами.
    
    Attributes:
        name (CharField): Название узла
        latitude (FloatField): Широта
        longitude (FloatField): Долгота
        description (TextField): Описание узла (опционально)
        z_coordinate (FloatField): Z-координата для трехмерных карт (опционально)
        temp_id (IntegerField): Временный идентификатор для операций с фронтендом (опционально)
    """
    name = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()
    description = models.TextField(blank=True, null=True)
    z_coordinate = models.FloatField(blank=True, null=True)
    temp_id = models.IntegerField(null=True, blank=True, db_index=True)
    
    def __str__(self):
        """Возвращает название узла как строковое представление."""
        return self.name

class Edge(models.Model):
    """
    Модель связи между узлами карты.
    
    Attributes:
        node1 (ForeignKey): Ссылка на начальный узел связи
        node2 (ForeignKey): Ссылка на конечный узел связи
        description (TextField): Описание связи (опционально)
        style (JSONField): JSON с параметрами стиля ребра (цвет, ширина, тип линии и т.д.)
        temp_id (IntegerField): Временный идентификатор для операций с фронтендом (опционально)
    """
    node1 = models.ForeignKey(Node, related_name='edges_from', on_delete=models.CASCADE)
    node2 = models.ForeignKey(Node, related_name='edges_to', on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True)
    style = models.JSONField(blank=True, null=True, default=dict)
    temp_id = models.IntegerField(null=True, blank=True, db_index=True)
    
    def __str__(self):
        """Возвращает строковое представление связи в формате 'узел1 -> узел2'."""
        return "%s -> %s" % (self.node1, self.node2)

class Map(models.Model):
    """
    Модель карты с узлами и связями между ними.
    
    Attributes:
        title (CharField): Название карты
        owner (ForeignKey): Владелец карты (ссылка на CustomUser)
        description (TextField): Описание карты (опционально)
        center_latitude (FloatField): Широта центра карты
        center_longitude (FloatField): Долгота центра карты
        nodes (ManyToManyField): Узлы карты
        edges (ManyToManyField): Связи карты
        hashtags (ManyToManyField): Хештеги карты
        is_published (BooleanField): Флаг публикации карты
        created_at (DateTimeField): Дата создания карты
        updated_at (DateTimeField): Дата последнего обновления карты
    """
    title = models.CharField(max_length=100, null=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete = models.CASCADE,
        related_name = 'maps',
    )
    description = models.TextField(blank=True, null=True)
    center_latitude = models.FloatField(
        default=55.921708,
        validators=[MinValueValidator(-90), MaxValueValidator(90)]
    )
    center_longitude = models.FloatField(
        default=37.814387,
        validators=[MinValueValidator(-180), MaxValueValidator(180)]
    )
    nodes = models.ManyToManyField(Node, related_name='maps')
    edges = models.ManyToManyField(Edge, related_name='maps')
    hashtags = models.ManyToManyField(HashTag, related_name='maps', blank=True)
    is_published = models.BooleanField(default=False, verbose_name='published')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        """Возвращает название карты как строковое представление."""
        return self.title

class MapNode(models.Model):
    """
    Модель связи узла с определенной картой (для отслеживания позиций узлов в разных картах).
    
    Attributes:
        map (ForeignKey): Ссылка на карту
        node (ForeignKey): Ссылка на узел
        name (CharField): Название узла на этой карте
        latitude (FloatField): Широта узла на этой карте
        longitude (FloatField): Долгота узла на этой карте
        description (TextField): Описание узла на этой карте (опционально)
        z_coordinate (FloatField): Z-координата узла на этой карте (опционально)
        temp_id (IntegerField): Временный идентификатор для операций с фронтендом (опционально)
    """
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    node = models.ForeignKey(Node, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()
    description = models.TextField(blank=True, null=True)
    z_coordinate = models.FloatField(blank=True, null=True)
    temp_id = models.IntegerField(null=True, blank=True, db_index=True)

    def __str__(self):
        """Возвращает строковое представление в формате 'карта - название'."""
        return "%s - %s" % (self.map, self.name)

class MapEdge(models.Model):
    """
    Модель связи между узлами в контексте определенной карты.
    
    Attributes:
        map (ForeignKey): Ссылка на карту
        node1 (ForeignKey): Ссылка на начальный узел связи
        node2 (ForeignKey): Ссылка на конечный узел связи
        description (TextField): Описание связи (опционально)
        temp_id (IntegerField): Временный идентификатор для операций с фронтендом (опционально)
    """
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    node1 = models.ForeignKey(Node, related_name='map_edges_from', on_delete=models.CASCADE)
    node2 = models.ForeignKey(Node, related_name='map_edges_to', on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True)
    temp_id = models.IntegerField(null=True, blank=True, db_index=True)

    def __str__(self):
        """Возвращает строковое представление связи в формате 'узел1 -> узел2'."""
        return "%s -> %s" % (self.node1, self.node2)
