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

> **ВАЖНОЕ ОБНОВЛЕНИЕ**: Система теперь использует PATCH-запросы по умолчанию! Это значительно повышает производительность и уменьшает объем передаваемых данных, особенно для больших карт с небольшими изменениями.

## Как работает отслеживание изменений

В клиентском коде реализована система отслеживания изменений, которая автоматически определяет:
- Новые добавленные узлы и ребра
- Измененные существующие узлы и ребра
- Удаленные узлы и ребра

При сохранении карты отправляются только измененные данные, что значительно уменьшает объем трафика и нагрузку на сервер.

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

## Рекомендации по тестированию

При тестировании функциональности "Сохранить изменения" следует уделить особое внимание корректной обработке клиентских индексов и их сопоставлению с узлами в базе данных. Ниже приведены рекомендации по тестированию различных сценариев.

### 1. Тестирование обновления узлов

#### Создание новых узлов с временными ID:
- Создайте несколько новых узлов на клиенте с временными ID (например, "temp_1", "temp_2").
- Нажмите "Сохранить изменения".
- Проверьте, что новые узлы успешно созданы в базе данных с постоянными ID.
- Проверьте обновление ID узлов на клиентской стороне.

#### Обновление существующих узлов:
- Измените атрибуты существующих узлов (имя, координаты).
- Нажмите "Сохранить изменения".
- Проверьте, что изменения корректно применены в базе данных.

#### Смешанное обновление:
- Создайте новые узлы, измените существующие и удалите некоторые узлы.
- Нажмите "Сохранить изменения".
- Проверьте корректность всех операций.

### 2. Тестирование создания ребер

#### Ребра между существующими узлами:
- Создайте ребро между существующими узлами с постоянными ID.
- Нажмите "Сохранить изменения".
- Проверьте создание ребра в базе данных.

#### Ребра между новыми узлами с временными ID:
- Создайте новые узлы с временными ID.
- Создайте ребро между этими узлами.
- Нажмите "Сохранить изменения".
- Проверьте, что ребро корректно создано с правильными связями в базе данных.

#### Смешанные ребра:
- Создайте ребро между существующим узлом и новым узлом с временным ID.
- Нажмите "Сохранить изменения".
- Проверьте корректность создания ребра и связей.

### 3. Тестирование PATCH-запросов

- Проверьте корректную обработку частичных обновлений:
  - Добавление только новых узлов без изменения существующих.
  - Удаление только определенных узлов.
  - Добавление только ребер между существующими узлами.

### 4. Тестирование производительности

- Сравните время выполнения PATCH и PUT запросов для больших карт.
- Проверьте работу с большим объемом данных (сотни узлов и ребер).
- Измерьте потребление памяти на сервере при обработке больших карт.
- Проверьте скорость рендеринга на клиентской стороне после обновления.

## Отслеживание соответствия клиентских индексов и узлов

В последней версии API добавлена расширенная поддержка отслеживания соответствия между клиентскими индексами и узлами в базе данных. Это особенно важно для корректной работы с временными ID, которые создаются на клиенте до сохранения на сервере.

### Как работает отслеживание индексов

1. **Создание словаря соответствия**: 
   При обработке данных создаётся словарь `client_index_to_node`, который содержит пары "индекс клиента -> объект узла":

   ```python
   # Сохраняем привязку клиентских индексов к узлам
   client_index_to_node = {}  # Будем хранить связь индекса на клиенте и узла в БД
   
   # При обработке узлов:
   for i, node_data in enumerate(nodes_data):
       # ...обработка узла...
       
       # Сохраняем привязку индекса к узлу
       client_index_to_node[i] = node
       
       # Дополнительно сохраняем привязку по ID, если он есть
       if temp_node_id:
           client_index_to_node[int(temp_node_id) if temp_node_id.isdigit() else temp_node_id] = node
   ```

