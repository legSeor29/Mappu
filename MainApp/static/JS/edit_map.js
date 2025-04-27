let nodes = {};
let edges = {};
let selectedNodes = [];
const mapId = document.getElementById('mapId').innerText

class DatabaseController {
    constructor(formHandler) {   
        this.formHandler = formHandler;
        this.map = null;  
        this.ymaps3 = null;
        
        // Наборы для отслеживания начальных ID узлов и ребер
        this.initialNodeIds = new Set();
        this.initialEdgeIds = new Set();
        
        // Объект для отслеживания изменений
        this.resetChanges();
        
        // Настройка интервала автосохранения (каждые 30 секунд)
        this.autoSaveInterval = null;
        this.enableAutoSave = false;
    }
    GetCurrentData() {
        console.log('Поиск карты...')
        fetch(`/api/v1/maps/${mapId}`)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки');
            return response.json();
        })
        .then(data => {
            console.log('Данные объекта:', data);
            this.ArrayFilling(data);
        })
        .catch(error => {
            console.error('Ошибка:', error);
        });
    }

    ArrayFilling(data) {
        console.log(data.nodes);
        console.log(data.edges);
        
        // Очищаем объекты узлов и ребер перед заполнением
        nodes = {};
        edges = {};
        
        // Сохраняем ID существующих узлов и ребер, чтобы не считать их новыми
        this.initialNodeIds = new Set();
        this.initialEdgeIds = new Set();
        
        // Установим флаг загрузки данных
        document.getElementById('mapId')._loadingData = true;

        try {
            // Заполняем узлы
            for (const node of data.nodes) {
                // Сохраняем ID существующего узла
                this.initialNodeIds.add(node.id);
                
                // Создаем узел из данных с сервера
                const newNode = new Node(
                    [node.longitude, node.latitude],
                    node.id,
                    this.map,
                    this.ymaps3,
                    this.formHandler,
                    node.name,
                    node.description,
                    node.z_coordinate
                );
                
                // Добавляем в глобальный объект узлов
                nodes[node.id] = newNode;
                
                console.log(`Узел ${node.id} загружен из базы данных`);
            }
            
            // Заполняем ребра
            for (const edge of data.edges) {
                // Сохраняем ID существующего ребра
                this.initialEdgeIds.add(edge.id);
                
                // Проверяем, есть ли оба узла
                if (nodes[edge.node1] && nodes[edge.node2]) {
                    // Создаем ребро
                    const newEdge = new Edge(
                        edge.id,
                        nodes[edge.node1],
                        nodes[edge.node2],
                        this.map,
                        this.ymaps3,
                        this.formHandler
                    );
                    
                    // Добавляем в глобальный объект ребер
                    edges[edge.id] = newEdge;
                    
                    console.log(`Ребро ${edge.id} загружено из базы данных`);
                } else {
                    console.warn(`Невозможно загрузить ребро ${edge.id}: один или оба узла не найдены`);
                }
            }
            
            // Сбрасываем изменения после загрузки
            this.resetChanges();
            
            console.log('Текущие данные заполнены');
            console.log('Отслеживаемые начальные ID узлов:', this.initialNodeIds);
            console.log('Отслеживаемые начальные ID рёбер:', this.initialEdgeIds);
            console.log(nodes, edges);
        } catch (error) {
            console.error("Ошибка при получении данных:", error);
        } finally {
            // Сбрасываем флаг загрузки данных, когда загрузка завершена
            document.getElementById('mapId')._loadingData = false;
        }
    }

    UpdateData() {
        // Проверяем наличие изменений для PATCH-запроса
        if (this.hasChanges()) {
            console.log('Обнаружены изменения, используем PATCH запрос');
            // Используем PATCH для отправки только измененных данных
            this.sendPatchRequest();
        } else {
            console.log('Изменения не обнаружены, используем полный PUT запрос');
            // Используем PUT для отправки всех данных (на случай если нет изменений для отслеживания)
            this.sendPutRequest();
        }
    }

    // Отправка полного PUT-запроса (все данные)
    sendPutRequest() {
        console.group('Отправка PUT-запроса');
        console.time('PUT запрос');
        
        const dataToSend = {
            nodes: Object.values(nodes).map(node => {
                const nodeData = {
                    id: node.id,
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    name: node.name || '',
                    description: node.description || '',
                    z_coordinate: node.z_coordinate || 0
                };
                return nodeData;
            }),
            edges: Object.values(edges).map(edge => {
                const edgeData = {
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id
                };
                return edgeData;
            })
        };

        console.log(`Подготовлено узлов: ${dataToSend.nodes.length}, ребер: ${dataToSend.edges.length}`);
        console.log('Отправляемые данные (PUT):', JSON.stringify(dataToSend, null, 2));

        const csrfToken = this.getCsrfToken();
        console.log(`Отправка запроса на /api/v1/maps/${mapId}/ с CSRF токеном: ${csrfToken.substring(0, 5)}...`);

        fetch(`/api/v1/maps/${mapId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(dataToSend)
        })
        .then(response => {
            console.log(`Получен ответ HTTP ${response.status} ${response.statusText}`);
            if (!response.ok) {
                console.error('Ошибка HTTP:', response.status);
                return response.text().then(text => {
                    console.error('Ответ сервера:', text);
                    throw new Error(`Ошибка обновления данных: ${text}`);
                });
            }
            return response.json();
        })
        .then(updatedData => {
            console.log('Ответ сервера:', updatedData);
            console.log(`Обновлено узлов: ${updatedData.nodes ? updatedData.nodes.length : 0}, ребер: ${updatedData.edges ? updatedData.edges.length : 0}`);
            
            // Обновляем ID узлов и ребер после сохранения на сервере
            console.time('Обновление локальных ID');
            this.updateLocalIdsAfterSave(updatedData);
            console.timeEnd('Обновление локальных ID');
            
            // Обновляем списки начальных ID
            console.log('Обновление списка начальных ID узлов и ребер');
            Object.values(nodes).forEach(node => {
                this.initialNodeIds.add(node.id);
            });
            
            Object.values(edges).forEach(edge => {
                this.initialEdgeIds.add(edge.id);
            });
            
            // Сбрасываем отслеживание изменений
            this.resetChanges();
            
            console.log('Размер начальных ID после обновления:', {
                nodes: this.initialNodeIds.size,
                edges: this.initialEdgeIds.size
            });
            
            console.timeEnd('PUT запрос');
            console.groupEnd();
            alert('Карта успешно сохранена!');
        })
        .catch(error => {
            console.error('Ошибка при обновлении:', error);
            console.timeEnd('PUT запрос');
            console.groupEnd();
            alert('Ошибка при сохранении карты: ' + error.message);
        });
    }
    
    // Отправка PATCH-запроса (только изменения)
    sendPatchRequest() {
        console.group('Отправка PATCH-запроса');
        console.time('PATCH запрос');
        
        // Готовим данные для PATCH-запроса
        const mapData = {};
        
        // Добавляем новые узлы
        if (this.changes.newNodes.length > 0) {
            console.log(`Подготовка ${this.changes.newNodes.length} новых узлов`);
            mapData.new_nodes = this.changes.newNodes.map(node => {
                const nodeData = {
                    name: node.name || '',
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    description: node.description || '',
                    z_coordinate: node.z_coordinate || 0
                };
                console.debug(`Новый узел: ${JSON.stringify(nodeData)}`);
                return nodeData;
            });
        }
        
        // Добавляем измененные узлы
        if (Object.keys(this.changes.changedNodes).length > 0) {
            console.log(`Подготовка ${Object.keys(this.changes.changedNodes).length} измененных узлов`);
            mapData.changed_nodes = Object.values(this.changes.changedNodes).map(node => {
                const nodeData = {
                    id: node.id,
                    name: node.name || '',
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    description: node.description || '',
                    z_coordinate: node.z_coordinate || 0
                };
                console.debug(`Измененный узел ID=${node.id}: ${JSON.stringify(nodeData)}`);
                return nodeData;
            });
        }
        
        // Добавляем ID удаленных узлов
        if (this.changes.deletedNodeIds.length > 0) {
            console.log(`Подготовка ${this.changes.deletedNodeIds.length} удаленных узлов: ${JSON.stringify(this.changes.deletedNodeIds)}`);
            mapData.deleted_node_ids = this.changes.deletedNodeIds;
        }
        
        // Добавляем новые ребра
        if (this.changes.newEdges.length > 0) {
            console.log(`Подготовка ${this.changes.newEdges.length} новых ребер`);
            mapData.new_edges = this.changes.newEdges.map(edge => {
                const edgeData = {
                    node1: edge.node1.id,
                    node2: edge.node2.id
                };
                console.debug(`Новое ребро: ${JSON.stringify(edgeData)}`);
                return edgeData;
            });
        }
        
        // Добавляем измененные ребра
        if (Object.keys(this.changes.changedEdges).length > 0) {
            console.log(`Подготовка ${Object.keys(this.changes.changedEdges).length} измененных ребер`);
            mapData.changed_edges = Object.values(this.changes.changedEdges).map(edge => {
                const edgeData = {
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id
                };
                console.debug(`Измененное ребро ID=${edge.id}: ${JSON.stringify(edgeData)}`);
                return edgeData;
            });
        }
        
        // Добавляем ID удаленных ребер
        if (this.changes.deletedEdgeIds.length > 0) {
            console.log(`Подготовка ${this.changes.deletedEdgeIds.length} удаленных ребер: ${JSON.stringify(this.changes.deletedEdgeIds)}`);
            mapData.deleted_edge_ids = this.changes.deletedEdgeIds;
        }

        console.log('Итоговые данные для PATCH-запроса:', JSON.stringify(mapData, null, 2));
        
        // Проверяем, есть ли что отправлять
        if (Object.keys(mapData).length === 0) {
            console.warn('Нет изменений для отправки в PATCH-запросе');
            console.timeEnd('PATCH запрос');
            console.groupEnd();
            alert('Нет изменений для сохранения.');
            return;
        }

        // Отправляем PATCH-запрос
        const csrfToken = this.getCsrfToken();
        console.log(`Отправка запроса на /api/v1/maps/${mapId}/ с CSRF токеном: ${csrfToken.substring(0, 5)}...`);
        
        fetch(`/api/v1/maps/${mapId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(mapData)
        })
        .then(response => {
            console.log(`Получен ответ HTTP ${response.status} ${response.statusText}`);
            if (!response.ok) {
                console.error('Ошибка HTTP:', response.status);
                return response.text().then(text => {
                    console.error('Ответ сервера:', text);
                    throw new Error(`Ошибка обновления данных: ${text}`);
                });
            }
            return response.json();
        })
        .then(updatedData => {
            console.log('Ответ сервера:', updatedData);
            console.log(`Обновлено узлов: ${updatedData.nodes ? updatedData.nodes.length : 0}, ребер: ${updatedData.edges ? updatedData.edges.length : 0}`);
            
            // Обновляем ID узлов и ребер после сохранения на сервере
            console.time('Обновление локальных ID');
            this.updateLocalIdsAfterSave(updatedData);
            console.timeEnd('Обновление локальных ID');
            
            // Обновляем списки начальных ID
            console.log('Обновление списка начальных ID узлов и ребер');
            Object.values(nodes).forEach(node => {
                this.initialNodeIds.add(node.id);
            });
            
            Object.values(edges).forEach(edge => {
                this.initialEdgeIds.add(edge.id);
            });
            
            // Сбрасываем отслеживание изменений
            this.resetChanges();
            
            console.log('Размер начальных ID после обновления:', {
                nodes: this.initialNodeIds.size,
                edges: this.initialEdgeIds.size
            });
            
            console.timeEnd('PATCH запрос');
            console.groupEnd();
            alert('Карта успешно сохранена!');
        })
        .catch(error => {
            console.error('Ошибка при обновлении:', error);
            console.timeEnd('PATCH запрос');
            console.groupEnd();
            alert('Ошибка при сохранении карты: ' + error.message);
        });
    }

    // Обновляет локальные ID после сохранения на сервере
    updateLocalIdsAfterSave(serverData) {
        console.log('Данные с сервера для обновления ID:', serverData);
        
        // Создаем карту соответствия между старыми и новыми ID узлов
        const nodeIdMap = {};
        
        // Проверяем наличие карты соответствия индексов от сервера
        console.log('client_index_map из ответа:', serverData.client_index_map);
        console.log('Тип данных client_index_map:', typeof serverData.client_index_map);
        console.log('Ключи в client_index_map:', serverData.client_index_map ? Object.keys(serverData.client_index_map) : 'нет ключей');
        
        if (serverData.client_index_map && Object.keys(serverData.client_index_map).length > 0) {
            console.log('Получена карта соответствия индексов от сервера:', serverData.client_index_map);
            
            // Обновляем ID узлов на основе карты индексов от сервера
            Object.entries(serverData.client_index_map).forEach(([clientIndex, nodeId]) => {
                console.log(`Проверка маппинга: клиентский индекс ${clientIndex} -> ID узла ${nodeId}`);
                
                // Ищем узел с соответствующим индексом или временным ID
                let localNode = null;
                
                // Сначала проверяем прямое соответствие ID
                localNode = Object.values(nodes).find(n => String(n.id) === clientIndex);
                if (localNode) {
                    console.log(`Найден узел с ID ${localNode.id} по прямому соответствию индексу ${clientIndex}`);
                    if (localNode.id !== nodeId) {
                        console.log(`Обновление ID узла: ${localNode.id} -> ${nodeId}`);
                        nodeIdMap[localNode.id] = nodeId;
                        localNode.id = nodeId;
                    }
                    return; // Переходим к следующему маппингу
                }
                
                // Если это числовой индекс (например, позиция в массиве new_nodes)
                if (isFinite(clientIndex)) {
                    // Ищем среди новых узлов - они могут иметь временные ID совпадающие с индексом
                    const newNodeId = parseInt(clientIndex, 10);
                    if (this.changes.newNodes.length > newNodeId) {
                        // Узел может быть в массиве newNodes по индексу
                        const newNodeAtIndex = this.changes.newNodes[newNodeId];
                        if (newNodeAtIndex) {
                            localNode = Object.values(nodes).find(n => n.id === newNodeAtIndex.id);
                            if (localNode) {
                                console.log(`Найден новый узел с ID ${localNode.id} для индекса ${clientIndex}`);
                                if (localNode.id !== nodeId) {
                                    console.log(`Обновление ID нового узла: ${localNode.id} -> ${nodeId}`);
                                    nodeIdMap[localNode.id] = nodeId;
                                    localNode.id = nodeId;
                                }
                                return; // Переходим к следующему маппингу
                            }
                        }
                    }
                    
                    // Пробуем искать напрямую по ID из клиентского индекса
                    localNode = Object.values(nodes).find(n => n.id == newNodeId);
                    if (localNode) {
                        console.log(`Найден узел с совпадающим ID ${localNode.id} для индекса ${clientIndex}`);
                        if (localNode.id !== nodeId) {
                            console.log(`Обновление ID узла: ${localNode.id} -> ${nodeId}`);
                            nodeIdMap[localNode.id] = nodeId;
                            localNode.id = nodeId;
                        }
                    }
                }
            });
        } else {
            console.log('Карта соответствия индексов не получена, используем сопоставление по координатам');
            
            // Собираем текущие узлы с данными для сравнения
            const localNodeMap = {};
            Object.values(nodes).forEach(node => {
                const key = `${node.coordinates[0]}_${node.coordinates[1]}`;
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
        }
        
        // Обновляем ID ребер и связи с узлами
        if (serverData.edges && serverData.edges.length > 0) {
            serverData.edges.forEach(serverEdge => {
                // Находим соответствующее ребро по узлам
                const localEdge = Object.values(edges).find(e => {
                    const node1Id = nodeIdMap[e.node1.id] || e.node1.id;
                    const node2Id = nodeIdMap[e.node2.id] || e.node2.id;
                    
                    return (node1Id == serverEdge.node1 && node2Id == serverEdge.node2) || 
                           (node1Id == serverEdge.node2 && node2Id == serverEdge.node1);
                });
                
                if (localEdge && localEdge.id !== serverEdge.id) {
                    console.log(`Обновление ID ребра: ${localEdge.id} -> ${serverEdge.id}`);
                    localEdge.id = serverEdge.id;
                }
            });
        }
        
        // Обновляем внутренние объекты с новыми ID
        const updatedNodes = {};
        const updatedEdges = {};
        
        Object.values(nodes).forEach(node => {
            updatedNodes[node.id] = node;
        });
        
        Object.values(edges).forEach(edge => {
            // Обновляем ссылки на узлы в ребрах если их ID изменились
            if (nodeIdMap[edge.node1.id]) {
                edge.node1 = updatedNodes[nodeIdMap[edge.node1.id]];
            }
            if (nodeIdMap[edge.node2.id]) {
                edge.node2 = updatedNodes[nodeIdMap[edge.node2.id]];
            }
            updatedEdges[edge.id] = edge;
        });
        
        // Заменяем существующие объекты
        nodes = updatedNodes;
        edges = updatedEdges;
        
        console.log('Локальные объекты обновлены после сохранения:', {nodes, edges});
    }

    // Метод для получения CSRF-токена
    getCsrfToken() {
        return document.querySelector('input[name="csrfmiddlewaretoken"]')?.value || 
               document.cookie.split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1] || '';
    }
    
    // Сбрасывает все накопленные изменения
    resetChanges() {
        // Инициализируем объект для отслеживания изменений
        this.changes = {
            infoChanged: false,        // Изменилась основная информация карты
            newNodes: [],              // Новые узлы, добавленные после загрузки
            changedNodes: {},          // Измененные узлы по ID: {id: node}
            deletedNodeIds: [],        // ID удаленных узлов
            newEdges: [],              // Новые ребра, добавленные после загрузки
            changedEdges: {},          // Измененные ребра по ID: {id: edge}
            deletedEdgeIds: []         // ID удаленных ребер
        };
        
        console.log('Изменения сброшены');
    }
    
    // Добавляет новый узел в список изменений
    addNewNode(node) {
        // Проверяем, является ли узел новым или это существующий узел из базы данных
        if (!this.initialNodeIds.has(node.id)) {
            console.log(`Узел ${node.id} добавлен как новый`);
            
            // Проверяем, не добавлен ли уже этот узел в список новых
            const alreadyAdded = this.changes.newNodes.some(n => n.id === node.id);
            if (!alreadyAdded) {
                // Добавляем узел в список новых узлов
                this.changes.newNodes.push({
                    id: node.id,
                    name: node.name,
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    description: node.description,
                    z_coordinate: node.z_coordinate
                });
            }
        } else {
            console.log(`Узел ${node.id} уже существует в базе данных, не добавляем в новые`);
        }
    }
    
    // Добавляет новое ребро в список изменений
    addNewEdge(edge) {
        // Проверяем, является ли ребро новым или это существующее ребро из базы данных
        if (!this.initialEdgeIds.has(edge.id)) {
            console.log(`Ребро ${edge.id} добавлено как новое`);
            
            // Проверяем, не добавлено ли уже это ребро в список новых
            const alreadyAdded = this.changes.newEdges.some(e => e.id === edge.id);
            if (!alreadyAdded) {
                // Добавляем ребро в список новых ребер
                this.changes.newEdges.push({
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id
                });
            }
        } else {
            console.log(`Ребро ${edge.id} уже существует в базе данных, не добавляем в новые`);
        }
    }
    
    // Отмечает узел как измененный
    markNodeChanged(node) {
        // Проверяем, существует ли узел в базе данных
        if (this.initialNodeIds.has(node.id)) {
            console.log(`Узел ${node.id} отмечен как измененный`)
            
            // Если узел не был отмечен как измененный ранее, добавляем его
            if (!this.changes.changedNodes[node.id]) {
                this.changes.changedNodes[node.id] = {
                    id: node.id,
                    name: node.name,
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    description: node.description,
                    z_coordinate: node.z_coordinate
                };
            } else {
                // Если уже был отмечен, просто обновляем данные
                Object.assign(this.changes.changedNodes[node.id], {
                    name: node.name,
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    description: node.description,
                    z_coordinate: node.z_coordinate
                });
            }
        } else {
            // Если узел не существует в базе данных, добавляем его как новый
            this.addNewNode(node);
        }
    }
    
    // Отмечает ребро как измененное
    markEdgeChanged(edge) {
        // Проверяем, существует ли ребро в базе данных
        if (this.initialEdgeIds.has(edge.id)) {
            console.log(`Ребро ${edge.id} отмечено как измененное`)
            
            // Если ребро не было отмечено как измененное ранее, добавляем его
            if (!this.changes.changedEdges[edge.id]) {
                this.changes.changedEdges[edge.id] = {
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id
                };
            } else {
                // Если уже было отмечено, просто обновляем данные
                Object.assign(this.changes.changedEdges[edge.id], {
                    node1: edge.node1.id,
                    node2: edge.node2.id
                });
            }
        } else {
            // Если ребро не существует в базе данных, добавляем его как новое
            this.addNewEdge(edge);
        }
    }
    
    // Отметить узел как удаленный
    markNodeDeleted(nodeId) {
        // Если это новый узел, просто удаляем его из списка новых
        if (!this.initialNodeIds.has(nodeId)) {
            this.changes.newNodes = this.changes.newNodes.filter(node => node.id !== nodeId);
            return;
        }
        
        // Удаляем из измененных, если был там
        delete this.changes.changedNodes[nodeId];
        
        // Добавляем в удаленные
        if (!this.changes.deletedNodeIds.includes(nodeId)) {
            this.changes.deletedNodeIds.push(nodeId);
        }
        console.log(`Узел ${nodeId} отмечен как удаленный`);
    }
    
    // Отметить ребро как удаленное
    markEdgeDeleted(edgeId) {
        // Если это новое ребро, просто удаляем его из списка новых
        if (!this.initialEdgeIds.has(edgeId)) {
            this.changes.newEdges = this.changes.newEdges.filter(edge => edge.id !== edgeId);
            return;
        }
        
        // Удаляем из измененных, если было там
        delete this.changes.changedEdges[edgeId];
        
        // Добавляем в удаленные
        if (!this.changes.deletedEdgeIds.includes(edgeId)) {
            this.changes.deletedEdgeIds.push(edgeId);
        }
        console.log(`Ребро ${edgeId} отмечено как удаленное`);
    }
    
    // Проверяем, есть ли изменения
    hasChanges() {
        return this.changes.infoChanged || 
              this.changes.newNodes.length > 0 || 
              Object.keys(this.changes.changedNodes).length > 0 ||
              this.changes.deletedNodeIds.length > 0 ||
              this.changes.newEdges.length > 0 ||
              Object.keys(this.changes.changedEdges).length > 0 ||
              this.changes.deletedEdgeIds.length > 0;
    }
}

