export { DatabaseController }

import { nodes, edges, mapId } from './edit_map.js';

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

        // Очередь для новых ребер, которые нужно создать после сохранения вершин
        this.pendingEdges = [];
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
        
        // Логирование состояния изменений
        console.log('Текущее состояние изменений:', {
            newNodes: this.changes.newNodes.length,
            changedNodes: Object.keys(this.changes.changedNodes).length,
            deletedNodeIds: this.changes.deletedNodeIds.length,
            newEdges: this.changes.newEdges.length,
            changedEdges: Object.keys(this.changes.changedEdges).length,
            deletedEdgeIds: this.changes.deletedEdgeIds.length
        });
        
        // Подробное логирование новых ребер для диагностики
        if (this.changes.newEdges.length > 0) {
            console.log('Содержимое новых ребер:');
            this.changes.newEdges.forEach((edge, index) => {
                console.log(`Ребро ${index}:`, JSON.stringify(edge));
            });
        }
        
        // Готовим данные для PATCH-запроса
        const mapData = {};
        
        // Сохраняем ребра, чтобы отправить их после обработки узлов
        this.pendingNewEdges = [...this.changes.newEdges];
        
        // Добавляем новые узлы
        if (this.changes.newNodes.length > 0) {
            console.log(`Подготовка ${this.changes.newNodes.length} новых узлов`);
            mapData.new_nodes = this.changes.newNodes.map(node => {
                const nodeData = {
                    name: node.name || '',
                    longitude: node.longitude || (node.coordinates && node.coordinates[0]) || 0,
                    latitude: node.latitude || (node.coordinates && node.coordinates[1]) || 0,
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
                    longitude: node.longitude || (node.coordinates && node.coordinates[0]) || 0,
                    latitude: node.latitude || (node.coordinates && node.coordinates[1]) || 0,
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
        
        // Если есть новые ребра, добавляем их непосредственно в первый запрос
        if (this.changes.newEdges.length > 0) {
            console.log(`Подготовка ${this.changes.newEdges.length} новых ребер`);
            mapData.new_edges = this.changes.newEdges.map(edge => {
                // Проверка структуры объекта ребра
                let node1Id, node2Id;
                
                // Определяем, является ли edge.node1 объектом с ID или просто ID
                if (typeof edge.node1 === 'object' && edge.node1 !== null) {
                    node1Id = edge.node1.id;
                } else {
                    node1Id = edge.node1;
                }
                
                // Определяем, является ли edge.node2 объектом с ID или просто ID
                if (typeof edge.node2 === 'object' && edge.node2 !== null) {
                    node2Id = edge.node2.id;
                } else {
                    node2Id = edge.node2;
                }
                
                const edgeData = {
                    node1: node1Id,
                    node2: node2Id
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
            
            // Если есть карта соответствия ID и новые ребра для создания
            if (updatedData.client_index_map && this.pendingNewEdges && this.pendingNewEdges.length > 0) {
                console.log('Найдена карта соответствия ID, обрабатываем ожидающие ребра');
                this.sendEdgesAfterNodeUpdate(updatedData.client_index_map);
            } else {
                // Если нет новых ребер, завершаем процесс
                this.finalizeUpdate();
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении:', error);
            console.timeEnd('PATCH запрос');
            console.groupEnd();
            alert('Ошибка при сохранении карты: ' + error.message);
        });
    }

    // Метод для отправки ребер после обновления узлов
    sendEdgesAfterNodeUpdate(clientIndexMap) {
        console.group('Отправка новых ребер после обновления узлов');
        console.log('Карта соответствия ID клиента и сервера:', clientIndexMap);
        
        // Только если есть ребра для создания
        if (!this.pendingNewEdges || this.pendingNewEdges.length === 0) {
            console.log('Нет ожидающих ребер для создания');
            console.groupEnd();
            this.finalizeUpdate();
            return;
        }
        
        console.log(`Подготовка ${this.pendingNewEdges.length} новых ребер с обновленными ID узлов`);
        console.log('Исходные ребра перед обработкой:', JSON.stringify(this.pendingNewEdges));
        
        // Исправленный подход для преобразования клиентских ID в серверные
        const edgesWithUpdatedIds = this.pendingNewEdges.map(edge => {
            console.log(`Обработка ребра: id=${edge.id}, node1=${edge.node1}, node2=${edge.node2}`);
            
            const node1Id = edge.node1;
            const node2Id = edge.node2;
            
            // Базовая проверка перед преобразованием
            if (node1Id === node2Id) {
                console.error(`Ошибка: исходные ID узлов совпадают (${node1Id})`);
                return null;
            }
            
            // Несколько способов найти соответствие ID в карте
            // 1. Прямой поиск ID
            // 2. Если узел уже был в начальных данных
            // 3. Проверка, не является ли этот узел только что созданным
            let node1ServerId = null;
            let node2ServerId = null;
            
            // Для узла 1
            if (clientIndexMap[node1Id] !== undefined) {
                // Прямое соответствие в карте
                node1ServerId = clientIndexMap[node1Id];
                console.log(`Узел node1=${node1Id} -> ${node1ServerId} (прямое соответствие)`);
            } else if (this.initialNodeIds.has(parseInt(node1Id))) {
                // Уже существующий узел
                node1ServerId = parseInt(node1Id);
                console.log(`Узел node1=${node1Id} уже существует на сервере`);
            } else {
                // Поиск по всем ключам - возможно ID появилось в другом месте карты
                let foundInMap = false;
                for (const [clientId, serverId] of Object.entries(clientIndexMap)) {
                    if (parseInt(serverId) === parseInt(node1Id)) {
                        node1ServerId = parseInt(serverId);
                        console.log(`Узел node1=${node1Id} найден как значение в карте (${clientId} -> ${serverId})`);
                        foundInMap = true;
                        break;
                    }
                }
                
                if (!foundInMap && node1ServerId === null) {
                    // Возможно этот узел был создан в этой же операции
                    Object.values(nodes).forEach(node => {
                        if (node.id === parseInt(node1Id) && node1ServerId === null) {
                            // Проверим все значения в карте - возможно это новый узел
                            const possibleServerIds = Object.values(clientIndexMap).map(id => parseInt(id));
                            for (const serverId of possibleServerIds) {
                                // Если узла с ID=serverId нет в глобальном объекте узлов, 
                                // но он есть в ответе сервера, это может быть наш узел
                                if (!this.initialNodeIds.has(serverId) && !nodes[serverId]) {
                                    node1ServerId = serverId;
                                    console.log(`Предполагаем, что узел node1=${node1Id} соответствует ${serverId}`);
                                    break;
                                }
                            }
                        }
                    });
                }
                
                if (node1ServerId === null) {
                    console.warn(`Не найден серверный ID для узла node1=${node1Id}`);
                    return null; // Пропускаем это ребро, если не можем сопоставить ID
                }
            }
            
            // Для узла 2 - аналогичная логика
            if (clientIndexMap[node2Id] !== undefined) {
                // Прямое соответствие в карте
                node2ServerId = clientIndexMap[node2Id];
                console.log(`Узел node2=${node2Id} -> ${node2ServerId} (прямое соответствие)`);
            } else if (this.initialNodeIds.has(parseInt(node2Id))) {
                // Уже существующий узел
                node2ServerId = parseInt(node2Id);
                console.log(`Узел node2=${node2Id} уже существует на сервере`);
            } else {
                // Поиск по всем ключам - возможно ID появилось в другом месте карты
                let found2InMap = false;
                for (const [clientId, serverId] of Object.entries(clientIndexMap)) {
                    if (parseInt(serverId) === parseInt(node2Id)) {
                        node2ServerId = parseInt(serverId);
                        console.log(`Узел node2=${node2Id} найден как значение в карте (${clientId} -> ${serverId})`);
                        found2InMap = true;
                        break;
                    }
                }
                
                if (!found2InMap && node2ServerId === null) {
                    // Возможно этот узел был создан в этой же операции
                    Object.values(nodes).forEach(node => {
                        if (node.id === parseInt(node2Id) && node2ServerId === null) {
                            // Проверим все значения в карте - возможно это новый узел
                            const possibleServerIds = Object.values(clientIndexMap).map(id => parseInt(id));
                            for (const serverId of possibleServerIds) {
                                // Если узла с ID=serverId нет в глобальном объекте узлов, 
                                // но он есть в ответе сервера, это может быть наш узел
                                if (!this.initialNodeIds.has(serverId) && !nodes[serverId]) {
                                    node2ServerId = serverId;
                                    console.log(`Предполагаем, что узел node2=${node2Id} соответствует ${serverId}`);
                                    break;
                                }
                            }
                        }
                    });
                }
                
                if (node2ServerId === null) {
                    console.warn(`Не найден серверный ID для узла node2=${node2Id}`);
                    return null; // Пропускаем это ребро, если не можем сопоставить ID
                }
            }
            
            // Преобразуем к числовому типу для уверенности
            node1ServerId = parseInt(node1ServerId, 10);
            node2ServerId = parseInt(node2ServerId, 10);
            
            // Подробное логирование преобразования
            console.log(`Результат преобразования: ${node1Id} -> ${node1ServerId}, ${node2Id} -> ${node2ServerId}`);
            
            // Проверяем, что узлы не совпадают
            if (node1ServerId === node2ServerId) {
                console.error(`Ошибка: нельзя создать ребро от узла к самому себе (ID: ${node1ServerId})`);
                return null;
            }
            
            // Создаем объект для отправки
            const result = {
                node1: node1ServerId,
                node2: node2ServerId
            };
            
            console.log(`Итоговое ребро для отправки:`, result);
            return result;
        })
        // Фильтруем рёбра, идущие из узла в сам себя или некорректные
        .filter(edge => edge !== null);
        
        // Если после фильтрации нет ребер, завершаем процесс
        if (edgesWithUpdatedIds.length === 0) {
            console.warn('После валидации не осталось корректных ребер для создания');
            console.groupEnd();
            this.finalizeUpdate();
            return;
        }
        
        console.log('Ребра с обновленными ID узлов (итог):', JSON.stringify(edgesWithUpdatedIds));
        
        // Подготавливаем данные для запроса
        const edgeData = {
            new_edges: edgesWithUpdatedIds
        };
        
        // Отправляем PATCH-запрос только с ребрами
        const csrfToken = this.getCsrfToken();
        console.log('Отправка запроса для создания ребер:', JSON.stringify(edgeData));
        
        fetch(`/api/v1/maps/${mapId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(edgeData)
        })
        .then(response => {
            console.log(`Получен ответ HTTP ${response.status} ${response.statusText}`);
            if (!response.ok) {
                console.error('Ошибка HTTP при создании ребер:', response.status);
                return response.text().then(text => {
                    console.error('Ответ сервера:', text);
                    throw new Error(`Ошибка создания ребер: ${text}`);
                });
            }
            return response.json();
        })
        .then(updatedData => {
            console.log('Ответ сервера после создания ребер (полный):', JSON.stringify(updatedData));
            if (updatedData.edges) {
                console.log('Созданные ребра на сервере:', JSON.stringify(updatedData.edges));
                updatedData.edges.forEach(edge => {
                    console.log(`Проверка ребра #${edge.id}: node1=${edge.node1}, node2=${edge.node2}`);
                    if (edge.node1 === edge.node2) {
                        console.error(`ОШИБКА! Сервер вернул ребро с одинаковыми узлами: ${JSON.stringify(edge)}`);
                    }
                });
            }
            console.log(`Создано ребер: ${updatedData.edges ? updatedData.edges.length : 0}`);
            
            // Завершаем обновление
            this.finalizeUpdate();
            
            console.groupEnd();
        })
        .catch(error => {
            console.error('Ошибка при создании ребер:', error);
            console.groupEnd();
            alert('Ошибка при создании ребер: ' + error.message);
            
            // Даже при ошибке создания ребер завершаем процесс обновления узлов
            this.finalizeUpdate();
        });
    }

    // Метод для завершения процесса обновления
    finalizeUpdate() {
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
    }

    // Обновляет локальные ID после сохранения на сервере
    updateLocalIdsAfterSave(serverData) {
        // Обрабатываем сохраненные узлы
        if (serverData.nodes) {
            this.handleSavedNodes(serverData.nodes);
        }

        // Обновляем ID узлов и ребер
        if (serverData.nodes) {
            serverData.nodes.forEach(node => {
                if (nodes[node.temp_id]) {
                    const oldNode = nodes[node.temp_id];
                    delete nodes[node.temp_id];
                    nodes[node.id] = oldNode;
                    oldNode.id = node.id;
                }
            });
        }

        if (serverData.edges) {
            serverData.edges.forEach(edge => {
                if (edges[edge.temp_id]) {
                    const oldEdge = edges[edge.temp_id];
                    delete edges[edge.temp_id];
                    edges[edge.id] = oldEdge;
                    oldEdge.id = edge.id;
                }
            });
        }
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
                // Создаем объект данных для нового ребра
                const newEdgeData = {
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id
                };
                
                // Проверка на совпадение узлов
                if (newEdgeData.node1 === newEdgeData.node2) {
                    console.error(`ОШИБКА: Попытка добавить некорректное ребро ${edge.id} с совпадающими узлами (node1=${newEdgeData.node1}, node2=${newEdgeData.node2})`);
                    return; // Не добавляем некорректное ребро
                }
                
                console.log(`Добавление нового ребра в список изменений:`, newEdgeData);
                
                // Добавляем ребро в список новых ребер
                this.changes.newEdges.push(newEdgeData);
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

    // Добавляем новый метод для обработки сохраненных узлов
    handleSavedNodes(savedNodes) {
        // Создаем карту для быстрого поиска узлов по временному ID
        const tempIdToServerId = new Map();
        savedNodes.forEach(node => {
            tempIdToServerId.set(node.temp_id, node.id);
        });

        // Обрабатываем отложенные ребра
        const remainingEdges = [];
        this.pendingEdges.forEach(edgeData => {
            const node1ServerId = tempIdToServerId.get(edgeData.node1.id);
            const node2ServerId = tempIdToServerId.get(edgeData.node2.id);

            if (node1ServerId && node2ServerId) {
                // Если оба узла сохранены, создаем ребро
                const existingEdgeIds = Object.keys(edges).map(id => parseInt(id, 10));
                const newEdgeId = existingEdgeIds.length > 0 ? Math.max(...existingEdgeIds) + 1 : 1;
                
                const newEdge = new Edge(
                    newEdgeId,
                    nodes[node1ServerId],
                    nodes[node2ServerId],
                    this.map,
                    this.ymaps3,
                    this.formHandler
                );
                
                edges[newEdgeId] = newEdge;
                this.addNewEdge(newEdge);
                console.log('Создано отложенное ребро:', newEdge);
            } else {
                // Если хотя бы один узел еще не сохранен, оставляем ребро в очереди
                remainingEdges.push(edgeData);
            }
        });

        // Обновляем очередь отложенных ребер
        this.pendingEdges = remainingEdges;
    }
}