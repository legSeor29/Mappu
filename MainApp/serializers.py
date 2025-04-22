from rest_framework import serializers
from .models import Map, Node, Edge
import logging


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


# Этот сериализатор используется только для чтения данных
class EdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edge
        fields = '__all__'

    def validate(self, data):
        if data['node1'] == data['node2']:
            raise serializers.ValidationError("Узлы не могут ссылаться сами на себя")
        
        # Убираем проверку принадлежности узлов к карте, т.к. это проверяется в other логике
        return data


# Сериализатор для обработки ребер при отправке данных с клиента
class EdgeWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    node1 = serializers.IntegerField()
    node2 = serializers.IntegerField()
    
    def validate(self, data):
        if data['node1'] == data['node2']:
            raise serializers.ValidationError("Узлы не могут ссылаться сами на себя")
        return data


class MapSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, required=False)
    # Используем EdgeSerializer только для чтения 
    edges = EdgeSerializer(many=True, read_only=True)
    # А этот сериализатор для записи
    edges_data = EdgeWriteSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Map
        fields = '__all__'
        read_only_fields = ('owner',)

    def to_internal_value(self, data):
        # Преобразуем edges в edges_data для обработки
        if 'edges' in data:
            data['edges_data'] = data.pop('edges')
        return super().to_internal_value(data)

    def create(self, validated_data):
        nodes_data = validated_data.pop('nodes', [])
        edges_data = validated_data.pop('edges_data', [])
        map_instance = super().create(validated_data)

        # Словарь для хранения созданных узлов
        created_nodes = {}

        # Создаем узлы
        for node_data in nodes_data:
            node = Node.objects.create(
                name=node_data.get('name', ''),
                latitude=node_data.get('latitude'),
                longitude=node_data.get('longitude'),
                description=node_data.get('description', ''),
                z_coordinate=node_data.get('z_coordinate', 0)
            )
            map_instance.nodes.add(node)
            created_nodes[node_data.get('id')] = node

        # Создаем ребра с проверкой существования узлов
        for edge_data in edges_data:
            node1_id = edge_data.get('node1')
            node2_id = edge_data.get('node2')
            
            # Проверяем, что оба узла существуют
            if node1_id in created_nodes and node2_id in created_nodes:
                node1 = created_nodes[node1_id]
                node2 = created_nodes[node2_id]
                
                # Создаем ребро
                edge = Edge.objects.create(node1=node1, node2=node2)
                map_instance.edges.add(edge)

        return map_instance

    def update(self, instance, validated_data):
        logger = logging.getLogger(__name__)
        logger.info(f"Обновление карты ID: {instance.id}")
        logger.debug(f"Входящие данные: {validated_data}")
        
        try:
            # 1. Извлекаем вложенные данные
            nodes_data = validated_data.pop('nodes', [])
            edges_data = validated_data.pop('edges_data', [])
            logger.info(f"Получено узлов: {len(nodes_data)}, ребер: {len(edges_data)}")
            
            # 2. Обновляем основные поля карты
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            # Создаем словари для текущих объектов в БД
            existing_nodes_dict = {str(node.id): node for node in instance.nodes.all()}
            logger.debug(f"Существующие узлы: {[n.id for n in instance.nodes.all()]}")
            
            # Словарь для отслеживания соответствия временных ID и постоянных ID
            temp_to_perm_id_map = {}
            
            # 3. Сначала создаем/обновляем ВСЕ узлы
            for node_data in nodes_data:
                try:
                    temp_node_id = str(node_data.get('id'))
                    logger.debug(f"Обработка узла с ID: {temp_node_id}")
                    
                    if temp_node_id in existing_nodes_dict:
                        # Обновляем существующий узел
                        node = existing_nodes_dict[temp_node_id]
                        for attr, value in node_data.items():
                            if attr != 'id':
                                setattr(node, attr, value)
                        node.save()
                        # Добавляем в карту отображения - ID не изменился
                        temp_to_perm_id_map[temp_node_id] = temp_node_id
                        logger.info(f"Обновлен узел ID: {temp_node_id}")
                    else:
                        # Проверяем, может быть узел уже существует, но с другим ID
                        existing_node = Node.objects.filter(
                            latitude=node_data.get('latitude'),
                            longitude=node_data.get('longitude')
                        ).first()
                        
                        if existing_node:
                            # Используем существующий узел
                            instance.nodes.add(existing_node)
                            temp_to_perm_id_map[temp_node_id] = str(existing_node.id)
                            logger.info(f"Использован существующий узел. Временный ID: {temp_node_id}, Постоянный ID: {existing_node.id}")
                        else:
                            # Создаем новый узел
                            new_node = Node.objects.create(
                                name=node_data.get('name', ''),
                                latitude=node_data.get('latitude'),
                                longitude=node_data.get('longitude'),
                                description=node_data.get('description', ''),
                                z_coordinate=node_data.get('z_coordinate', 0)
                            )
                            instance.nodes.add(new_node)
                            # Сопоставляем временный ID с постоянным
                            temp_to_perm_id_map[temp_node_id] = str(new_node.id)
                            logger.info(f"Создан новый узел. Временный ID: {temp_node_id}, Постоянный ID: {new_node.id}")
                            
                except Exception as e:
                    logger.error(f"Ошибка при обработке узла: {str(e)}")
                    raise serializers.ValidationError(f"Ошибка при обработке узла: {str(e)}")

            # Важно: обновляем список узлов после добавления новых
            instance.refresh_from_db()
            
            # Логируем карту соответствия ID
            logger.debug(f"Карта соответствия ID: {temp_to_perm_id_map}")
            
            # 4. Обрабатываем рёбра ПОСЛЕ создания всех узлов
            existing_edges_dict = {str(edge.id): edge for edge in instance.edges.all()}
            logger.debug(f"Существующие рёбра: {[e.id for e in instance.edges.all()]}")
            
            # Сохраняем данные о новых ребрах для обработки их после цикла
            new_edges_data = []
            
            for edge_data in edges_data:
                try:
                    temp_edge_id = str(edge_data.get('id'))
                    logger.debug(f"Обработка ребра с ID: {temp_edge_id}")
                    
                    # Получаем данные о узлах ребра
                    temp_node1_id = str(edge_data.get('node1'))
                    temp_node2_id = str(edge_data.get('node2'))
                    
                    # Находим постоянные ID узлов из карты соответствия
                    perm_node1_id = temp_to_perm_id_map.get(temp_node1_id, temp_node1_id)
                    perm_node2_id = temp_to_perm_id_map.get(temp_node2_id, temp_node2_id)
                    
                    logger.debug(f"Ребро {temp_edge_id}: node1={temp_node1_id}->{perm_node1_id}, node2={temp_node2_id}->{perm_node2_id}")
                    
                    # Сохраняем данные для последующей обработки
                    new_edges_data.append({
                        'temp_id': temp_edge_id,
                        'node1_id': perm_node1_id,
                        'node2_id': perm_node2_id,
                        'is_existing': temp_edge_id in existing_edges_dict
                    })
                    
                except Exception as e:
                    logger.error(f"Ошибка при подготовке данных ребра: {str(e)}")
                    
            # Теперь создаем/обновляем ребра, когда все узлы точно созданы
            for edge_info in new_edges_data:
                try:
                    # Получаем объекты узлов по их постоянным ID
                    node1 = Node.objects.get(id=edge_info['node1_id'])
                    node2 = Node.objects.get(id=edge_info['node2_id'])
                    
                    if edge_info['is_existing']:
                        # Обновляем существующее ребро
                        edge = existing_edges_dict[edge_info['temp_id']]
                        edge.node1 = node1
                        edge.node2 = node2
                        edge.save()
                        logger.info(f"Обновлено ребро ID: {edge_info['temp_id']}")
                    else:
                        # Создаем новое ребро
                        new_edge = Edge.objects.create(node1=node1, node2=node2)
                        instance.edges.add(new_edge)
                        logger.info(f"Создано новое ребро ID: {new_edge.id}, соединяющее узлы {node1.id} и {node2.id}")
                except Node.DoesNotExist as e:
                    logger.error(f"Узел не найден: {str(e)}")
                except Exception as e:
                    logger.error(f"Ошибка при обработке ребра: {str(e)}")
            
            # Обновляем данные экземпляра
            instance.refresh_from_db()
            return instance
            
        except Exception as e:
            logger.exception("Ошибка в методе update сериализатора")
            raise serializers.ValidationError(f"Ошибка при обновлении карты: {str(e)}")