class FormHandler {
    constructor() {
        this.nodeName = document.querySelector('input[name="node_name"]')
        this.latitudeInput = document.querySelector('.latitude');
        this.longitudeInput = document.querySelector('.longitude');
        this.nodeDesc = document.querySelector('textarea[name="node_description"]')
        this.nodeZ_coord = document.querySelector('input[name="node_z_coordinate"]')
        this.nodeSubmit = document.querySelector('button[name="node_submit"]')
        this.node1Select = document.querySelector('select[name="node1"]');
        this.node2Select = document.querySelector('select[name="node2"]');
        this.edgeSubmit = document.querySelector('button[name="edge_submit"]'); 
    }

    addNodeOption(node) {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.name || `Узел ${node.id}`;
        
        this.node1Select.appendChild(option.cloneNode(true));
        this.node2Select.appendChild(option);
    }

    removeNodeOption(nodeId) {
        const options = this.node1Select.querySelectorAll(`option[value="${nodeId}"]`);
        options.forEach(option => option.remove());
        
        const options2 = this.node2Select.querySelectorAll(`option[value="${nodeId}"]`);
        options2.forEach(option => option.remove());
    }

    setNodeCoords(coords) {
        this.longitudeInput.value = coords[0].toFixed(6);
        this.latitudeInput.value = coords[1].toFixed(6);
    }

