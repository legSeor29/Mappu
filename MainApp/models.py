from django.db import models

class Node(models.Model):
    name = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()

    def __str__(self):
        return self.name

class Edge(models.Model):
    node1 = models.ForeignKey(Node, related_name='edges_from', on_delete=models.CASCADE)
    node2 = models.ForeignKey(Node, related_name='edges_to', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.node1} -> {self.node2}"

class Map(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    nodes = models.ManyToManyField(Node, related_name='maps')
    edges = models.ManyToManyField(Edge, related_name='maps')

    def __str__(self):
        return self.title