2. **Использование при создании ребер**:
   Словарь `client_index_to_node` используется для быстрого поиска узлов по индексам при создании ребер:

   ```python
   for edge_data in edges_data:
       start_index = edge_data.get("node1")
       end_index = edge_data.get("node2")
       
       # Находим узлы по индексам из client_index_to_node
       if start_index in client_index_to_node:
           start_node = client_index_to_node[start_index]
       # ...иначе ищем другими способами...
   ```

3. **Преимущества такого подхода**:
   - Точное сопоставление узлов даже при наличии временных ID
   - Поддержка как числовых, так и строковых идентификаторов
   - Сохранение контекста позиции узла в массиве клиента
   - Повышенная надежность при обработке ребер

### Пример работы с индексами при обновлении

Рассмотрим пример обработки данных карты с узлами и ребрами:

```python
# Входящие данные от клиента
nodes_data = [
    {"id": "temp_1", "name": "Узел 1", "latitude": 55.75, "longitude": 37.61},
    {"id": 2, "name": "Узел 2", "latitude": 55.76, "longitude": 37.62},
    {"name": "Новый узел", "latitude": 55.77, "longitude": 37.63}
]

edges_data = [
    {"node1": "temp_1", "node2": 2},
    {"node1": "temp_1", "node2": 2}
]

# В процессе обработки:
client_index_to_node = {}

# Обработка узлов
for i, node_data in enumerate(nodes_data):
    # ... создаем/обновляем узел ...
    client_index_to_node[i] = node  # Сохраняем по индексу в массиве
    
    # Для первого узла (i=0) также сохраняем по временному ID
    if i == 0:
        client_index_to_node["temp_1"] = node
    
    # Для второго узла (i=1) также сохраняем по ID в БД
    if i == 1:
        client_index_to_node[2] = node

# Результат: client_index_to_node содержит:
# {
#   0: <Node: id=101, name="Узел 1">,  # По индексу в массиве
#   "temp_1": <Node: id=101, name="Узел 1">,  # По временному ID
#   1: <Node: id=2, name="Узел 2">,  # По индексу в массиве
#   2: <Node: id=2, name="Узел 2">,  # По ID в БД
#   2: <Node: id=103, name="Новый узел">  # По индексу в массиве
# }

# Теперь при создании ребер:
for edge_data in edges_data:
    node1_key = edge_data.get("node1")  # "temp_1"
    node2_key = edge_data.get("node2")  # 2
    
    # Легко находим узлы по ключам в словаре
    if node1_key in client_index_to_node and node2_key in client_index_to_node:
        node1 = client_index_to_node[node1_key]  # id=101
        node2 = client_index_to_node[node2_key]  # id=2
        # ...создаем ребро между node1 и node2...
```

### Реализация в разных типах запросов

#### В PUT-запросах:
- Сохраняются все соответствия индексов для всех узлов
- При обработке ребер используются эти индексы

#### В PATCH-запросах:
- Для измененных узлов сохраняются соответствия по ID
- Для новых узлов сохраняются соответствия по индексам в массиве
- Индексы используются при создании новых ребер

## Рекомендации по тестированию

### 1. Тестирование обновления узлов

#### Создание новых узлов с временными ID:
- Создайте несколько новых узлов на клиенте с временными ID (например, "temp_1", "temp_2").
- Нажмите "Сохранить изменения".
- Проверьте, что новые узлы успешно созданы в базе данных с постоянными ID.
- Проверьте обновление ID узлов на клиентской стороне.

#### Обновление существующих узлов:
- Измените атрибуты существующих узлов (имя, координаты).
- Нажмите "Сохранить изменения".
- Проверьте, что изменения корректно применены в базе данных.

#### Смешанное обновление:
- Создайте новые узлы, измените существующие и удалите некоторые узлы.
- Нажмите "Сохранить изменения".
- Проверьте корректность всех операций.

### 2. Тестирование создания ребер

#### Ребра между существующими узлами:
- Создайте ребро между существующими узлами с постоянными ID.
- Нажмите "Сохранить изменения".
- Проверьте создание ребра в базе данных.

