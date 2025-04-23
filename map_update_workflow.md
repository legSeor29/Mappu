# Процесс обновления карты

Этот документ детально описывает последовательность выполнения кода при нажатии кнопки "Сохранить изменения" на странице редактирования карты.

## Общая схема процесса

1. **Клиент** → отправляет запрос на обновление карты
2. **Сервер** → обрабатывает запрос через `MapDetailAPI`
3. **Сериализатор** → валидирует и преобразует данные
4. **База данных** → обновляется информация о карте, узлах и ребрах
5. **Сервер** → отправляет ответ с обновленными данными
6. **Клиент** → отображает обновленную карту

## Поддержка двух типов запросов

Система поддерживает два типа запросов на обновление карты:

1. **PUT-запрос** - полное обновление карты (все данные отправляются)
2. **PATCH-запрос** - частичное обновление карты (только измененные данные)

## Детальное описание процесса

### 1. Клиент отправляет запрос

#### 1.1 Полное обновление (PUT)

Когда пользователь нажимает кнопку "Сохранить изменения" выполняется `Controller.UpdateData()`:

```javascript
// MainApp/static/JS/edit_map.js
UpdateData() {
    const dataToSend = {
        nodes: Object.values(nodes).map(node => ({
            id: node.id,
            longitude: node.coordinates[0],
            latitude: node.coordinates[1],
            name: node.name || '',
            description: node.description || '',
            z_coordinate: node.z_coordinate || 0
        })),
        edges: Object.values(edges).map(edge => ({
            id: edge.id,
            node1: edge.node1.id,
            node2: edge.node2.id
        }))
    };

    console.log('Отправляемые данные:', JSON.stringify(dataToSend, null, 2));

    fetch(`/api/v1/maps/${mapId}/`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
        },
        body: JSON.stringify(dataToSend)
    })
    .then(response => {
        if (!response.ok) {
            console.error('Ошибка HTTP:', response.status);
            return response.text().then(text => {
                throw new Error(`Ошибка обновления данных: ${text}`);
            });
        }
        return response.json();
    })
    .then(updatedData => {
        console.log('Данные успешно обновлены:', updatedData);
        
        // Обновляем ID узлов и ребер после сохранения на сервере
        this.updateLocalIdsAfterSave(updatedData);
        
        alert('Карта успешно сохранена!');
    })
    .catch(error => {
        console.error('Ошибка при обновлении:', error);
        alert('Ошибка при сохранении карты: ' + error.message);
    });
}
```

При этом отправляются:
- Все узлы (`nodes`) со всеми их свойствами
- Все ребра (`edges`) с указанием ID и связанных узлов

#### 1.2 Частичное обновление (PATCH)

Для частичного обновления используется PATCH-запрос, который отправляет только измененные данные:

