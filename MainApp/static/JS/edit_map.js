nodes = []
edges = []

class FormHandler {
    constructor() {
        this.latitudeInput = document.querySelector('.latitude');
        this.longitudeInput = document.querySelector('.longitude');
        this.node1Input = document.querySelector('.node1');
        this.node2Input = document.querySelector('.node2');
    }

    setNodeCoords(coords) {
        this.longitudeInput.value = coords[0].toFixed(6);
        this.latitudeInput.value = coords[1].toFixed(6);
    }

    setEdgeNodes(node1, node2) {
        this.node1Input.value = node1;
        this.node2Input.value = node2;
    }

    clearNodeInputs() {
        this.node1Input.value = '';
        this.node2Input.value = '';
    }

    setFirstAvailableNode(nodeId) {
        const nodeIdStr = String(nodeId);
        const currentValues = [
            this.node1Input.value.trim(),
            this.node2Input.value.trim()
        ];

        // Проверяем, есть ли такой ID уже в полях
        if (currentValues.includes(nodeIdStr)) {
            return;
        }

        // Заполняем первое свободное поле
        if (!this.node1Input.value) {
            this.node1Input.value = nodeIdStr;
        } else if (!this.node2Input.value) {
            this.node2Input.value = nodeIdStr;
        } else {
            // Если оба заполнены - перезаписываем первое поле
            this.node1Input.value = nodeIdStr;
            this.node2Input.value = '';
        }
    }
}

class Node {
    constructor(coordinates, id, map, ymaps3, formHandler) {  
        this.id = id;
        this.coordinates = coordinates;
        this.map = map;
        this.ymaps3 = ymaps3; // Сохраняем ссылку на API
        this.formHandler = formHandler;
        this.marker = null;
        this.placeholderUrl = 'https://cdn.animaapp.com/projects/6761c31b315a42798e3ee7e6/releases/67db012a45e0bcae5c95cfd1/img/placeholder-1.png'
    }

    createMarker() {
        const markerElement = this.createImageMarker(this.placeholderUrl);
        const menu = this.createMenu();
        const container = document.createElement('div');
        container.append(markerElement, menu);

        container.addEventListener('click', (e) => {
            e.stopPropagation(); // Блокируем всплытие события
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';

            this.formHandler.setFirstAvailableNode(this.id);
        })

        // Используем YMapMarker из переданного API
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
        `;
        return element;
    }

    createMenu() {
        const menu = document.createElement('div');
        menu.style.display = 'none';
        menu.className = 'node-menu';
        menu.innerHTML = 'Нажмите, чтобы вернуться <button class="delete">Удалить</button>';
        menu.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete();
        });
        return menu;
    }

    delete() {
        this.map.removeChild(this.marker);
        const index = nodes.findIndex(n => n.id === this.id);
        if (index !== -1) nodes.splice(index, 1);

        // Очищаем поля формы если удаляемый ID был в них
        if (this.formHandler.node1Input.value == this.id) {
            this.formHandler.node1Input.value = '';
        }
        if (this.formHandler.node2Input.value == this.id) {
            this.formHandler.node2Input.value = '';
        }
    }
}

class MapInteraction {
    constructor(ymaps3, formHandler, nodes, edges) {  
        // Сохраняем необходимые компоненты API
        this.ymaps3 = ymaps3;
        this.YMap = ymaps3.YMap;
        this.YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer;
        this.YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer;
        this.YMapLayer = ymaps3.YMapLayer;
        this.YMapFeatureDataSource = ymaps3.YMapFeatureDataSource;
        this.YMapListener = ymaps3.YMapListener;

        this.formHandler = formHandler;
        this.nodes = nodes;
        this.edges = edges;
        
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
    }

    initSourcesAndLayers() {
        const dataSource = new this.YMapFeatureDataSource({ id: 'my-markers' });
        const markerLayer = new this.YMapLayer({
            type: 'markers',
            source: 'my-markers',
            zIndex: 3500
        });

        this.map.addChild(new this.YMapDefaultSchemeLayer());
        this.map.addChild(new this.YMapDefaultFeaturesLayer());
        this.map.addChild(dataSource);
        this.map.addChild(markerLayer);
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
        const newNode = new Node(event.coordinates, this.nodes.length, this.map, this.ymaps3, this.formHandler);
        newNode.createMarker();
        this.nodes.push(newNode);

        console.log(nodes)
        
        // Используем FormHandler для обновления формы
        this.formHandler.setNodeCoords(event.coordinates);
    }

    destroy() {
        if (this.listener) {
            this.map.removeChild(this.listener);
            this.listener = null;
        }
    }
}

async function initMap() {
    await ymaps3.ready;

    const formHandler = new FormHandler();
    
    // Передаем зависимости в MapInteraction
    const interaction = new MapInteraction(ymaps3, formHandler, nodes, edges);
    interaction.init();
}

initMap();