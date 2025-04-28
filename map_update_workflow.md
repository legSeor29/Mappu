# Процесс обновления карты

## Обзор
Этот документ описывает процесс обновления данных карты в приложении, фокусируясь на том, что происходит при нажатии кнопки "Сохранить".

## Клиентская часть

### 1. Инициализация сохранения
```javascript
// Пример обработки нажатия кнопки "Сохранить"
saveButton.onClick = async () => {
    try {
        await databaseController.UpdateData();
        showSuccessMessage("Изменения успешно сохранены");
    } catch (error) {
        showErrorMessage("Ошибка при сохранении: " + error.message);
    }
};
```

### 2. Обнаружение изменений
```javascript
// Метод проверки изменений
function hasChanges() {
    return (
        this.newNodes.length > 0 ||
        this.modifiedNodes.length > 0 ||
        this.deletedNodes.length > 0 ||
        this.newEdges.length > 0 ||
        this.modifiedEdges.length > 0 ||
        this.deletedEdges.length > 0
    );
}
```

### 3. Метод отправки данных
```javascript
// Подготовка данных для отправки
async function prepareData() {
    if (this.hasChanges()) {
        return {
            type: 'PATCH',
            data: {
                nodes: this.getChangedNodes(),
                edges: this.getChangedEdges()
            }
        };
    } else {
        return {
            type: 'PUT',
            data: this.getFullMapState()
        };
    }
}
```

### 4. Процесс PATCH-запроса
```javascript
// Отправка PATCH-запроса
async function sendPatchRequest(data) {
    const response = await fetch(`/api/maps/${this.mapId}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
    }
    
    return await response.json();
}
```

### 5. Обработка ответа
```javascript
// Обработка ответа сервера
function handleServerResponse(response) {
    // Обновление ID новых узлов
    response.newNodes.forEach((node) => {
        this.updateNodeId(node.tempId, node.id);
    });
    
    // Обработка ожидающих связей
    this.pendingEdges.forEach((edge) => {
        if (this.isNodeIdConfirmed(edge.source) && this.isNodeIdConfirmed(edge.target)) {
            this.createEdge(edge);
        }
    });
}
```

### 6. Создание узлов и связей
```javascript
// Создание нового узла
function createNode(position, type) {
    const tempId = this.generateTempId();
    const node = {
        id: tempId,
        position,
        type,
        properties: {}
    };
    this.newNodes.push(node);
    return node;
}

