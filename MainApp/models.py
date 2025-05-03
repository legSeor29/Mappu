from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    phone = models.CharField(max_length=20, null=True, blank=True)
    image = models.ImageField(upload_to='profile_pics', default='profile_pics/default.jpg', null=True, blank=True)

    def __str__(self):
        return self.username

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

class Node(models.Model):
    name = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()
    description = models.TextField(blank=True, null=True)
    z_coordinate = models.FloatField(blank=True, null=True)
    temp_id = models.IntegerField(null=True, blank=True, db_index=True)
    def __str__(self):
        return self.name

class Edge(models.Model):
    node1 = models.ForeignKey(Node, related_name='edges_from', on_delete=models.CASCADE)
    node2 = models.ForeignKey(Node, related_name='edges_to', on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True)
    temp_id = models.IntegerField(null=True, blank=True, db_index=True)
    def __str__(self):
        return f"{self.node1} -> {self.node2}"

class Map(models.Model):
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
    is_published = models.BooleanField(default=False, verbose_name='published')

    def __str__(self):
        return self.title
