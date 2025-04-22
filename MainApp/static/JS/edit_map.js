let nodes = {};
let edges = {};
let selectedNodes = [];
const mapId = document.getElementById('mapId').innerText

class DatabaseController {
    constructor(formHandler) {   
        this.formHandler = formHandler;
        this.map = null;  
        this.ymaps3 = null;
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
        data.nodes.forEach(node => {
            const newNode = new Node(
                [node.longitude, node.latitude], 
                node.id, 
                this.map, 
                this.ymaps3, 
                this.formHandler,
                node.name,
                node.description,
                node.z_coordinate,
            );
            nodes[newNode.id] = newNode;
        })

        data.edges.forEach(edge => {
            const newEdge = new Edge(
                edge.id,
                nodes[edge.node1],
                nodes[edge.node2],
                this.map,
                this.ymaps3,
                this.formHandler
            );
            edges[newEdge.id] = newEdge
        })
        console.log('Текущие данные заполнены')
        console.log(nodes, edges)
    }

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

    // Обновляет локальные ID после сохранения на сервере
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
            this.name = menu.querySelector('.node-name').value; 
            this.description = menu.querySelector('.node-desc').value;
            this.z_coordinate = menu.querySelector('.node-z_cord').value; 
            this.formHandler.updateNodeOptions(this);
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
            this.formHandler.setCurrentEdge(this.id);
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
    }

    updatePosition() {
        this.feature.update({
            geometry: {
                type: 'LineString',
                coordinates: [this.node1.coordinates, this.node2.coordinates]
            }
        });
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