    updateNodeOptions(node) {
        const options = this.node1Select.querySelectorAll(`option[value="${node.id}"]`);
        options.forEach(option => option.textContent = node.name || `Узел ${node.id}`);

        const options2 = this.node2Select.querySelectorAll(`option[value="${node.id}"]`);
        options2.forEach(option => option.textContent = node.name || `Узел ${node.id}`);
    }

    setFirstAvailableNode(nodeId) {
        // Проверяем первый select
        if (!this.node1Select.value) {
            this.node1Select.value = nodeId;
        } 
        // Проверяем второй select
        else if (!this.node2Select.value) {
            this.node2Select.value = nodeId;
        } 
        // Если оба заполнены - сбрасываем и заполняем первый
        else {
            this.node1Select.value = nodeId;
            this.node2Select.value = '';
        }
    }

}

class Node {
    constructor(coordinates, id, map, ymaps3, formHandler, name = null, description = null, z_coordinate = 0) {  
        this.id = id;
        this.coordinates = coordinates;
        this.name = name 
        this.description = description
        this.z_coordinate = z_coordinate
        this.map = map;
        this.ymaps3 = ymaps3; // Сохраняем ссылку на API
        this.formHandler = formHandler;
        this.marker = null;
        this.menuVisible = false; // Добавляем флаг видимости меню
        this.formHandler.addNodeOption(this); // Добавляем в список
        this.placeholderUrl = 'https://cdn.animaapp.com/projects/6761c31b315a42798e3ee7e6/releases/67db012a45e0bcae5c95cfd1/img/placeholder-1.png'
        this.createMarker();
        
        // Добавляем узел для отслеживания только если он создан не из базы данных
        // и если контроллер инициализирован
        if (Controller && typeof Controller.addNewNode === 'function' && 
            !Controller.initialNodeIds.has(id)) {
            // Проверяем, создан ли этот узел новым пользовательским действием
            const nodeCreatedByUserAction = !document.getElementById('mapId')._loadingData;
            if (nodeCreatedByUserAction) {
                console.log(`Узел ${id} создан пользователем, отмечаем как новый`);
                Controller.addNewNode(this);
            }
        }
    }

