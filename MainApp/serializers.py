from rest_framework import serializers
from .models import Map, Node, Edge


class NodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = '__all__'

    def validate_latitude(self, value):
        if not (-90 <= value <= 90):
            raise serializers.ValidationError("Широта должна быть между -90 и 90")
        return value

    def validate_longitude(self, value):
        if not (-180 <= value <= 180):
            raise serializers.ValidationError("Долгота должна быть между -180 и 180")
        return value


class EdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edge
        fields = '__all__'

    def validate(self, data):
        if data['node1'] == data['node2']:
            raise serializers.ValidationError("Узлы не могут ссылаться сами на себя")

        # Проверка принадлежности узлов к карте
        if data['node1'].map != data['node2'].map:
            raise serializers.ValidationError("Узлы должны принадлежать одной карте")
        return data


class MapSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True)
    edges = EdgeSerializer(many=True)

    class Meta:
        model = Map
        fields = '__all__'
        read_only_fields = ('owner',)

    def create(self, validated_data):
        nodes_data = validated_data.pop('nodes')
        edges_data = validated_data.pop('edges')
        map_instance = super().create(validated_data)

        # Создаем узлы
        for node_data in nodes_data:
            Node.objects.create(map=map_instance, **node_data)

        # Создаем ребра с проверкой существования узлов
        for edge_data in edges_data:
            node1 = Node.objects.get(id=edge_data['node1'].id, map=map_instance)
            node2 = Node.objects.get(id=edge_data['node2'].id, map=map_instance)
            Edge.objects.create(map=map_instance, node1=node1, node2=node2)

        return map_instance

    def update(self, instance, validated_data):
        # 1. Извлекаем вложенные данные
        nodes_data = validated_data.pop('nodes', [])
        edges_data = validated_data.pop('edges', [])

        # 2. Обновляем основные поля карты
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.center_latitude = validated_data.get('center_latitude', instance.center_latitude)
        instance.center_longitude = validated_data.get('center_longitude', instance.center_longitude)
        instance.save()

        # 3. Обновляем узлы (nodes)
        existing_nodes = {node.id: node for node in instance.nodes.all()}
        for node_data in nodes_data:
            node_id = node_data.get('id')
            if node_id in existing_nodes:
                # Обновляем существующий узел
                node = existing_nodes.pop(node_id)
                node.latitude = node_data.get('latitude', node.latitude)
                node.longitude = node_data.get('longitude', node.longitude)
                node.name = node_data.get('name', node.name)
                node.description = node_data.get('description', node.description)
                node.z_coordinate = node_data.get('z_coordinate', node.z_coordinate)
                node.save()
            else:
                # Создаем новый узел
                Node.objects.create(map=instance, **node_data)

        # Удаляем узлы, которые были исключены
        Node.objects.filter(id__in=existing_nodes.keys()).delete()

        # 4. Обновляем ребра (edges)
        existing_edges = {edge.id: edge for edge in instance.edges.all()}
        for edge_data in edges_data:
            edge_id = edge_data.get('id')
            node1 = Node.objects.get(id=edge_data['node1'].id, map=instance)
            node2 = Node.objects.get(id=edge_data['node2'].id, map=instance)

            if edge_id in existing_edges:
                # Обновляем существующее ребро
                edge = existing_edges.pop(edge_id)
                edge.node1 = node1
                edge.node2 = node2
                edge.save()
            else:
                # Создаем новое ребро
                Edge.objects.create(map=instance, node1=node1, node2=node2)

        # Удаляем ребра, которые были исключены
        Edge.objects.filter(id__in=existing_edges.keys()).delete()

        return instance