```javascript
// Пример клиентского кода для PATCH-запроса
saveMap() {
    // Создаем объект только с измененными данными
    const mapData = {};
    
    // Добавляем изменения основной информации
    if (mapChanges.infoChanged) {
        mapData.title = document.getElementById('map-title').value;
        mapData.description = document.getElementById('map-description').value;
    }
    
    // Добавляем новые узлы
    if (mapChanges.newNodes.length > 0) {
        mapData.new_nodes = mapChanges.newNodes.map(node => ({
            name: node.name || '',
            longitude: node.coordinates[0],
            latitude: node.coordinates[1],
            description: node.description || '',
            z_coordinate: node.z_coordinate || 0
        }));
    }
    
    // Добавляем измененные узлы
    if (Object.keys(mapChanges.changedNodes).length > 0) {
        mapData.changed_nodes = Object.entries(mapChanges.changedNodes).map(([id, node]) => ({
            id: parseInt(id),
            name: node.name || '',
            longitude: node.coordinates[0],
            latitude: node.coordinates[1],
            description: node.description || '',
            z_coordinate: node.z_coordinate || 0
        }));
    }
    
    // Добавляем ID удаленных узлов
    if (mapChanges.deletedNodeIds.length > 0) {
        mapData.deleted_node_ids = mapChanges.deletedNodeIds;
    }
    
    // Аналогично для ребер...
    
    fetch(`/api/v1/maps/${mapId}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        },
        body: JSON.stringify(mapData)
    })
    .then(/* аналогичная обработка ответа */)
}
```

Особенности PATCH-запроса:
- Включает только измененные данные
- Разделяет новые, измененные и удаленные объекты
- Более эффективен при небольших изменениях на большой карте

### 2. Сервер принимает запрос через MapDetailAPI

```python
# MainApp/views.py
class MapDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = Map.objects.all()
    serializer_class = MapSerializer
    permission_classes = [IsMapOwner]

    def update(self, request, *args, **kwargs):
        try:
            # Получаем объект карты из базы данных
            instance = self.get_object()
            logger.info(f"Запрос на обновление карты ID: {instance.id}")
            
            # Проверяем права доступа
            if instance.owner != request.user:
                logger.warning(f"Отказ в доступе: пользователь {request.user} пытается редактировать карту пользователя {instance.owner}")
                raise PermissionDenied("Вы не можете изменять эту карту")
            
            # Частичное обновление (PATCH) или полное (PUT)
            partial = kwargs.pop('partial', False)
            
            # Создаем сериализатор и передаем ему данные
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            
            # Валидируем данные
            if not serializer.is_valid():
                logger.error(f"Ошибка валидации: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            # Обновляем объект
            self.perform_update(serializer)
            logger.info(f"Карта ID: {instance.id} успешно обновлена")
            
            # Возвращаем обновленные данные
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception("Ошибка при обновлении карты")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
```

В этом процессе происходит:
- Получение объекта карты из базы данных
- Проверка, что текущий пользователь - владелец карты
- Определение типа запроса (PUT или PATCH)
- Передача данных сериализатору для валидации
- Сохранение изменений через сериализатор
- Возврат обновленных данных клиенту

### 3. Обработка данных в сериализаторе

Сериализатор обрабатывает данные в зависимости от типа запроса:

```python
# MainApp/serializers.py
class MapSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, required=False)
    edges = EdgeSerializer(many=True, read_only=True)
    edges_data = EdgeWriteSerializer(many=True, required=False, write_only=True)
    
    # Поля для PATCH-запроса
    new_nodes = SimpleNodeSerializer(many=True, required=False, write_only=True)
    changed_nodes = NodePatchSerializer(many=True, required=False, write_only=True)
    deleted_node_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)
    new_edges = SimpleEdgeSerializer(many=True, required=False, write_only=True)
    changed_edges = EdgePatchSerializer(many=True, required=False, write_only=True)
    deleted_edge_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    class Meta:
        model = Map
        fields = '__all__'
        read_only_fields = ('owner',)
```

#### 3.1 Преобразование входящих данных

```python
def to_internal_value(self, data):
    # Логируем данные как они приходят от клиента
    logger.debug(f"Оригинальные данные от клиента: {data}")
    
    # Преобразуем edges в edges_data для обработки
    # Это нужно, потому что клиент отправляет поле 'edges',
    # но для внутренней обработки используется 'edges_data'
    if 'edges' in data:
        data['edges_data'] = data.pop('edges')
    return super().to_internal_value(data)
```

Этот метод:
- Перехватывает входящие данные до валидации
- Преобразует поле `edges` в `edges_data` для внутренней обработки
- Возвращает данные базовому классу для дальнейшей валидации

#### 3.2 Обновление объекта карты

```python
def update(self, instance, validated_data):
    logger.info(f"Обновление карты ID: {instance.id}")
    logger.debug(f"Входящие данные: {validated_data}")
    
    try:
        # Определяем, является ли запрос частичным (PATCH) или полным (PUT)
        is_partial = self.context['request'].method == 'PATCH'
        
        if is_partial:
            # Обрабатываем PATCH-запрос с частичными данными
            return self._handle_patch_update(instance, validated_data)
        else:
            # Обрабатываем PUT-запрос с полными данными
            return self._handle_full_update(instance, validated_data)
    except Exception as e:
        logger.exception(f"Ошибка при обновлении карты: {str(e)}")
        raise serializers.ValidationError(f"Ошибка при обновлении карты: {str(e)}")