    createMarker() {
        const markerElement = this.createImageMarker(this.placeholderUrl);
        const menu = this.createMenu();
        const container = document.createElement('div');
        
        // Добавляем стиль для обработки событий
        container.style.pointerEvents = 'auto';
        container.append(markerElement, menu);

        // Обработчик правой кнопки мыши
        markerElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Right click detected'); // Логирование
            this.menuVisible = !this.menuVisible;
            if (this.menuVisible) {
                this.updateMenu(menu)
                menu.style.display = 'block'
            } else {
                menu.style.display = 'none'
            }
            return false;
        });

        // Обработчик левой кнопки мыши
        markerElement.addEventListener('click', (e) => {
            if (e.button !== 0) return; // Проверяем именно левую кнопку
            e.stopPropagation();
            this.formHandler.setFirstAvailableNode(this.id);
            //this.menuVisible = false;
            //menu.style.display = 'none';
        });

        markerElement.addEventListener("mousedown", (e) => {
            console.log('Обработка нажатия колесика мыши...'); 
            e.stopPropagation();
            e.preventDefault();
            if (e.button === 1) {
                selectedNodes.push(this);
                console.log(selectedNodes);
                if (selectedNodes.length == 2) {
                    console.log('Создается новое ребро...')
                    const existingEdgeIds = Object.keys(edges).map(id => parseInt(id, 10));
                    const newEdgeId = existingEdgeIds.length > 0 ? Math.max(...existingEdgeIds) + 1 : 1;
                    const newEdge = new Edge(
                        newEdgeId,
                        selectedNodes[0],
                        selectedNodes[1],
                        this.map,
                        this.ymaps3,
                        this.formHandler
                    );
            
                    edges[newEdge.id] = newEdge;
                    console.log('Создано новое ребро:', newEdge);
                    selectedNodes = [];
                }
            }
        });

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        })

        // Закрытие меню при клике вне элемента
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.menuVisible = false;
                menu.style.display = 'none';
            }
        });


        // Создание маркера
        this.marker = new this.ymaps3.YMapMarker({
            coordinates: this.coordinates,
            source: 'my-markers'
        }, container);
        
        this.map.addChild(this.marker);
    }

    createImageMarker(src) {
        const element = document.createElement('img');
        element.src = src;
        element.style.cssText = `
            width: 40px;
            height: 40px;
            cursor: pointer;
            transform: translate(-50%, -100%);
            pointer-events: auto; // Разрешаем события мыши
        `;
        return element;
    }

    createMenu() {
        const menu = document.createElement('div');
        menu.innerHTML = `
            <form class="node-form">
                <div class="mb-3">
                    <label class="form-label">Название вершины</label>
                    <input type="text" class="form-control node-name" value="${this.name || ''}">
                </div>
                <div class="mb-3">
                    <label class="form-label">Описание</label>
                    <textarea class="form-control node-desc">${this.description || ''}</textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Высота (Z)</label>
                    <input type="number" 
                            class="form-control node-z_cord" 
                            name="z_coordinate"
                            step="any" value="${this.z_coordinate}">
                </div>
                
                <button type="button" class="btn btn-primary btn-sm node_save">Сохранить</button>
                <button type="button" class="delete btn btn-danger btn-sm">Удалить</button>
            </form>
        `;
        menu.style.display = 'none';
        menu.className = 'node-menu';
        menu.querySelector(`.node_save`).addEventListener('click', (e) => {
            //e.stopPropagation();
            console.log('Сохранение данных о вершине...')
            
            // Сохраняем старые значения для проверки изменений
            const oldName = this.name;
            const oldDesc = this.description;
            const oldZ = this.z_coordinate;
            
            this.name = menu.querySelector('.node-name').value; 
            this.description = menu.querySelector('.node-desc').value;
            this.z_coordinate = menu.querySelector('.node-z_cord').value; 
            this.formHandler.updateNodeOptions(this);
            
            // Отмечаем узел как измененный, если что-то изменилось
            if (Controller && Controller.markNodeChanged && 
                (oldName !== this.name || oldDesc !== this.description || oldZ !== this.z_coordinate)) {
                Controller.markNodeChanged(this);
            }
        });
        
        menu.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete();
        });
        
        return menu;
    }
    
    updateMenu(menu) {
        menu.querySelector('.node-name').value = this.name || '';
        menu.querySelector('.node-desc').innerText = this.description || '';
        menu.querySelector('.node-z_cord').value = this.z_coordinate;
    }

    delete() {
        console.log(`удалена вершина ${this.id}`)
        // Удаление всех связанных ребер
        const relatedEdges = Object.values(edges).filter(e => 
            e.node1.id === this.id || e.node2.id === this.id
        );
        
        relatedEdges.forEach(edge => {
            edge.delete(); // Используем новый метод delete
        });
        this.map.removeChild(this.marker);
        // const index = nodes.findIndex(n => n.id === this.id);
        // if (index !== -1) nodes.splice(index, 1);
        delete nodes[this.id];
        // Очищаем поля формы если удаляемый ID был в них
        this.formHandler.removeNodeOption(this.id);
        
        // Отмечаем узел как удаленный
        if (Controller && Controller.markNodeDeleted) {
            Controller.markNodeDeleted(this.id);
        }
    }
}
class Edge {
    constructor(id, node1, node2, map, ymaps3, formHandler) {
        
        this.node1 = node1;
        this.node2 = node2;
        this.map = map;
        this.ymaps3 = ymaps3;
        this.formHandler = formHandler;
        this.feature = null;
        this.menuVisible = false;
        this.id = id;
       
        this.createFeature();
        
        // Добавляем ребро для отслеживания если оно новое
        if (Controller && Controller.addNewEdge && 
            (!Controller.initialEdgeIds || !Controller.initialEdgeIds.has(id))) {
            Controller.addNewEdge(this);
        }
    }