#### Ребра между новыми узлами с временными ID:
- Создайте новые узлы с временными ID.
- Создайте ребро между этими узлами.
- Нажмите "Сохранить изменения".
- Проверьте, что ребро корректно создано с правильными связями в базе данных.

#### Смешанные ребра:
- Создайте ребро между существующим узлом и новым узлом с временным ID.
- Нажмите "Сохранить изменения".
- Проверьте корректность создания ребра и связей.

### 3. Тестирование PATCH-запросов

- Проверьте корректную обработку частичных обновлений:
  - Добавление только новых узлов без изменения существующих.
  - Удаление только определенных узлов.
  - Добавление только ребер между существующими узлами.

### 4. Тестирование производительности

- Сравните время выполнения PATCH и PUT запросов для больших карт.
- Проверьте работу с большим объемом данных (сотни узлов и ребер).
- Измерьте потребление памяти на сервере при обработке больших карт.
- Проверьте скорость рендеринга на клиентской стороне после обновления.

## Итоговая схема обработки индексов

```
┌─────────────┐
│  Клиент     │
│  nodes[0]   │───┐
│  nodes[1]   │   │
│  nodes[2]   │   │   PUT/PATCH
└─────────────┘   │   запрос
                  ▼
┌─────────────────────────────┐
│  Сервер                     │
│                             │
│  ┌─────────────────────┐    │
│  │ client_index_to_node│    │
│  │ {                   │    │
│  │   0: <Node:id=101>, │    │
│  │   1: <Node:id=2>,   │    │
│  │   2: <Node:id=103>  │    │
│  │ }                   │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘
           │
           │  Создание ребер
           ▼
┌─────────────────────────────┐
│  База данных                │
│                             │
│  Nodes:                     │
│  - id=101 (бывший temp_1)   │
│  - id=2                     │
│  - id=103 (новый)           │
│                             │
│  Edges:                     │
│  - node1=101, node2=2       │
│  - node1=101, node2=103     │
└─────────────────────────────┘
```

Благодаря такой системе отслеживания индексов, сервер всегда может корректно связать узлы между собой, даже если на клиенте используются временные идентификаторы или происходит сложная манипуляция с узлами и ребрами.

## Реализация PATCH-запросов на клиенте

Для поддержки отправки только изменённых данных, в JavaScript-коде клиента реализован метод `sendPatchRequest()`, который собирает только те данные, которые были изменены с момента последнего сохранения.

### Структура PATCH-запроса

PATCH-запросы содержат следующие поля:

```javascript
{
  // Новые узлы (без ID в базе данных)
  "new_nodes": [
    { "name": "Новый узел", "latitude": 55.75, "longitude": 37.61, ... }
  ],
  
  // Измененные узлы (с ID из базы данных)
  "changed_nodes": [
    { "id": 101, "name": "Обновленный узел", "latitude": 55.76, ... }
  ],
  
  // ID удаленных узлов
  "deleted_node_ids": [102, 103],
  
  // Новые ребра
  "new_edges": [
    { "node1": "temp_1", "node2": 101 }
  ],
  
  // Измененные ребра
  "changed_edges": [
    { "id": 201, "node1": 101, "node2": 104 }
  ],
  
  // ID удаленных ребер
  "deleted_edge_ids": [202, 203]
}
```

### Преимущества PATCH-запросов

1. **Уменьшение объема передаваемых данных**: Отправляются только изменения, а не вся карта
2. **Снижение нагрузки на сервер**: Сервер обрабатывает только те данные, которые изменились
3. **Повышение производительности**: Быстрее обрабатываются большие карты с минимальными изменениями
4. **Уменьшение вероятности конфликтов**: Меньше шансов перезаписать данные, измененные другими пользователями
5. **Точное отслеживание изменений**: Ясно, какие именно объекты были добавлены, изменены или удалены

