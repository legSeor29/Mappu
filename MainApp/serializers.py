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
        return data


# Сериализатор для обработки ребер при отправке данных с клиента
class EdgeWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    temp_id = serializers.IntegerField(required=False)
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
    # Поле для карты соответствия индексов
    client_index_map = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Map
        fields = '__all__'
        read_only_fields = ('owner',)

    def get_client_index_map(self, obj):
        """
        Получает маппинг индексов из контекста.
        Возвращает пустой словарь, если маппинг не найден.
        """
        # Безопасно получаем маппинг индексов
        client_index_map = getattr(self, '_client_index_map', None)
        
        # Если маппинг существует и не пустой, возвращаем его
        if client_index_map:
            logger = logging.getLogger(__name__)
            logger.debug(f"Возвращаем client_index_map с {len(client_index_map)} элементами")
            return client_index_map
        
        # Если маппинг не существует или пустой, возвращаем пустой словарь
        return {}
    
    def to_representation(self, instance):
        # Стандартное представление
        ret = super().to_representation(instance)
        # Добавляем карту индексов, если она существует
        if hasattr(self, '_client_index_map') and self._client_index_map:
            # Преобразуем объекты Node в их ID для сериализации
            index_to_id_map = {}
            logger = logging.getLogger(__name__)
            logger.debug(f"Подготовка client_index_map для ответа, размер: {len(self._client_index_map)}")
            
            for index, node in self._client_index_map.items():
                # Приводим индекс к строке для использования в JSON
                str_index = str(index)
                
                # Проверяем тип node и получаем ID соответствующим образом
                if hasattr(node, 'id'):  # Если это объект Node
                    node_id = node.id
                elif isinstance(node, int):  # Если это уже ID
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
        Преобразует данные запроса во внутренний формат.
        """
        logger = logging.getLogger(__name__)
        logger.debug(f"to_internal_value получил данные: {data}")
        
        # Копируем данные, чтобы не менять входящий объект
        processed_data = data.copy()
        
        # Преобразуем edges в edges_data для обработки
        if 'edges' in processed_data:
            processed_data['edges_data'] = processed_data.pop('edges')
        
        # Обработка PATCH полей
        patch_fields = ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                      'new_edges', 'changed_edges', 'deleted_edge_ids']
        
        # Проверяем наличие этих полей и их формат
        for field in patch_fields:
            if field in processed_data:
                logger.debug(f"Обработка поля {field}, тип: {type(processed_data[field])}")
                
                # Убедимся, что поле корректно преобразовано из JSON, если это строка
                if isinstance(processed_data[field], str):
                    try:
                        import json
                        processed_data[field] = json.loads(processed_data[field])
                        logger.debug(f"Преобразовано поле {field} из строки JSON: {processed_data[field]}")
                    except Exception as e:
                        logger.error(f"Ошибка при преобразовании JSON для поля {field}: {str(e)}")
                
                # Дополнительная валидация для полей с узлами и рёбрами
                if field in ['new_edges', 'changed_edges'] and isinstance(processed_data[field], list):
                    for i, edge_data in enumerate(processed_data[field]):
                        if isinstance(edge_data, dict):
                            # Преобразуем ID узлов в целые числа, если они строки
                            if 'node1' in edge_data and isinstance(edge_data['node1'], str) and edge_data['node1'].isdigit():
                                edge_data['node1'] = int(edge_data['node1'])
                            if 'node2' in edge_data and isinstance(edge_data['node2'], str) and edge_data['node2'].isdigit():
                                edge_data['node2'] = int(edge_data['node2'])
                            logger.debug(f"Преобразованы ID узлов в ребре {i}: {edge_data}")
        
        # Вызываем родительский метод
        result = super().to_internal_value(processed_data)
        
        # Добавляем поля PATCH в результат
        for field in patch_fields:
            if field in processed_data and field not in result:
                result[field] = processed_data[field]
                logger.debug(f"Добавлено поле {field} в validated_data: {result[field]}")
        
        return result

    def update(self, instance, validated_data):
        """
        Обработка запросов на обновление карты.
        Так как мы отключили PUT, все запросы являются PATCH.
        """
        logger = logging.getLogger(__name__)
        logger.info(f"Обновление карты ID: {instance.id}")
        logger.debug(f"Входящие данные: {validated_data}")
        
        try:
            # Если какие-то поля не попали в validated_data, проверим оригинальный запрос
            request_data = None
            if 'request' in self.context:
                request_data = self.context['request'].data
                logger.debug(f"Исходные данные запроса: {request_data}")
                
                # Проверяем, есть ли поля в request_data, которых нет в validated_data
                for field in ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                            'new_edges', 'changed_edges', 'deleted_edge_ids']:
                    if field in request_data and field not in validated_data:
                        logger.info(f"Добавление поля {field} из исходных данных запроса")
                        validated_data[field] = request_data[field]
            
            # Обрабатываем PATCH-запрос с частичными данными
            return self._handle_patch_update(instance, validated_data)
        except Exception as e:
            logger.exception(f"Ошибка при обновлении карты: {str(e)}")
            raise serializers.ValidationError(f"Ошибка при обновлении карты: {str(e)}")

    def _handle_patch_update(self, instance, validated_data):
        """
        Обработка PATCH-запроса для карты.
        Более строгая логика для предотвращения дублирования и ошибок.
        """
        logger = logging.getLogger(__name__)
        logger.info(f"Обработка PATCH-запроса для карты ID: {instance.id}")
        
        # Словарь для соответствия временных и постоянных ID
        client_to_db_id_map = {}
        
        # 1. Обновляем основные поля карты, если они предоставлены
        for attr, value in validated_data.items():
            if attr not in ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                        'new_edges', 'changed_edges', 'deleted_edge_ids', 'nodes', 'edges_data']:
                logger.debug(f"Обновление основного поля {attr}: {value}")
                setattr(instance, attr, value)
        instance.save()
        
        # Получаем существующие узлы и рёбра
        existing_nodes = {str(node.id): node for node in instance.nodes.all()}
        existing_edges = {str(edge.id): edge for edge in instance.edges.all()}
        
        # 2. Удаляем указанные узлы
        deleted_node_ids = validated_data.get('deleted_node_ids', [])
        if deleted_node_ids:
            logger.info(f"Удаление {len(deleted_node_ids)} узлов: {deleted_node_ids}")
            
            for node_id in deleted_node_ids:
                node_id_str = str(node_id)
                
                if node_id_str in existing_nodes:
                    node = existing_nodes[node_id_str]
                    
                    # Удаляем связанные рёбра
                    # Получаем ID узла вместо объекта для использования в фильтре
                    node_db_id = node.id
                    related_edges = Edge.objects.filter(
                        node1_id=node_db_id
                    ) | Edge.objects.filter(
                        node2_id=node_db_id
                    )
                    
                    for edge in related_edges:
                        if edge in instance.edges.all():
                            instance.edges.remove(edge)
                            logger.info(f"Удалено ребро ID: {edge.id} из карты")
                        
                        # Если ребро больше не привязано ни к какой карте, удаляем его
                        if edge.maps.count() == 0:
                            edge.delete()
                            logger.info(f"Удалено ребро ID: {edge.id} из базы данных")
                    
                    # Удаляем узел из карты
                    instance.nodes.remove(node)
                    logger.info(f"Удален узел ID: {node.id} из карты")
                    
                    # Если узел больше не привязан ни к какой карте, удаляем его
                    if node.maps.count() == 0:
                        node.delete()
                        logger.info(f"Удален узел ID: {node.id} из базы данных")
                else:
                    logger.warning(f"Узел ID: {node_id} не найден для удаления")
        
        # 3. Обрабатываем измененные узлы
        changed_nodes = validated_data.get('changed_nodes', [])
        if changed_nodes:
            logger.info(f"Обновление {len(changed_nodes)} узлов")
            
            for node_data in changed_nodes:
                node_id = str(node_data.get('id'))
                
                if node_id in existing_nodes:
                    node = existing_nodes[node_id]
                    
                    # Обновляем атрибуты узла
                    for attr, value in node_data.items():
                        if attr != 'id':
                            setattr(node, attr, value)
                    
                    node.save()
                    logger.info(f"Обновлен узел ID: {node.id}")
                    
                    # Добавляем в маппинг
                    # Используем строковый ключ для соответствия
                    client_to_db_id_map[node_id] = node
                    
                    # Также сохраняем целочисленный ключ, если node_id - число в строковом представлении
                    if node_id.isdigit():
                        client_to_db_id_map[int(node_id)] = node
                else:
                    logger.warning(f"Узел ID: {node_id} не найден для обновления")
        
        # 4. Создаем новые узлы
        new_nodes = validated_data.get('new_nodes', [])
        if new_nodes:
            logger.info(f"Создание {len(new_nodes)} новых узлов")
            
            for i, node_data in enumerate(new_nodes):
                # Проверяем, существует ли узел с такими координатами
                latitude = node_data.get('latitude')
                longitude = node_data.get('longitude')
                
                existing_node = Node.objects.filter(
                    latitude=latitude, 
                    longitude=longitude
                ).first()
                
                if existing_node:
                    # Если узел с такими координатами уже существует, добавляем его к карте
                    if existing_node not in instance.nodes.all():
                        instance.nodes.add(existing_node)
                        logger.info(f"Добавлен существующий узел ID: {existing_node.id} к карте")
                    
                    # Добавляем в маппинг
                    # Получаем временный ID, преобразуем в строку если это возможно
                    temp_id = node_data.get('id')
                    if temp_id is None:
                        temp_id = i
                    
                    client_to_db_id_map[str(temp_id)] = existing_node  # Используем строковый ключ
                    client_to_db_id_map[i] = existing_node  # Индекс в массиве
                    logger.debug(f"Сопоставлен временный ID {temp_id} с узлом {existing_node.id}")
                else:
                    # Создаем новый узел
                    new_node = Node.objects.create(
                        name=node_data.get('name', ''),
                        latitude=latitude,
                        longitude=longitude,
                        description=node_data.get('description', ''),
                        z_coordinate=node_data.get('z_coordinate', 0)
                    )
                    
                    # Добавляем к карте
                    instance.nodes.add(new_node)
                    logger.info(f"Создан новый узел ID: {new_node.id}")
                    
                    # Добавляем в маппинг
                    # Получаем временный ID, преобразуем в строку если это возможно
                    temp_id = node_data.get('id')
                    if temp_id is None:
                        temp_id = i
                    
                    client_to_db_id_map[str(temp_id)] = new_node  # Используем строковый ключ
                    client_to_db_id_map[i] = new_node  # Индекс в массиве
                    logger.debug(f"Сопоставлен временный ID {temp_id} с новым узлом {new_node.id}")
                    
        # 5. Удаляем указанные ребра
        deleted_edge_ids = validated_data.get('deleted_edge_ids', [])
        if deleted_edge_ids:
            logger.info(f"Удаление {len(deleted_edge_ids)} ребер: {deleted_edge_ids}")
            
            for edge_id in deleted_edge_ids:
                edge_id_str = str(edge_id)
                
                try:
                    if edge_id_str in existing_edges:
                        edge = existing_edges[edge_id_str]
                        
                        # Удаляем ребро из карты
                        instance.edges.remove(edge)
                        logger.info(f"Удалено ребро ID: {edge.id} из карты")
                        
                        # Если ребро больше не привязано ни к какой карте, удаляем его
                        if edge.maps.count() == 0:
                            edge.delete()
                            logger.info(f"Удалено ребро ID: {edge.id} из базы данных")
                    else:
                        # Пытаемся найти ребро по ID
                        try:
                            edge = Edge.objects.get(id=edge_id)
                            if edge in instance.edges.all():
                                instance.edges.remove(edge)
                                logger.info(f"Удалено ребро ID: {edge.id} из карты (найдено по ID)")
                            
                            # Если ребро больше не привязано ни к какой карте, удаляем его
                            if edge.maps.count() == 0:
                                edge.delete()
                                logger.info(f"Удалено ребро ID: {edge.id} из базы данных")
                        except Edge.DoesNotExist:
                            logger.warning(f"Ребро ID: {edge_id} не найдено в базе данных")
                except Exception as e:
                    logger.error(f"Ошибка при удалении ребра {edge_id}: {str(e)}")
        
        # 6. Создаем новые ребра
        new_edges = validated_data.get('new_edges', [])
        if new_edges:
            logger.info(f"Создание {len(new_edges)} новых ребер")
            
            # Получаем ID узлов, которые были удалены
            deleted_node_ids_set = set(str(node_id) for node_id in deleted_node_ids)
            
            for edge_data in new_edges:
                # Получаем ID узлов
                node1_id = str(edge_data.get('node1'))
                node2_id = str(edge_data.get('node2'))
                
                # Проверяем, не были ли узлы удалены
                if node1_id in deleted_node_ids_set or node2_id in deleted_node_ids_set:
                    logger.info(f"Пропуск создания ребра {node1_id}-{node2_id}, т.к. один из узлов удален")
                    continue
                
                # Ищем узлы
                node1 = None
                node2 = None
                
                # Проверяем в маппинге клиентских ID
                if node1_id in client_to_db_id_map:
                    # Получаем объект узла или его ID из маппинга
                    node1_value = client_to_db_id_map[node1_id]
                    if hasattr(node1_value, 'id'):
                        node1 = node1_value
                    elif isinstance(node1_value, int):
                        # Если у нас только ID, получаем объект из базы
                        try:
                            node1 = Node.objects.get(id=node1_value)
                        except Node.DoesNotExist:
                            logger.warning(f"Узел с ID {node1_value} не найден в базе данных")
                # Проверяем среди существующих узлов
                elif node1_id in existing_nodes:
                    node1 = existing_nodes[node1_id]
                
                # Аналогично для второго узла
                if node2_id in client_to_db_id_map:
                    node2_value = client_to_db_id_map[node2_id]
                    if hasattr(node2_value, 'id'):
                        node2 = node2_value
                    elif isinstance(node2_value, int):
                        try:
                            node2 = Node.objects.get(id=node2_value)
                        except Node.DoesNotExist:
                            logger.warning(f"Узел с ID {node2_value} не найден в базе данных")
                elif node2_id in existing_nodes:
                    node2 = existing_nodes[node2_id]
                
                # Если оба узла найдены
                if node1 and node2:
                    # Проверяем, существует ли уже такое ребро
                    existing_edge = Edge.objects.filter(
                        node1=node1, node2=node2
                    ).first() or Edge.objects.filter(
                        node1=node2, node2=node1
                    ).first()
                    
                    if existing_edge:
                        # Если ребро существует, добавляем его к карте
                        if existing_edge not in instance.edges.all():
                            instance.edges.add(existing_edge)
                            logger.info(f"Добавлено существующее ребро ID: {existing_edge.id} к карте")
                    else:
                        # Создаем новое ребро
                        new_edge = Edge.objects.create(node1=node1, node2=node2)
                        instance.edges.add(new_edge)
                        logger.info(f"Создано новое ребро ID: {new_edge.id} между узлами {node1.id} и {node2.id}")
                else:
                    logger.warning(f"Не удалось создать ребро: один или оба узла не найдены. node1_id={node1_id}, node2_id={node2_id}")
        
        # 7. Обновляем карту соответствия индексов для ответа клиенту
        client_index_map = {}
        logger.info(f"Подготовка карты индексов client_index_map")
        
        for key, value in client_to_db_id_map.items():
            if isinstance(key, (int, str)):
                # Извлекаем ID узла из value
                if hasattr(value, 'id'):  # Если value - это объект Node
                    node_id = value.id
                elif isinstance(value, int):  # Если value - это уже ID узла
                    node_id = value
                else:
                    logger.warning(f"Пропуск значения для ключа {key}: неожиданный тип {type(value)}")
                    continue
                
                # Сохраняем в карту соответствия ключ (всегда строка) -> ID узла (всегда int)
                client_index_map[str(key)] = node_id
        
        self._client_index_map = client_index_map
        logger.info(f"Создана карта соответствия индексов клиента и узлов: {client_index_map}")
        
        # Обновляем данные экземпляра
        instance.refresh_from_db()
        
        return instance