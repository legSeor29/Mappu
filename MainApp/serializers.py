from rest_framework import serializers
from .models import Map, Node, Edge
import logging


class NodeSerializer(serializers.ModelSerializer):
    temp_id = serializers.IntegerField(required=False, write_only=True)
    
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if hasattr(instance, 'temp_id'):
            data['temp_id'] = instance.temp_id
        return data


# Этот сериализатор используется только для чтения данных
class EdgeSerializer(serializers.ModelSerializer):
    temp_id = serializers.IntegerField(required=False, write_only=True)
    
    class Meta:
        model = Edge
        fields = '__all__'

    def validate(self, data):
        if data['node1'] == data['node2']:
            raise serializers.ValidationError("Узлы не могут ссылаться сами на себя")
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if hasattr(instance, 'temp_id'):
            data['temp_id'] = instance.temp_id
        
        # Проверяем и устанавливаем значения по умолчанию для style, если он отсутствует
        if not data.get('style'):
            data['style'] = {
                'color': '#1DA1F2',
                'width': 3,
                'lineStyle': 'solid'
            }
        return data


# Сериализатор для обработки ребер при отправке данных с клиента
class EdgeWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    temp_id = serializers.IntegerField(required=False)
    node1 = serializers.IntegerField()
    node2 = serializers.IntegerField()
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    style = serializers.JSONField(required=False)
    
    def validate(self, data):
        if data['node1'] == data['node2']:
            raise serializers.ValidationError("Узлы не могут ссылаться сами на себя")
        
        # Проверяем структуру и значения поля style, если оно есть
        if 'style' in data and data['style']:
            style = data['style']
            if not isinstance(style, dict):
                raise serializers.ValidationError({'style': 'Должно быть объектом JSON'})
            
            # Проверка цвета
            if 'color' in style and not isinstance(style['color'], str):
                raise serializers.ValidationError({'style.color': 'Должен быть строкой'})
            
            # Проверка ширины
            if 'width' in style:
                try:
                    width = int(style['width'])
                    if not (1 <= width <= 10):
                        raise serializers.ValidationError({'style.width': 'Должен быть числом от 1 до 10'})
                except (ValueError, TypeError):
                    raise serializers.ValidationError({'style.width': 'Должен быть числом'})
            
            # Проверка стиля линии
            if 'lineStyle' in style and style['lineStyle'] not in ['solid', 'dashed', 'dotted']:
                raise serializers.ValidationError({
                    'style.lineStyle': 'Должен быть одним из: solid, dashed, dotted'
                })
        
        return data


