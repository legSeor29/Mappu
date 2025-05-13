export { DatabaseController }

import { 
    getNodes, 
    getEdges, 
    getMapId, 
    resetNodesAndEdges, 
    getController 
} from './store.js';
import { Node } from './node.js';
import { Edge } from './edge.js';

class DatabaseController {
    constructor(formHandler) {   
        this.formHandler = formHandler;
        this.map = null;  
        this.ymaps3 = null;
        
        this.initialNodeIds = new Set();
        this.initialEdgeIds = new Set();
        
        this.resetChanges();
        
        this.autoSaveInterval = null;
        this.enableAutoSave = false;

        this.pendingEdges = [];
    }
    GetCurrentData() {
        console.log('Поиск карты...')
        fetch(`/api/v1/maps/${getMapId()}`)
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
        
        resetNodesAndEdges();
        const nodes = getNodes();
        const edges = getEdges();
        
        this.initialNodeIds = new Set();
        this.initialEdgeIds = new Set();
        
        document.getElementById('mapId')._loadingData = true;

        try {
            for (const node of data.nodes) {
                this.initialNodeIds.add(node.id);
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
                nodes[node.id] = newNode;
                console.log(`Узел ${node.id} загружен из базы данных`);
            }
            
            for (const edge of data.edges) {
                this.initialEdgeIds.add(edge.id);
                if (nodes[edge.node1] && nodes[edge.node2]) {
                    const newEdge = new Edge(
                        edge.id,
                        nodes[edge.node1],
                        nodes[edge.node2],
                        this.map,
                        this.ymaps3,
                        this.formHandler
                    );
                    
                    // Применяем стили ребра, если они есть
                    if (edge.style) {
                        newEdge.style = edge.style;
                        // Обновляем dashStyle на основе lineStyle из полученных данных
                        newEdge.updateDashStyle();
                        // Обновляем отображение ребра с новыми стилями
                        newEdge.updateStyle();
                        console.log(`Стили применены к ребру ${edge.id}:`, edge.style);
                    }
                    
                    edges[edge.id] = newEdge;
                    console.log(`Ребро ${edge.id} загружено из базы данных`);
                } else {
                    console.warn(`Невозможно загрузить ребро ${edge.id}: один или оба узла не найдены`);
                }
            }
            
            this.resetChanges();
            
            console.log('Текущие данные заполнены');
            console.log('Отслеживаемые начальные ID узлов:', this.initialNodeIds);
            console.log('Отслеживаемые начальные ID рёбер:', this.initialEdgeIds);
            console.log(nodes, edges);
        } catch (error) {
            console.error("Ошибка при получении данных:", error);
        } finally {
            document.getElementById('mapId')._loadingData = false;
            // Populate dropdowns after initial load
            this.formHandler.populateNodeDropdowns(); 
        }
    }

    UpdateData() {
        if (this.hasChanges()) {
            console.log('Обнаружены изменения, используем PATCH запрос');
            this.sendPatchRequest();
        } else {
            console.log('Изменения не обнаружены, используем полный PUT запрос');
            this.sendPutRequest();
        }
    }