### Отслеживание изменений на клиенте

Для реализации PATCH-запросов клиент хранит следующие наборы данных:

```javascript
// В классе DatabaseController
constructor() {
    // Наборы для хранения изменений
    this.changes = {
        newNodes: [],            // Новые узлы
        changedNodes: {},        // Измененные узлы (по ID)
        deletedNodeIds: [],      // ID удаленных узлов
        newEdges: [],            // Новые ребра 
        changedEdges: {},        // Измененные ребра (по ID)
        deletedEdgeIds: []       // ID удаленных ребер
    };
    
    // Наборы для хранения начальных ID
    this.initialNodeIds = new Set();  // ID узлов, существующих в БД
    this.initialEdgeIds = new Set();  // ID ребер, существующих в БД
}
```

При внесении изменений в карту клиент отслеживает, какие объекты были добавлены, изменены или удалены и помещает их в соответствующие наборы:

```javascript
// Пример: маркируем узел как измененный
markNodeChanged(node) {
    // Если узел был изначально в БД, добавляем его в измененные
    if (this.initialNodeIds.has(node.id)) {
        this.changes.changedNodes[node.id] = node;
    }
}

// Пример: добавляем новый узел
addNewNode(node) {
    // Если ID узла нет в начальных ID, значит он новый
    if (!this.initialNodeIds.has(node.id)) {
        this.changes.newNodes.push(node);
    }
}

// Пример: маркируем узел как удаленный
markNodeDeleted(nodeId) {
    // Если узел был в БД, добавляем его ID в список удаленных
    if (this.initialNodeIds.has(nodeId)) {
        this.changes.deletedNodeIds.push(nodeId);
    }
}
```

### Интеграция с серверной частью

Благодаря формату PATCH-запроса и механизму `client_index_to_node` на сервере, клиент может эффективно обновлять карту даже при наличии временных ID и сложных связей между объектами. Сервер корректно интерпретирует полученные данные и возвращает обновленную информацию с актуальными ID из базы данных. 

## Обработка PATCH-запросов на сервере

### Структура обработчика

Для PATCH-запросов на сервере используется модифицированный метод `update()` сериализатора, который определяет тип запроса и вызывает соответствующий обработчик:

```python
def update(self, instance, validated_data):
    request = self.context.get('request')
    if request and request.method == 'PATCH':
        return self.partial_update(instance, validated_data)
    else:
        return self.full_update(instance, validated_data)
```

### Обработка частичного обновления (PATCH)

```python
def partial_update(self, instance, validated_data):
    # Получаем данные из PATCH-запроса
    new_nodes = validated_data.get('new_nodes', [])
    changed_nodes = validated_data.get('changed_nodes', [])
    deleted_node_ids = validated_data.get('deleted_node_ids', [])
    new_edges = validated_data.get('new_edges', [])
    changed_edges = validated_data.get('changed_edges', [])
    deleted_edge_ids = validated_data.get('deleted_edge_ids', [])
    
    # Инициализируем словарь для отслеживания индексов клиента
    client_index_to_node = {}
    
    # Обработка новых узлов
    created_nodes = []
    for i, node_data in enumerate(new_nodes):
        node = Node.objects.create(
            map=instance,
            name=node_data.get('name', ''),
            latitude=node_data.get('latitude', 0),
            longitude=node_data.get('longitude', 0),
            # ... другие поля
        )
        # Сохраняем связь между индексом клиента и созданным узлом
        client_index_to_node[i] = node
        created_nodes.append(node)
        logging.info(f"Created new node: ID={node.id} from client index {i}")
    
    # Обработка измененных узлов
    updated_nodes = []
    for i, node_data in enumerate(changed_nodes):
        try:
            node_id = node_data.get('id')
            if not node_id:
                continue
                
            node = Node.objects.get(id=node_id, map=instance)
            
            # Обновляем поля узла
            node.name = node_data.get('name', node.name)
            node.latitude = node_data.get('latitude', node.latitude)
            node.longitude = node_data.get('longitude', node.longitude)
            # ... другие поля
            
            node.save()
            
            # Сохраняем узел в словаре индексов
            client_index_to_node[i + len(new_nodes)] = node
            updated_nodes.append(node)
            logging.info(f"Updated node: ID={node.id} from client index {i + len(new_nodes)}")
            
        except Node.DoesNotExist:
            logging.error(f"Node with ID={node_id} not found during update")
    
    # Удаление узлов
    deleted_count = 0
    for node_id in deleted_node_ids:
        try:
            node = Node.objects.get(id=node_id, map=instance)
            node.delete()
            deleted_count += 1
            logging.info(f"Deleted node: ID={node_id}")
        except Node.DoesNotExist:
            logging.error(f"Node with ID={node_id} not found during deletion")
    
    # Аналогичная обработка для ребер с использованием client_index_to_node
    # ... код обработки ребер ...
    
    # Обновляем само отображение
    instance.save()
    
    return instance
```