class MapSerializer(serializers.ModelSerializer):
    # Явно объявляем title как обязательное поле
    title = serializers.CharField(max_length=100, required=True, allow_null=False, allow_blank=False)
    nodes = NodeSerializer(many=True, required=False)
    # Используем EdgeSerializer только для чтения 
    edges = EdgeSerializer(many=True, read_only=True)
    # А этот сериализатор для записи
    edges_data = EdgeWriteSerializer(many=True, required=False, write_only=True)
    # Поле для карты соответствия индексов
    client_index_map = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Map
        # Указываем поля явно, чтобы включить title с новыми параметрами
        fields = [
            'id', 'title', 'owner', 'description', 'center_latitude', 
            'center_longitude', 'nodes', 'edges', 'hashtags', 'is_published',
            'created_at', 'updated_at', 'edges_data', 'client_index_map'
            ] 
        read_only_fields = ('owner', 'created_at', 'updated_at', 'edges', 'client_index_map') # Добавили edges и client_index_map

    def get_client_index_map(self, obj):
        """
        Получает маппинг индексов из контекста.
        Возвращает пустой словарь, если маппинг не найден.
        """
        client_index_map = getattr(self, '_client_index_map', None)
        if client_index_map:
            logger = logging.getLogger(__name__)
            logger.debug(f"Возвращаем client_index_map с {len(client_index_map)} элементами")
            return client_index_map
        return {}
    
    def to_representation(self, instance):
        """
        Преобразует объект карты в представление для ответа API.
        Добавляет карту соответствия клиентских и серверных ID узлов, если она была создана.
        """
        ret = super().to_representation(instance)
        if hasattr(self, '_client_index_map') and self._client_index_map:
            index_to_id_map = {}
            logger = logging.getLogger(__name__)
            logger.debug(f"Подготовка client_index_map для ответа, размер: {len(self._client_index_map)}")
            for index, node in self._client_index_map.items():
                str_index = str(index)
                if hasattr(node, 'id'):
                    node_id = node.id
                elif isinstance(node, int):
                    node_id = node
                else:
                    logger.warning(f"Пропуск значения {node} для индекса {index} - неизвестный тип {type(node)}")
                    continue
                index_to_id_map[str_index] = node_id
                logger.debug(f"Добавление в client_index_map: {index} (тип: {type(index).__name__}) -> {node_id}")
            logger.info(f"Отправка client_index_map в ответе, количество записей: {len(index_to_id_map)}")
            ret['client_index_map'] = index_to_id_map
        return ret

    def to_internal_value(self, data):
        """
        Преобразует входные данные запроса во внутренний формат Python.
        Обрабатывает поля для PATCH-обновлений и преобразует 'edges' в 'edges_data'.
        """
        logger = logging.getLogger(__name__)
        logger.debug(f"to_internal_value получил данные: {data}")
        processed_data = data.copy()
        if 'edges' in processed_data:
            processed_data['edges_data'] = processed_data.pop('edges')
        patch_fields = ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                      'new_edges', 'changed_edges', 'deleted_edge_ids']
        for field in patch_fields:
            if field in processed_data:
                logger.debug(f"Обработка поля {field}, тип: {type(processed_data[field])}")
                if isinstance(processed_data[field], str):
                    try:
                        import json
                        processed_data[field] = json.loads(processed_data[field])
                        logger.debug(f"Преобразовано поле {field} из строки JSON: {processed_data[field]}")
                    except Exception as e:
                        logger.error(f"Ошибка при преобразовании JSON для поля {field}: {str(e)}")
                if field in ['new_edges', 'changed_edges'] and isinstance(processed_data[field], list):
                    for i, edge_data in enumerate(processed_data[field]):
                        if isinstance(edge_data, dict):
                            if 'node1' in edge_data and isinstance(edge_data['node1'], str) and edge_data['node1'].isdigit():
                                edge_data['node1'] = int(edge_data['node1'])
                            if 'node2' in edge_data and isinstance(edge_data['node2'], str) and edge_data['node2'].isdigit():
                                edge_data['node2'] = int(edge_data['node2'])
                            logger.debug(f"Преобразованы ID узлов в ребре {i}: {edge_data}")
        result = super().to_internal_value(processed_data)
        for field in patch_fields:
            if field in processed_data and field not in result:
                result[field] = processed_data[field]
                logger.debug(f"Добавлено поле {field} в validated_data: {result[field]}")
        return result

    def update(self, instance, validated_data):
        """
        Обрабатывает обновление существующего объекта карты (только PATCH).
        Извлекает поля для PATCH из контекста запроса, если они не прошли стандартную валидацию.
        Вызывает _handle_patch_update для выполнения обновления.
        """
        logger = logging.getLogger(__name__)
        logger.info(f"Обновление карты ID: {instance.id}")
        logger.debug(f"Входящие данные: {validated_data}")
        try:
            request_data = None
            if 'request' in self.context:
                request_data = self.context['request'].data
                logger.debug(f"Исходные данные запроса: {request_data}")
                for field in ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                            'new_edges', 'changed_edges', 'deleted_edge_ids']:
                    if field in request_data and field not in validated_data:
                        logger.info(f"Добавление поля {field} из исходных данных запроса")
                        validated_data[field] = request_data[field]
            return self._handle_patch_update(instance, validated_data)
        except Exception as e:
            logger.exception(f"Ошибка при обновлении карты: {str(e)}")
            raise serializers.ValidationError(f"Ошибка при обновлении карты: {str(e)}")

    def _handle_patch_update(self, instance, validated_data):
        """
        Выполняет логику PATCH-обновления для карты.
        Обновляет основные поля, удаляет/добавляет/изменяет узлы и ребра.
        Создает карту соответствия временных и постоянных ID для ответа.
        """
        logger = logging.getLogger(__name__)
        logger.info(f"Обработка PATCH-запроса для карты ID: {instance.id}")
        client_to_db_id_map = {}
        for attr, value in validated_data.items():
            if attr not in ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                        'new_edges', 'changed_edges', 'deleted_edge_ids', 'nodes', 'edges_data']:
                logger.debug(f"Обновление основного поля {attr}: {value}")
                setattr(instance, attr, value)
        instance.save()
        existing_nodes = {str(node.id): node for node in instance.nodes.all()}
        existing_edges = {str(edge.id): edge for edge in instance.edges.all()}
        deleted_node_ids = validated_data.get('deleted_node_ids', [])
        if deleted_node_ids:
            logger.info(f"Удаление {len(deleted_node_ids)} узлов: {deleted_node_ids}")
            for node_id in deleted_node_ids:
                node_id_str = str(node_id)
                if node_id_str in existing_nodes:
                    node = existing_nodes[node_id_str]
                    node_db_id = node.id
                    related_edges = Edge.objects.filter(node1_id=node_db_id) | Edge.objects.filter(node2_id=node_db_id)
                    for edge in related_edges:
                        if str(edge.id) in existing_edges:
                            logger.debug(f"Удаление связанного ребра ID: {edge.id} при удалении узла ID: {node_id}")
                            instance.edges.remove(edge)
                            del existing_edges[str(edge.id)]
                    logger.debug(f"Удаление узла ID: {node_id}")
                    instance.nodes.remove(node)
                    del existing_nodes[node_id_str]
                else:
                    logger.warning(f"Узел ID {node_id} не найден для удаления")

        new_nodes_data = validated_data.get('new_nodes', [])
        if new_nodes_data:
            logger.info(f"Добавление {len(new_nodes_data)} новых узлов")
            for node_data in new_nodes_data:
                temp_id = node_data.pop('temp_id', None)
                node_serializer = NodeSerializer(data=node_data)
                if node_serializer.is_valid():
                    new_node = node_serializer.save()
                    instance.nodes.add(new_node)
                    if temp_id is not None:
                        client_to_db_id_map[str(temp_id)] = new_node
                    existing_nodes[str(new_node.id)] = new_node
                    logger.debug(f"Добавлен новый узел ID: {new_node.id} (временный ID: {temp_id})")
                else:
                    logger.error(f"Ошибка валидации нового узла: {node_serializer.errors}")
                    raise serializers.ValidationError({'new_nodes': node_serializer.errors})

        changed_nodes_data = validated_data.get('changed_nodes', [])
        if changed_nodes_data:
            logger.info(f"Обновление {len(changed_nodes_data)} узлов")
            for node_data in changed_nodes_data:
                node_id = node_data.get('id')
                if node_id and str(node_id) in existing_nodes:
                    node_instance = existing_nodes[str(node_id)]
                    node_serializer = NodeSerializer(node_instance, data=node_data, partial=True)
                    if node_serializer.is_valid():
                        node_serializer.save()
                        logger.debug(f"Обновлен узел ID: {node_id}")
                    else:
                        logger.error(f"Ошибка валидации измененного узла ID {node_id}: {node_serializer.errors}")
                        raise serializers.ValidationError({'changed_nodes': node_serializer.errors})
                else:
                    logger.warning(f"Узел ID {node_id} не найден для обновления")

        deleted_edge_ids = validated_data.get('deleted_edge_ids', [])
        if deleted_edge_ids:
            logger.info(f"Удаление {len(deleted_edge_ids)} ребер: {deleted_edge_ids}")
            for edge_id in deleted_edge_ids:
                edge_id_str = str(edge_id)
                if edge_id_str in existing_edges:
                    edge = existing_edges[edge_id_str]
                    instance.edges.remove(edge)
                    del existing_edges[edge_id_str]
                    logger.debug(f"Удалено ребро ID: {edge_id}")
                else:
                    logger.warning(f"Ребро ID {edge_id} не найдено для удаления")

        new_edges_data = validated_data.get('new_edges', [])
        if new_edges_data:
            logger.info(f"Добавление {len(new_edges_data)} новых ребер")
            for edge_data in new_edges_data:
                node1_ref = edge_data.get('node1')
                node2_ref = edge_data.get('node2')
                node1_id = client_to_db_id_map.get(str(node1_ref), node1_ref) if str(node1_ref) in client_to_db_id_map else node1_ref
                node2_id = client_to_db_id_map.get(str(node2_ref), node2_ref) if str(node2_ref) in client_to_db_id_map else node2_ref
                
                if str(node1_id) in existing_nodes and str(node2_id) in existing_nodes:
                    edge_payload = {
                        'node1': existing_nodes[str(node1_id)].id,
                        'node2': existing_nodes[str(node2_id)].id,
                        'description': edge_data.get('description', ''),
                        'style': edge_data.get('style', {
                            'color': '#1DA1F2',
                            'width': 3,
                            'lineStyle': 'solid'
                        })
                    }
                    edge_serializer = EdgeSerializer(data=edge_payload)
                    if edge_serializer.is_valid():
                        new_edge = edge_serializer.save()
                        instance.edges.add(new_edge)
                        existing_edges[str(new_edge.id)] = new_edge
                        logger.debug(f"Добавлено новое ребро ID: {new_edge.id} между узлами {node1_id} и {node2_id}")
                    else:
                        logger.error(f"Ошибка валидации нового ребра: {edge_serializer.errors}")
                        raise serializers.ValidationError({'new_edges': edge_serializer.errors})
                else:
                    logger.warning(f"Один или оба узла ({node1_id}, {node2_id}) не найдены для создания нового ребра")

        changed_edges_data = validated_data.get('changed_edges', [])
        if changed_edges_data:
            logger.info(f"Обновление {len(changed_edges_data)} ребер")
            for edge_data in changed_edges_data:
                edge_id = edge_data.get('id')
                if edge_id and str(edge_id) in existing_edges:
                    edge_instance = existing_edges[str(edge_id)]
                    edge_serializer = EdgeSerializer(edge_instance, data=edge_data, partial=True)
                    if edge_serializer.is_valid():
                        edge_serializer.save()
                        logger.debug(f"Обновлено ребро ID: {edge_id}")
                    else:
                        logger.error(f"Ошибка валидации измененного ребра ID {edge_id}: {edge_serializer.errors}")
                        raise serializers.ValidationError({'changed_edges': edge_serializer.errors})
                else:
                    logger.warning(f"Ребро ID {edge_id} не найдено для обновления")

        instance.save()
        self._client_index_map = client_to_db_id_map
        logger.info(f"Обновление карты ID: {instance.id} завершено")
        return instance