// Создание новой связи
function createEdge(sourceId, targetId) {
    const edge = {
        id: this.generateTempId(),
        source: sourceId,
        target: targetId,
        properties: {}
    };
    
    if (this.isTempId(sourceId) || this.isTempId(targetId)) {
        this.pendingEdges.push(edge);
    } else {
        this.newEdges.push(edge);
    }
    
    return edge;
}
```

### 7. Обработка ошибок
```javascript
// Обработка ошибок валидации
function validateData(data) {
    const errors = [];
    
    // Проверка узлов
    data.nodes.forEach(node => {
        if (!this.isValidNode(node)) {
            errors.push(`Неверные данные узла: ${node.id}`);
        }
    });
    
    // Проверка связей
    data.edges.forEach(edge => {
        if (!this.isValidEdge(edge)) {
            errors.push(`Неверные данные связи: ${edge.id}`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Повторная попытка при ошибке сети
async function retryRequest(request, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await request();
        } catch (error) {
            lastError = error;
            await this.delay(1000 * Math.pow(2, i)); // Экспоненциальная задержка
        }
    }
    
    throw lastError;
}
```

## Серверная часть (Django)

### 1. API-endpoint и основной процесс обработки

```python
# MainApp/views.py
class MapDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = Map.objects.all()
    serializer_class = MapSerializer
    permission_classes = [IsMapOwner]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            logger.info(f"Запрос на обновление карты ID: {instance.id}")
            
            # Проверка прав доступа
            if instance.owner != request.user:
                raise PermissionDenied("Вы не можете изменять эту карту")
            
            # Всегда используем partial=True, так как используется только PATCH
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            
            if not serializer.is_valid():
                logger.error(f"Ошибка валидации: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            self.perform_update(serializer)
            logger.info(f"Карта ID: {instance.id} успешно обновлена")
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception("Ошибка при обновлении карты")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
```

### 2. Обработка данных в сериализаторе

```python
# MainApp/serializers.py - Метод update в MapSerializer
def update(self, instance, validated_data):
    """
    Обновить экземпляр карты
    """
    # Для PATCH-запросов обрабатываем с помощью специального метода
    if self.context['request'].method.upper() == 'PATCH':
        logger.info("Вызов метода _handle_patch_update для карты")
        return self._handle_patch_update(instance, validated_data)
    else:
        # Для PUT-запросов (полное обновление)
        # Реализация стандартного обновления
        # ...
```

### 3. Обработка PATCH-запросов

```python
# Метод _handle_patch_update в MapSerializer
def _handle_patch_update(self, instance, validated_data):
    """
    Специальный обработчик для частичного обновления (PATCH)
    """
    logger.info(f"Обработка PATCH-запроса для карты ID: {instance.id}")
    
    # Создаем словари для отслеживания изменений
    existing_nodes = {str(node.id): node for node in instance.nodes.all()}
    existing_edges = {str(edge.id): edge for edge in instance.edges.all()}
    
    # Словарь соответствия клиентских ID узлов и ID в БД
    client_to_db_id_map = {}
    
    # 1. Обновляем базовые поля карты
    # ...
    
    # 2. Удаляем указанные узлы
    deleted_node_ids = validated_data.get('deleted_node_ids', [])
    # ...
    
    # 3. Обновляем существующие узлы
    update_nodes = validated_data.get('update_nodes', [])
    # ...
    
    # 4. Создаем новые узлы
    new_nodes = validated_data.get('new_nodes', [])
    # ...
    
    # 5. Удаляем указанные ребра
    deleted_edge_ids = validated_data.get('deleted_edge_ids', [])
    # ...
    
    # 6. Создаем новые ребра
    new_edges = validated_data.get('new_edges', [])
    # ...
    
    # 7. Обновляем карту соответствия индексов для ответа клиенту
    client_index_map = {}
    # ...
    
    # Обновляем данные экземпляра
    instance.refresh_from_db()
    
    return instance
```

### 4. Обработка новых узлов

```python
# Фрагмент из _handle_patch_update для обработки новых узлов
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
        
        # Добавляем в маппинг временный ID -> существующий узел
        temp_id = node_data.get('id')
        if temp_id is None:
            temp_id = i
        
        client_to_db_id_map[str(temp_id)] = existing_node
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
        
        # Добавляем в маппинг временный ID -> новый узел
        temp_id = node_data.get('id')
        if temp_id is None:
            temp_id = i
        
        client_to_db_id_map[str(temp_id)] = new_node
```

### 5. Создание новых рёбер

```python
# Фрагмент из _handle_patch_update для создания новых рёбер
for edge_data in new_edges:
    # Получаем ID узлов
    node1_id = str(edge_data.get('node1'))
    node2_id = str(edge_data.get('node2'))
    
    # Проверяем, не были ли узлы удалены
    if node1_id in deleted_node_ids_set or node2_id in deleted_node_ids_set:
        logger.info(f"Пропуск создания ребра {node1_id}-{node2_id}, т.к. один из узлов удален")
        continue
    
    # Находим узлы в БД или в маппинге клиентских ID
    node1 = client_to_db_id_map.get(node1_id) or existing_nodes.get(node1_id)
    node2 = client_to_db_id_map.get(node2_id) or existing_nodes.get(node2_id)
    
    # Если оба узла найдены
    if node1 and node2:
        # Проверяем существование ребра
        existing_edge = Edge.objects.filter(
            node1=node1, node2=node2
        ).first() or Edge.objects.filter(
            node1=node2, node2=node1
        ).first()
        
        if existing_edge:
            # Если ребро существует, добавляем его к карте
            if existing_edge not in instance.edges.all():
                instance.edges.add(existing_edge)
        else:
            # Создаем новое ребро
            new_edge = Edge.objects.create(node1=node1, node2=node2)
            instance.edges.add(new_edge)
```

### 6. Возврат обновленной карты соответствия ID

```python
# Создание карты соответствия ID для ответа клиенту
client_index_map = {}

for key, value in client_to_db_id_map.items():
    if isinstance(key, (int, str)):
        # Извлекаем ID узла из value
        if hasattr(value, 'id'):  # Если value - это объект Node
            node_id = value.id
        elif isinstance(value, int):  # Если value - это ID узла
            node_id = value
        else:
            continue
        
        # Сохраняем в карту соответствия ключ -> ID узла
        client_index_map[str(key)] = node_id

self._client_index_map = client_index_map
```

## Технические детали

### Структуры данных сериализаторов
```python
# Основные сериализаторы
class NodeSerializer(serializers.ModelSerializer):
    temp_id = serializers.IntegerField(required=False, write_only=True)
    
    class Meta:
        model = Node
        fields = '__all__'

class EdgeSerializer(serializers.ModelSerializer):
    temp_id = serializers.IntegerField(required=False, write_only=True)
    
    class Meta:
        model = Edge
        fields = '__all__'

class EdgeWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    temp_id = serializers.IntegerField(required=False)
    node1 = serializers.IntegerField()
    node2 = serializers.IntegerField()

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
```

## Рекомендации
1. Всегда проверять данные перед отправкой на сервер
2. Корректно обрабатывать сетевые ошибки
3. Поддерживать согласованность данных между клиентом и сервером
4. Использовать подходящие HTTP-методы (PATCH vs PUT)
5. Реализовать корректное информирование пользователя об ошибках
6. Тщательно логировать процесс обновления на сервере для отладки
7. Учесть обработку временных ID, которые могут присваиваться клиентом
8. Обеспечить проверку прав доступа к карте перед обновлением

## Потенциальные проблемы и их решения

### 1. Несовпадение ID узлов
При создании новых узлов клиент присваивает временные ID, которые необходимо соотнести с реальными ID после сохранения. Решается с помощью карты соответствия `client_index_map`.

### 2. Порядок обработки изменений
Важно соблюдать правильный порядок обработки: сначала удаление, затем обновление существующих узлов, затем создание новых, и только потом работа с рёбрами.

### 3. Разрешение конфликтов
При конфликтах (например, два разных пользователя редактируют одну карту) необходимо реализовать стратегию разрешения конфликтов или механизм блокировки. 