### Пример обработки новых ребер

При обработке новых ребер с временными ID используется словарь `client_index_to_node` для привязки к реальным узлам:

```python
# Обработка новых ребер
created_edges = []
for edge_data in new_edges:
    source_ref = edge_data.get('node1')
    target_ref = edge_data.get('node2')
    
    # Получаем исходный узел, используя client_index_to_node, если это временный ID
    if isinstance(source_ref, str) and source_ref.startswith('temp_'):
        # Извлекаем индекс из временного ID (например, 'temp_1' -> 1)
        index = int(source_ref.replace('temp_', ''))
        source_node = client_index_to_node.get(index)
        if not source_node:
            logging.error(f"Cannot find node for temporary ID {source_ref}")
            continue
    else:
        try:
            # Если это обычный ID из базы данных
            source_node = Node.objects.get(id=source_ref, map=instance)
        except Node.DoesNotExist:
            logging.error(f"Source node with ID={source_ref} not found")
            continue
    
    # Аналогично для целевого узла
    # ... код получения target_node ...
    
    # Создаем новое ребро
    edge = Edge.objects.create(
        map=instance,
        node1=source_node,
        node2=target_node,
        # ... другие поля
    )
    created_edges.append(edge)
    logging.info(f"Created new edge: ID={edge.id} between nodes {source_node.id} and {target_node.id}")
```

### Преимущества механизма client_index_to_node для PATCH-запросов

1. **Поддержка временных ID**: Позволяет корректно создавать ребра между новыми узлами, которые еще не имеют постоянных ID в базе данных
2. **Отслеживание действий**: Облегчает логирование и отладку, связывая индексы клиента с объектами в базе данных
3. **Более точное обновление**: Уменьшает вероятность ошибок при связывании объектов, особенно в сложных сценариях с множеством новых и измененных объектов
4. **Упрощение дальнейшей обработки**: Дает целостную картину соответствия между данными клиента и сервера
5. **Атомарность операций**: Позволяет реализовать транзакционную обработку, где все объекты создаются и связываются между собой в рамках одной атомарной операции

### Отличия от полного обновления (PUT)

В отличие от PUT-запроса, где происходит полная замена ресурса, PATCH-запрос позволяет избирательно обновлять только те части карты, которые изменились. Тем не менее, оба типа запросов используют механизм `client_index_to_node` для корректной привязки объектов. 

# Улучшение: Передача карты соответствия индексов клиенту

Для улучшения обработки ответа сервера и более точного сопоставления ID узлов между клиентом и сервером, мы добавили функциональность передачи карты соответствия индексов (`client_index_to_node`) от сервера клиенту. Это значительно повышает надежность и точность процесса обновления карты.

## Серверная часть

В сериализатор `MapSerializer` добавлены следующие компоненты:

1. **SerializerMethodField для client_index_map**:
   ```python
   # Поле для карты соответствия индексов
   client_index_map = serializers.SerializerMethodField(read_only=True)
   ```