    createFeature() {
        const coordinates = [
            this.node1.coordinates,
            this.node2.coordinates
        ];

        // Создаем элемент линии
        const lineElement = document.createElement('div');
        const menu = this.createMenu();
        
        // Основной элемент для линии и меню
        const container = document.createElement('div');
        container.append(lineElement, menu);

        // Создаем саму линию
        this.feature = new this.ymaps3.YMapFeature({
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            style: {
                stroke: [{width: 3, color: "#1DA1F2"}],
                cursor: 'pointer'
            },
            source: 'edges'
        }, container);

        // Обработчики событий
        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.menuVisible = !this.menuVisible;
            menu.style.display = this.menuVisible ? 'block' : 'none';
        });

        container.addEventListener('click', (e) => {
            if (e.button !== 0) return;
            this.formHandler.setCurrentEdge?.(this.id);
            this.menuVisible = false;
            menu.style.display = 'none';
        });

        // Закрытие меню при клике вне элемента
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.menuVisible = false;
                menu.style.display = 'none';
            }
        });

        this.map.addChild(this.feature);
    }

    createMenu() {
        const menu = document.createElement('div');
        menu.style = `
            display: none;
            position: absolute;
            background: white;
            padding: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 1000;
        `;
        menu.innerHTML = `
            <button class="delete-edge btn btn-danger btn-sm">
                Удалить связь
            </button>
        `;

        menu.querySelector('.delete-edge').addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete();
        });

        return menu;
    }

    delete() {
        console.log(`вы удалили ребро ${this.id}`)
        this.map.removeChild(this.feature);
        delete edges[this.id];
        
        // Отмечаем ребро как удаленное
        if (Controller && Controller.markEdgeDeleted) {
            Controller.markEdgeDeleted(this.id);
        }
    }

    updatePosition() {
        this.feature.update({
            geometry: {
                type: 'LineString',
                coordinates: [this.node1.coordinates, this.node2.coordinates]
            }
        });
        
        // Отмечаем ребро как измененное при изменении позиции
        if (Controller && Controller.markEdgeChanged) {
            Controller.markEdgeChanged(this);
        }
    }
}