    sendPutRequest() {
        console.group('Отправка PUT-запроса');
        console.time('PUT запрос');
        const nodes = getNodes();
        const edges = getEdges();
        
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
                node2: edge.node2.id,
                style: edge.style || {
                    color: "#1DA1F2",
                    width: 3,
                    lineStyle: "solid",
                    opacity: 1
                }
            }))
        };

        console.log(`Подготовлено узлов: ${dataToSend.nodes.length}, ребер: ${dataToSend.edges.length}`);
        console.log('Отправляемые данные (PUT):', JSON.stringify(dataToSend, null, 2));

        const csrfToken = this.getCsrfToken();
        console.log(`Отправка запроса на /api/v1/maps/${getMapId()}/ с CSRF токеном: ${csrfToken.substring(0, 5)}...`);

        fetch(`/api/v1/maps/${getMapId()}/`, {
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
            
            this.updateLocalIdsAfterSave(updatedData);
            
            console.log('Обновление списка начальных ID узлов и ребер');
            Object.values(getNodes()).forEach(node => {
                this.initialNodeIds.add(node.id);
            });
            
            Object.values(getEdges()).forEach(edge => {
                this.initialEdgeIds.add(edge.id);
            });
            
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
    
    sendPatchRequest() {
        console.group('Отправка PATCH-запроса');
        console.time('PATCH запрос');
        const nodes = getNodes();
        
        console.log('Текущее состояние изменений:', {
            newNodes: this.changes.newNodes.length,
            changedNodes: Object.keys(this.changes.changedNodes).length,
            deletedNodeIds: this.changes.deletedNodeIds.length,
            newEdges: this.changes.newEdges.length,
            changedEdges: Object.keys(this.changes.changedEdges).length,
            deletedEdgeIds: this.changes.deletedEdgeIds.length
        });
        
        if (this.changes.newEdges.length > 0) {
            console.log('Содержимое новых ребер:');
            this.changes.newEdges.forEach((edge, index) => {
                console.log(`Ребро ${index}:`, JSON.stringify(edge));
            });
        }
        
        const mapData = {};
        this.pendingEdges = [...this.changes.newEdges];
        
        if (this.changes.newNodes.length > 0) {
            console.log(`Подготовка ${this.changes.newNodes.length} новых узлов`);
            mapData.new_nodes = this.changes.newNodes.map(node => ({
                name: node.name || '',
                longitude: node.longitude || (node.coordinates && node.coordinates[0]) || 0,
                latitude: node.latitude || (node.coordinates && node.coordinates[1]) || 0,
                description: node.description || '',
                z_coordinate: node.z_coordinate || 0,
                temp_id: node.id
            }));
        }
        
        if (Object.keys(this.changes.changedNodes).length > 0) {
            console.log(`Подготовка ${Object.keys(this.changes.changedNodes).length} измененных узлов`);
            mapData.changed_nodes = Object.values(this.changes.changedNodes).map(node => ({
                id: node.id,
                name: node.name || '',
                longitude: node.longitude || (node.coordinates && node.coordinates[0]) || 0,
                latitude: node.latitude || (node.coordinates && node.coordinates[1]) || 0,
                description: node.description || '',
                z_coordinate: node.z_coordinate || 0
            }));
        }
        
        if (this.changes.deletedNodeIds.length > 0) {
            console.log(`Подготовка ${this.changes.deletedNodeIds.length} удаленных узлов: ${JSON.stringify(this.changes.deletedNodeIds)}`);
            mapData.deleted_node_ids = this.changes.deletedNodeIds;
        }
        
        if (this.changes.newEdges.length > 0) {
            console.log(`Подготовка ${this.changes.newEdges.length} новых ребер`);
            mapData.new_edges = this.changes.newEdges.map(edge => ({
                node1: typeof edge.node1 === 'object' ? edge.node1.id : edge.node1,
                node2: typeof edge.node2 === 'object' ? edge.node2.id : edge.node2,
                style: edge.style || {
                    color: "#1DA1F2",
                    width: 3,
                    lineStyle: "solid",
                    opacity: 1
                }
            }));
        }
        
        if (Object.keys(this.changes.changedEdges).length > 0) {
            console.log(`Подготовка ${Object.keys(this.changes.changedEdges).length} измененных ребер`);
            
            // Выводим текущие объекты для отладки
            console.log('Объекты измененных ребер:', this.changes.changedEdges);
            
            mapData.changed_edges = Object.values(this.changes.changedEdges).map(edge => {
                // Создаем промежуточный объект для отладки
                const edgeData = {
                    id: edge.id,
                    node1: typeof edge.node1 === 'object' ? edge.node1.id : edge.node1,
                    node2: typeof edge.node2 === 'object' ? edge.node2.id : edge.node2,
                    style: edge.style || {
                        color: "#1DA1F2",
                        width: 3,
                        lineStyle: "solid",
                        opacity: 1
                    }
                };
                
                // Логируем подготовленные данные для каждого ребра
                console.log(`Подготовленное измененное ребро #${edge.id}:`, edgeData);
                
                return edgeData;
            });
        }
        
        if (this.changes.deletedEdgeIds.length > 0) {
            console.log(`Подготовка ${this.changes.deletedEdgeIds.length} удаленных ребер: ${JSON.stringify(this.changes.deletedEdgeIds)}`);
            mapData.deleted_edge_ids = this.changes.deletedEdgeIds;
        }

        // Проверяем и исправляем данные ребер перед отправкой
        if (mapData.changed_edges && mapData.changed_edges.length > 0) {
            // Для каждого ребра проверяем наличие полей node1 и node2
            mapData.changed_edges.forEach(edge => {
                const edgeObj = getEdges()[edge.id];
                if (edgeObj) {
                    // Если поля отсутствуют, извлекаем их из объекта Edge
                    if (!edge.node1 && edgeObj.node1) {
                        edge.node1 = edgeObj.node1.id;
                        console.log(`Восстановлено поле node1 для ребра ${edge.id}: ${edge.node1}`);
                    }
                    if (!edge.node2 && edgeObj.node2) {
                        edge.node2 = edgeObj.node2.id;
                        console.log(`Восстановлено поле node2 для ребра ${edge.id}: ${edge.node2}`);
                    }
                }
            });
            console.log('Проверка и исправление данных завершены:', mapData.changed_edges);
        }

        // Расширенное логирование перед отправкой запроса
        console.group('Содержимое запроса');
        console.log('Полные данные измененных ребер:', this.changes.changedEdges);
        console.log('Преобразованные данные для запроса:', mapData.changed_edges);
        console.log('Строка JSON для отправки:', JSON.stringify(mapData, null, 2));
        console.groupEnd();

        console.log('Итоговые данные для PATCH-запроса:', JSON.stringify(mapData, null, 2));
        
        if (Object.keys(mapData).length === 0) {
            console.warn('Нет изменений для отправки в PATCH-запросе');
            console.timeEnd('PATCH запрос');
            console.groupEnd();
            alert('Нет изменений для сохранения.');
            return;
        }

        const csrfToken = this.getCsrfToken();
        console.log(`Отправка запроса на /api/v1/maps/${getMapId()}/ с CSRF токеном: ${csrfToken.substring(0, 5)}...`);
        
        fetch(`/api/v1/maps/${getMapId()}/`, {
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

            const clientIndexMap = updatedData.client_index_map;
            const pendingEdgesToSend = [...this.pendingEdges];

            // Clear pending edges now that we have the map
            this.pendingEdges = [];

            // Update local node IDs first (important for consistency if edge creation fails)
            this.updateLocalIdsAfterSave(updatedData);

            if (clientIndexMap && pendingEdgesToSend.length > 0) {
                console.log('Найдена карта соответствия ID, обрабатываем ожидающие ребра');
                // Process edges using the map BEFORE updating local IDs
                this.processAndSendPendingEdges(clientIndexMap, pendingEdgesToSend); 
            } else {
                // No pending edges or no map, just finalize
                this.finalizeUpdate();
            }
        })
        .catch(error => {
            console.error('Ошибка при обновлении узлов (PATCH):', error);
            // Reset pending edges if node update failed
            this.pendingEdges = [];
            console.timeEnd('PATCH запрос');
            console.groupEnd();
            alert('Ошибка при сохранении узлов: ' + error.message);
        });
    }

    // New function to handle processing and sending pending edges
    processAndSendPendingEdges(clientIndexMap, pendingEdges) {
        console.group('Обработка и отправка ожидающих ребер');
        console.log('Карта соответствия ID клиента и сервера:', clientIndexMap);
        const nodes = getNodes(); // Needed for checks? Maybe not if map is reliable.

        if (!pendingEdges || pendingEdges.length === 0) {
            console.log('Нет ожидающих ребер для создания');
            console.groupEnd();
            this.finalizeUpdate(); // Finalize here if called with no edges
            return;
        }

        console.log(`Подготовка ${pendingEdges.length} новых ребер с обновленными ID узлов`);
        console.log('Исходные ребра перед обработкой:', JSON.stringify(pendingEdges));

        const edgesWithServerIds = pendingEdges.map(edge => {
            // Get original temporary client IDs
            const clientNode1Id = typeof edge.node1 === 'object' ? edge.node1.id : edge.node1;
            const clientNode2Id = typeof edge.node2 === 'object' ? edge.node2.id : edge.node2;

            console.log(`Обработка ребра: clientNode1=${clientNode1Id}, clientNode2=${clientNode2Id}`);

            let node1ServerId = null;
            let node2ServerId = null;

            // --- Simplified ID lookup using clientIndexMap ---
            if (clientIndexMap[clientNode1Id] !== undefined) {
                node1ServerId = clientIndexMap[clientNode1Id];
                console.log(`Узел node1=${clientNode1Id} -> ${node1ServerId} (из карты)`);
            } else if (this.initialNodeIds.has(parseInt(clientNode1Id))) {
                 // Node already existed, use its original ID
                node1ServerId = parseInt(clientNode1Id);
                 console.log(`Узел node1=${clientNode1Id} уже существует на сервере`);
            } else {
                 console.warn(`Не найден серверный ID для узла node1=${clientNode1Id} в карте соответствия`);
                 return null; // Cannot create edge if node ID mapping is missing
            }

            if (clientIndexMap[clientNode2Id] !== undefined) {
                node2ServerId = clientIndexMap[clientNode2Id];
                console.log(`Узел node2=${clientNode2Id} -> ${node2ServerId} (из карты)`);
            } else if (this.initialNodeIds.has(parseInt(clientNode2Id))) {
                 // Node already existed, use its original ID
                node2ServerId = parseInt(clientNode2Id);
                 console.log(`Узел node2=${clientNode2Id} уже существует на сервере`);
            } else {
                 console.warn(`Не найден серверный ID для узла node2=${clientNode2Id} в карте соответствия`);
                 return null; // Cannot create edge if node ID mapping is missing
            }
            // --- End Simplified ID lookup ---


            if (node1ServerId === null || node2ServerId === null) {
                 console.error(`Не удалось определить серверные ID для ребра: ${clientNode1Id} -> ${node1ServerId}, ${clientNode2Id} -> ${node2ServerId}`);
                 return null;
            }
            
            node1ServerId = parseInt(node1ServerId, 10);
            node2ServerId = parseInt(node2ServerId, 10);

            if (node1ServerId === node2ServerId) {
                console.error(`Ошибка: нельзя создать ребро от узла к самому себе (ID: ${node1ServerId})`);
                return null;
            }

            const result = {
                node1: node1ServerId,
                node2: node2ServerId,
                temp_id: edge.id
            };

            // Добавляем поле style, если оно есть
            if (edge.style) {
                result.style = edge.style;
            }

            console.log(`Итоговое ребро для отправки:`, result);
            return result;

        }).filter(edge => edge !== null);

        if (edgesWithServerIds.length === 0) {
            console.warn('После валидации не осталось корректных ребер для создания');
            console.groupEnd();
            this.finalizeUpdate(); // Finalize here as well
            return;
        }

        console.log('Ребра с обновленными ID узлов (итог):', JSON.stringify(edgesWithServerIds));

        const edgeData = {
            new_edges: edgesWithServerIds
            // Important: Only send new_edges, not other changes again
        };

        const csrfToken = this.getCsrfToken();
        console.log('Отправка отдельного PATCH-запроса для создания ребер:', JSON.stringify(edgeData));

        fetch(`/api/v1/maps/${getMapId()}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(edgeData)
        })
        .then(response => {
            console.log(`Получен ответ HTTP ${response.status} ${response.statusText} (создание ребер)`);
            if (!response.ok) {
                console.error('Ошибка HTTP при создании ребер:', response.status);
                return response.text().then(text => {
                    console.error('Ответ сервера (ошибка ребер):', text);
                    throw new Error(`Ошибка создания ребер: ${text}`);
                });
            }
            return response.json();
        })
        .then(edgeUpdateResponse => {
             console.log('Ответ сервера после создания ребер:', edgeUpdateResponse);
             // Update local edge IDs if necessary (server might return edge IDs)
             this.updateLocalIdsAfterSave(edgeUpdateResponse); // Reuse function if it handles edges too

             console.log(`Создано ребер на сервере: ${edgeUpdateResponse.edges ? edgeUpdateResponse.edges.length : 0}`);
             this.finalizeUpdate(); // Finalize after successful edge creation
             console.groupEnd();
        })
        .catch(error => {
            console.error('Ошибка при создании ребер (PATCH):', error);
            // Maybe try finalizeUpdate anyway to reset state? Or leave changes pending?
            // For now, just log and finalize to avoid inconsistent state.
            this.finalizeUpdate(); 
            console.groupEnd();
            alert('Ошибка при сохранении ребер: ' + error.message);
        });
    }

    finalizeUpdate() {
        console.log('Обновление списка начальных ID узлов и ребер');
        Object.values(getNodes()).forEach(node => {
            this.initialNodeIds.add(node.id);
        });
        Object.values(getEdges()).forEach(edge => {
            this.initialEdgeIds.add(edge.id);
        });
        this.resetChanges();
        // Populate dropdowns after successful update and change reset
        this.formHandler.populateNodeDropdowns(); 
        console.log('Размер начальных ID после обновления:', {
            nodes: this.initialNodeIds.size,
            edges: this.initialEdgeIds.size
        });
        console.timeEnd('PATCH запрос');
        console.groupEnd();
        alert('Карта успешно сохранена!');
    }

    updateLocalIdsAfterSave(serverData) {
        const nodes = getNodes();
        const edges = getEdges();

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

    getCsrfToken() {
        return document.querySelector('input[name="csrfmiddlewaretoken"]')?.value || 
               document.cookie.split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1] || '';
    }
    
    resetChanges() {
        this.changes = {
            infoChanged: false,        
            newNodes: [],              
            changedNodes: {},          
            deletedNodeIds: [],        
            newEdges: [],              
            changedEdges: {},          
            deletedEdgeIds: []         
        };
        console.log('Изменения сброшены');
    }
    
    addNewNode(node) {
        if (!this.initialNodeIds.has(node.id)) {
            console.log(`Узел ${node.id} добавлен как новый`);
            const alreadyAdded = this.changes.newNodes.some(n => n.id === node.id);
            if (!alreadyAdded) {
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
    
    addNewEdge(edge) {
        if (!this.initialEdgeIds.has(edge.id)) {
            console.log(`Ребро ${edge.id} добавлено как новое`);
            const alreadyAdded = this.changes.newEdges.some(e => e.id === edge.id);
            if (!alreadyAdded) {
                const newEdgeData = {
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id,
                    style: edge.style || {
                        color: "#1DA1F2",
                        width: 3,
                        lineStyle: "solid",
                        opacity: 1
                    }
                };
                if (newEdgeData.node1 === newEdgeData.node2) {
                    console.error(`ОШИБКА: Попытка добавить некорректное ребро ${edge.id} с совпадающими узлами (node1=${newEdgeData.node1}, node2=${newEdgeData.node2})`);
                    return; 
                }
                console.log(`Добавление нового ребра в список изменений:`, newEdgeData);
                this.changes.newEdges.push(newEdgeData);
            }
        } else {
            console.log(`Ребро ${edge.id} уже существует в базе данных, не добавляем в новые`);
        }
    }
    
    markNodeChanged(node) {
        if (this.initialNodeIds.has(node.id)) {
            console.log(`Узел ${node.id} отмечен как измененный`)
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
                Object.assign(this.changes.changedNodes[node.id], {
                    name: node.name,
                    longitude: node.coordinates[0],
                    latitude: node.coordinates[1],
                    description: node.description,
                    z_coordinate: node.z_coordinate
                });
            }
        } else {
            this.addNewNode(node);
        }
    }
    
    markEdgeChanged(edge) {
        if (this.initialEdgeIds.has(edge.id)) {
            console.log(`Ребро ${edge.id} отмечено как измененное`)
            console.log(`Детали ребра:`, {
                id: edge.id,
                node1: edge.node1.id,
                node2: edge.node2.id,
                style: edge.style
            });
            
            if (!this.changes.changedEdges[edge.id]) {
                this.changes.changedEdges[edge.id] = {
                    id: edge.id,
                    node1: edge.node1.id,
                    node2: edge.node2.id,
                    style: edge.style || {
                        color: "#1DA1F2",
                        width: 3,
                        lineStyle: "solid",
                        opacity: 1
                    }
                };
                console.log(`Создан новый объект в changedEdges[${edge.id}]:`, this.changes.changedEdges[edge.id]);
            } else {
                console.log(`Обновляется существующий объект changedEdges[${edge.id}]:`, this.changes.changedEdges[edge.id]);
                Object.assign(this.changes.changedEdges[edge.id], {
                    node1: edge.node1.id,
                    node2: edge.node2.id,
                    style: edge.style || {
                        color: "#1DA1F2",
                        width: 3,
                        lineStyle: "solid",
                        opacity: 1
                    }
                });
                console.log(`После обновления changedEdges[${edge.id}]:`, this.changes.changedEdges[edge.id]);
            }
        } else {
            this.addNewEdge(edge);
        }
    }
    
    markNodeDeleted(nodeId) {
        if (!this.initialNodeIds.has(nodeId)) {
            this.changes.newNodes = this.changes.newNodes.filter(node => node.id !== nodeId);
            return;
        }
        delete this.changes.changedNodes[nodeId];
        if (!this.changes.deletedNodeIds.includes(nodeId)) {
            this.changes.deletedNodeIds.push(nodeId);
        }
        console.log(`Узел ${nodeId} отмечен как удаленный`);
    }
    
    markEdgeDeleted(edgeId) {
        if (!this.initialEdgeIds.has(edgeId)) {
            this.changes.newEdges = this.changes.newEdges.filter(edge => edge.id !== edgeId);
            return;
        }
        delete this.changes.changedEdges[edgeId];
        if (!this.changes.deletedEdgeIds.includes(edgeId)) {
            this.changes.deletedEdgeIds.push(edgeId);
        }
        console.log(`Ребро ${edgeId} отмечено как удаленное`);
    }
    
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