2. **Метод для получения значения поля**:
   ```python
   def get_client_index_map(self, obj):
       # Получаем маппинг индексов из контекста, если он есть
       return getattr(self, '_client_index_map', {})
   ```

3. **Переопределение метода to_representation для добавления маппинга в ответ**:
   ```python
   def to_representation(self, instance):
       # Стандартное представление
       ret = super().to_representation(instance)
       # Добавляем карту индексов, если она существует
       if hasattr(self, '_client_index_map') and self._client_index_map:
           # Преобразуем объекты Node в их ID для сериализации
           index_to_id_map = {}
           for index, node in self._client_index_map.items():
               # Проверяем тип индекса и преобразуем его в строку, если нужно
               if isinstance(index, int) or (isinstance(index, str) and index.isdigit()):
                   index_to_id_map[str(index)] = node.id
           ret['client_index_map'] = index_to_id_map
       return ret
   ```

4. **Сохранение маппинга в контексте сериализатора**:
   ```python
   # В методах _handle_full_update и _handle_patch_update
   # Сохраняем карту соответствия индексов клиента и узлов в сериализатор
   # для возврата в ответе
   self._client_index_map = client_index_to_node
   ```

## Клиентская часть

Метод `updateLocalIdsAfterSave` в классе `DatabaseController` был обновлен для использования карты соответствия, возвращаемой с сервера:

```javascript
// Проверяем наличие карты соответствия индексов от сервера
if (serverData.client_index_map && Object.keys(serverData.client_index_map).length > 0) {
    console.log('Получена карта соответствия индексов от сервера:', serverData.client_index_map);
    
    // Обновляем ID узлов на основе карты индексов от сервера
    Object.entries(serverData.client_index_map).forEach(([clientIndex, nodeId]) => {
        // Ищем узел с соответствующим индексом или временным ID
        let localNode = null;
        
        if (isFinite(clientIndex)) {
            // Если индекс числовой, то это может быть временный ID
            localNode = Object.values(nodes).find(n => n.id == clientIndex);
            if (localNode) {
                console.log(`Найден узел с ID ${localNode.id} для клиентского индекса ${clientIndex}`);
                if (localNode.id !== nodeId) {
                    console.log(`Обновление ID узла: ${localNode.id} -> ${nodeId}`);
                    nodeIdMap[localNode.id] = nodeId;
                    localNode.id = nodeId;
                }
            }
        }
    });
} else {
    // Если карта соответствия не пришла с сервера, используем старый метод по координатам
    // ...
}
```

## Преимущества нового подхода

1. **Точное сопоставление**: Вместо сопоставления по координатам (которое может быть неточным при близко расположенных узлах), мы теперь имеем точное соответствие между клиентскими индексами/ID и серверными ID.

2. **Улучшенная отказоустойчивость**: Если по каким-то причинам карта соответствия не будет получена, клиент автоматически вернется к использованию старого метода сопоставления по координатам.

3. **Поддержка сложных сценариев**: Новый механизм корректно обрабатывает сценарии с множеством новых, измененных и удаленных узлов в одном запросе.

4. **Лучшее логирование**: Расширенное логирование на стороне клиента и сервера позволяет легче отслеживать процесс сопоставления ID.

## Формат ответа сервера

При возвращении данных клиенту, сервер добавляет объект `client_index_map` в JSON-ответ:

```json
{
  "id": 123,
  "name": "Моя карта",
  "nodes": [...],
  "edges": [...],
  "client_index_map": {
    "0": 456,   // Индекс 0 в массиве new_nodes соответствует узлу с ID 456
    "1": 789,   // Индекс 1 в массиве new_nodes соответствует узлу с ID 789
    "temp_42": 567  // Временный ID temp_42 соответствует узлу с ID 567
  }
}
```

Это позволяет клиенту точно понимать, какие ID были присвоены каждому узлу на сервере, и корректно обновлять локальные данные. 