class MapInteraction {
    constructor(ymaps3, formHandler) {  
        // Сохраняем необходимые компоненты API
        this.ymaps3 = ymaps3;
        this.YMap = ymaps3.YMap;
        this.YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer;
        this.YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer;
        this.YMapLayer = ymaps3.YMapLayer;
        this.YMapFeatureDataSource = ymaps3.YMapFeatureDataSource;
        this.YMapListener = ymaps3.YMapListener;
        this.formHandler = formHandler;
        console.log('FormHandler initialized');
        // Инициализация карты
        this.map = new this.YMap(document.getElementById('map'), {
            location: {
                center: [37.6176, 55.7558],
                zoom: 12
            }
        });
    }

    init() {
        this.initSourcesAndLayers();
        this.initClickListener();
        this.EdgeFormSubmitEventHandler()
        this.NodeFormSubmitEventHandler()
    }

    initSourcesAndLayers() {
        // Для узлов
        const markerSource = new this.YMapFeatureDataSource({ id: 'my-markers' });
        const markerLayer = new this.YMapLayer({
            type: 'markers',
            source: 'my-markers',
            pointerEvents: 'auto',
            zIndex: 3500
        });

         // Для рёбер
        const edgeSource = new this.YMapFeatureDataSource({ id: 'edges' });
        const edgeLayer = new this.YMapLayer({
            type: 'features',
            source: 'edges',
            zIndex: 3000
        });
        
        this.map.addChild(new this.YMapDefaultSchemeLayer());
        this.map.addChild(new this.YMapDefaultFeaturesLayer());
        this.map.addChild(markerSource);
        this.map.addChild(markerLayer);
        this.map.addChild(edgeSource);
        this.map.addChild(edgeLayer);
    }