```

Сериализатор определяет тип запроса и вызывает соответствующий метод для обработки данных.

### 4. Обработка PUT-запроса (полное обновление)

```python
def _handle_full_update(self, instance, validated_data):
    # 1. Извлекаем вложенные данные
    nodes_data = validated_data.pop('nodes', [])
    edges_data = validated_data.pop('edges_data', [])
    logger.info(f"Получено узлов: {len(nodes_data)}, ребер: {len(edges_data)}")
    
    # 2. Обновляем основные поля карты (например, title, description)
    for attr, value in validated_data.items():
        setattr(instance, attr, value)
    instance.save()
    
    # Создаем словари для текущих объектов в БД
    existing_nodes_dict = {str(node.id): node for node in instance.nodes.all()}
    logger.debug(f"Существующие узлы: {[n.id for n in instance.nodes.all()]}")

    # Сохраняем список существующих ID узлов для последующего удаления отсутствующих
    existing_node_ids = set(existing_nodes_dict.keys())

    # Готовим словари для отслеживания узлов
    temp_to_perm_id_map = {}  # Соответствие временных ID и постоянных ID
    processed_node_ids = set()  # Обработанные узлы
    position_to_node_map = {}  # Соответствие координат и узлов
    input_nodes = []  # Сохраняем все узлы, которые будут использоваться на карте

    # Сохраняем привязку клиентских индексов к узлам
    client_index_to_node = {}  # Будем хранить связь индекса на клиенте и узла в БД
    
    # Цикл обработки узлов
    for i, node_data in enumerate(nodes_data):
        try:
            # Проверяем, есть ли ID у узла
            temp_node_id = str(node_data.get('id')) if node_data.get('id') is not None else None
            logger.debug(f"Обработка узла с ID: {temp_node_id}, индекс: {i}")
            
            # Создаем ключ по координатам для поиска узлов
            coord_key = f"{node_data.get('longitude')}_{node_data.get('latitude')}"
            
            if temp_node_id and temp_node_id in existing_nodes_dict:
                # Обновляем существующий узел
                node = existing_nodes_dict[temp_node_id]
                for attr, value in node_data.items():
                    if attr != 'id':
                        setattr(node, attr, value)
                node.save()

                # Сохраняем информацию об узле
                temp_to_perm_id_map[temp_node_id] = temp_node_id
                processed_node_ids.add(temp_node_id)
                position_to_node_map[coord_key] = node
                input_nodes.append(node)

                # Сохраняем привязку индекса к узлу
                client_index_to_node[i] = node
                client_index_to_node[int(temp_node_id) if temp_node_id.isdigit() else i] = node

                logger.info(f"Обновлен узел ID: {temp_node_id}, индекс: {i}")
            else:
                # Дальнейшая обработка узла (поиск по координатам или создание нового)
                # ...
        except Exception as e:
            logger.error(f"Ошибка при обработке узла: {str(e)}")
            raise serializers.ValidationError(f"Ошибка при обработке узла: {str(e)}")
            
    # Далее идет обработка ребер с использованием client_index_to_node
    # ...
```

В методе `_handle_full_update`:
- Извлекаются вложенные данные о узлах и ребрах
- Обновляются основные поля карты
- Создается словарь `client_index_to_node` для хранения связи между индексом узла и самим узлом
- Обрабатываются все узлы с сохранением информации в `client_index_to_node`
- Обрабатываются ребра с использованием `client_index_to_node` для поиска узлов

### 5. Обработка PATCH-запроса (частичное обновление)

```python
def _handle_patch_update(self, instance, validated_data):
    logger.info(f"Обработка PATCH-запроса для карты ID: {instance.id}")
    
    # Обновляем основные поля карты, если они предоставлены
    for attr, value in validated_data.items():
        if attr not in ['new_nodes', 'changed_nodes', 'deleted_node_ids', 
                       'new_edges', 'changed_edges', 'deleted_edge_ids']:
            setattr(instance, attr, value)
    instance.save()
    
    # Готовим словарь для отслеживания узлов
    client_index_to_node = {}
    existing_nodes = {str(node.id): node for node in instance.nodes.all()}
    
    # 1. Обрабатываем измененные узлы
    changed_nodes = validated_data.get('changed_nodes', [])
    logger.info(f"Обработка {len(changed_nodes)} измененных узлов")
    
    for node_data in changed_nodes:
        node_id = str(node_data.get('id'))
        if node_id in existing_nodes:
            node = existing_nodes[node_id]
            for attr, value in node_data.items():
                if attr != 'id':
                    setattr(node, attr, value)
            node.save()
            logger.info(f"Обновлен узел ID: {node_id}")
    
    # 2. Создаем новые узлы
    new_nodes = validated_data.get('new_nodes', [])
    logger.info(f"Создание {len(new_nodes)} новых узлов")
    
    created_nodes = []
    for i, node_data in enumerate(new_nodes):
        new_node = Node.objects.create(
            name=node_data.get('name', ''),
            latitude=node_data.get('latitude'),
            longitude=node_data.get('longitude'),
            description=node_data.get('description', ''),
            z_coordinate=node_data.get('z_coordinate', 0)
        )
        instance.nodes.add(new_node)
        created_nodes.append(new_node)
        
        # Сохраняем привязку индекса к узлу
        client_index_to_node[i] = new_node
        logger.info(f"Создан новый узел ID: {new_node.id}, индекс: {i}")
    
    # 3. Удаляем узлы
    deleted_node_ids = validated_data.get('deleted_node_ids', [])
    logger.info(f"Удаление {len(deleted_node_ids)} узлов")
    
    for node_id in deleted_node_ids:
        node_id_str = str(node_id)
        if node_id_str in existing_nodes:
            node = existing_nodes[node_id_str]
            
            # Удаляем связанные ребра
            related_edges = Edge.objects.filter(Q(node1=node) | Q(node2=node), maps=instance)
            for edge in related_edges:
                instance.edges.remove(edge)
                if edge.maps.count() == 0:
                    edge.delete()
                    logger.info(f"Удалено связанное ребро ID: {edge.id}")
            
            # Удаляем узел
            instance.nodes.remove(node)
            if node.maps.count() == 0:
                node.delete()
                logger.info(f"Удален узел ID: {node_id}")
    
    # Аналогично обрабатываем ребра с использованием client_index_to_node
    # ...
