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
        return data


class MapSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True)
    edges = EdgeSerializer(many=True)

    class Meta:
        model = Map
        fields = '__all__'
        read_only_fields = ('owner',)

    def create(self, validated_data):
        # Автоматическое назначение владельца
        validated_data['owner'] = self.context['request'].user
        return super().create(validated_data)