    initClickListener() {
        this.listener = new this.YMapListener({
            layer: 'any',
            onClick: (_, event) => this.handleMapClick(event)
        });
        this.map.addChild(this.listener);
    }

    handleMapClick(event) {
        if (!event) return;
        
        // Передаем API в конструктор Node
        const existingNodeIds = Object.keys(nodes).map(id => parseInt(id, 10));
        const newNodeId = existingNodeIds.length > 0 ? Math.max(...existingNodeIds) + 1 : 1;
        
        const newNode = new Node(
            event.coordinates, 
            newNodeId, 
            this.map, 
            this.ymaps3, 
            this.formHandler,
            `Узел ${newNodeId}`, // Устанавливаем базовое имя
            '', // Пустое описание
            0   // Базовое значение z-координаты
        );
        
        nodes[newNodeId] = newNode;
        
        // Node constructor already adds new node to tracking

        console.log('Создан новый узел при клике на карту:', newNode);
        
        // Используем FormHandler для обновления формы
        this.formHandler.setNodeCoords(event.coordinates);
        // Устанавливаем имя узла в форме
        this.formHandler.nodeName.value = `Узел ${newNodeId}`;
    }

    EdgeFormSubmitEventHandler() {
        this.formHandler.edgeSubmit.addEventListener('click', (e) => {
            e.stopPropagation()
            e.preventDefault();
            console.log('Начало обработки формы ребра');
        
            const node1Id = this.formHandler.node1Select.value;
            const node2Id = this.formHandler.node2Select.value;
            
            if (!node1Id || !node2Id) {
                alert('Выберите оба узла!');
                return;
            }
            
            const node1 = nodes[node1Id];
            const node2 = nodes[node2Id];
    
            if (!node1 || !node2) {
                alert('Один или оба узла не найдены!');
                return;
            }
    
            if (node1.id === node2.id) {
                alert('Нельзя соединить узел сам с собой!');
                return;
            }
            
            // Проверка дублирования ребра
            const duplicateEdge = Object.values(edges).find(edge => 
                (edge.node1.id === node1.id && edge.node2.id === node2.id) || 
                (edge.node1.id === node2.id && edge.node2.id === node1.id)
            );
            
            if (duplicateEdge) {
                alert('Эти узлы уже соединены!');
                return;
            }

            const existingEdgeIds = Object.keys(edges).map(id => parseInt(id, 10));
            const newEdgeId = existingEdgeIds.length > 0 ? Math.max(...existingEdgeIds) + 1 : 1;
            const newEdge = new Edge(
                newEdgeId,
                node1,
                node2,
                this.map,
                this.ymaps3,
                this.formHandler
            );
    
            edges[newEdgeId] = newEdge;
            console.log('Создано новое ребро через форму:', newEdge);
            
            // Очищаем форму
            this.formHandler.node1Select.value = '';
            this.formHandler.node2Select.value = '';
        });
    }
    NodeFormSubmitEventHandler() {
        this.formHandler.nodeSubmit.addEventListener('click', (e) => {
            e.stopPropagation()
            e.preventDefault();
            console.log('Начало обработки формы узла');
        
            const name = this.formHandler.nodeName.value
            const lat = parseFloat(this.formHandler.latitudeInput.value)
            const lon = parseFloat(this.formHandler.longitudeInput.value)
            const desc = this.formHandler.nodeDesc.value
            const z_coord = parseFloat(this.formHandler.nodeZ_coord.value) || 0
             
            if (isNaN(lat) || isNaN(lon)) {
                alert('Пожалуйста, введите корректные координаты!');
                return;
            }

            const existingNodeIds = Object.keys(nodes).map(id => parseInt(id, 10));
            const newNodeId = existingNodeIds.length > 0 ? Math.max(...existingNodeIds) + 1 : 1;
             
            const newNode = new Node(
                [lon, lat], 
                newNodeId, 
                this.map, 
                this.ymaps3, 
                this.formHandler,
                name,
                desc,
                z_coord,
            );
            nodes[newNodeId] = newNode;

            console.log('Создан новый узел через форму:', newNode);
            
            // Очищаем форму
            this.formHandler.nodeName.value = '';
            this.formHandler.nodeDesc.value = '';
            this.formHandler.nodeZ_coord.value = '';
        });
    }

    destroy() {
        if (this.listener) {
            this.map.removeChild(this.listener);
            this.listener = null;
        }
    }
}

 
 
async function initMap() {
    console.log("initMap called");
    await ymaps3.ready;
     
    const formHandler = new FormHandler();
    
    // Передаем зависимости в MapInteraction
    const interaction = new MapInteraction(ymaps3, formHandler, nodes, edges);
    Controller = new DatabaseController(formHandler);
    interaction.init();
    Controller.map = interaction.map;
    Controller.ymaps3 = interaction.ymaps3;
    Controller.GetCurrentData();
    document.querySelector('button[name="save_changes"]').addEventListener('click', (e) => {
        Controller.UpdateData();
    })
}

initMap();