```

В методе `_handle_patch_update`:
- Обрабатываются только предоставленные данные
- По отдельности обрабатываются измененные, новые и удаленные узлы
- Для новых узлов создается соответствие индексов в `client_index_to_node`
- Аналогично обрабатываются ребра с использованием индексов из `client_index_to_node`

### 6. Поиск узлов для ребер

```python
# 1. Пробуем найти по индексу в нашем маппинге
if start_index_str != "None" and start_index_str.isdigit():
    start_idx = int(start_index_str)
    if start_idx in client_index_to_node:
        start_node = client_index_to_node[start_idx]
        logger.debug(f"Найден начальный узел по индексу {start_idx}: {start_node.id}")

# Аналогично для end_node
```

Поиск узлов для ребер теперь использует словарь `client_index_to_node`, что значительно упрощает сопоставление узлов и ребер.

### 7. Клиентская обработка ответа

После получения ответа от сервера клиент обновляет ID объектов:

```javascript
updateLocalIdsAfterSave(serverData) {
    console.log('Данные с сервера для обновления ID:', serverData);
    
    // Создаем карту соответствия между старыми и новыми ID узлов
    const nodeIdMap = {};
    
    // Собираем текущие узлы с данными для сравнения
    const localNodeMap = {};
    Object.values(nodes).forEach(node => {
        const key = `${node.longitude}_${node.latitude}`;
        localNodeMap[key] = node;
    });
    
    // Обновляем ID узлов и создаем карту соответствия
    if (serverData.nodes && serverData.nodes.length > 0) {
        serverData.nodes.forEach(serverNode => {
            const key = `${serverNode.longitude}_${serverNode.latitude}`;
            const localNode = localNodeMap[key];
            
            if (localNode && localNode.id !== serverNode.id) {
                console.log(`Обновление ID узла: ${localNode.id} -> ${serverNode.id}`);
                nodeIdMap[localNode.id] = serverNode.id;
                localNode.id = serverNode.id;
            }
        });
    }
    
    // Обновляем ID ребер и связи с узлами
    // ...
}
```

## Преимущества нового подхода

### 1. Эффективная обработка клиентских индексов

Использование словаря `client_index_to_node` значительно упрощает сопоставление узлов и ребер. Теперь для каждого узла сохраняется его индекс в массиве, что позволяет быстро находить узел по индексу.

### 2. Поддержка частичных обновлений

PATCH-запросы позволяют отправлять только измененные данные, что значительно уменьшает объем передаваемых данных и нагрузку на сервер при работе с большими картами.

### 3. Разделение логики

Разделение обработки на методы `_handle_full_update` и `_handle_patch_update` делает код более поддерживаемым и понятным.

## Советы по отладке

1. Логирование клиентских индексов и ID:
```python
logger.debug(f"Обработка узла с ID: {temp_node_id}, индекс: {i}")
logger.debug(f"client_index_to_node: {client_index_to_node}")
```

2. Проверка соответствия узлов и ребер:
```python
for edge in edges_data:
    node1_idx = edge.get('node1')
    node2_idx = edge.get('node2')
    logger.debug(f"Ребро: node1={node1_idx} ({node1_idx in client_index_to_node}), node2={node2_idx} ({node2_idx in client_index_to_node})")
```

3. Проверка данных PATCH-запроса:
```python
def patch_data_validator(request, *args, **kwargs):
    data = request.data
    response = {
        "valid": True,
        "data": {
            "new_nodes": len(data.get('new_nodes', [])),
            "changed_nodes": len(data.get('changed_nodes', [])),
            "deleted_node_ids": len(data.get('deleted_node_ids', [])),
            "new_edges": len(data.get('new_edges', [])),
            "changed_edges": len(data.get('changed_edges', [])),
            "deleted_edge_ids": len(data.get('deleted_edge_ids', []))
        }
    }
    return Response(response)
``` 