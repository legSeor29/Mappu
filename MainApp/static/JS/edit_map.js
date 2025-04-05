let nodes = [];
let edges = [];
const mapId = document.getElementById('mapId').innerText

class DatabaseController {

    GetCurrentData() {
        console.log('Поиск карты...')
        fetch(`/api/maps/${mapId}`)
        .then(response => {
            if (!response.ok) throw new Error('Ошибка загрузки');
            return response.json();
        })
        .then(data => {
            console.log('Данные объекта:', data);
        })
        .catch(error => {
            console.error('Ошибка:', error);
        });
    }

}

class FormHandler {
    constructor() {
        this.latitudeInput = document.querySelector('.latitude');
        this.longitudeInput = document.querySelector('.longitude');
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
    constructor(coordinates, id, map, ymaps3, formHandler) {  
        this.id = id;
        this.coordinates = coordinates;
        this.name = 'None'
        this.description = 'None'
        this.z_coordinate = 0
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
        container.addEventListener('contextmenu', (e) => {
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
        container.addEventListener('click', (e) => {
            if (e.button !== 0) return; // Проверяем именно левую кнопку
            e.stopPropagation();
            this.formHandler.setFirstAvailableNode(this.id);
            //this.menuVisible = false;
            //menu.style.display = 'none';
        });

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
        menu.style.display = 'none';
        menu.className = 'node-menu';
        this.updateMenu(menu)
         
        menu.querySelector(`.node_save`).addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Сохранение данных о вершине...')
            this.name = menu.querySelector('.node-name').value; 
            this.description = menu.querySelector('.node-desc').value;
            this.z_coordinate = menu.querySelector('.node-z_cord').value; 
        });
        menu.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete();
        });
        
        return menu;
    }
    
    updateMenu(menu) {
        menu.innerHTML = `
        <form class="node-form">
            <div class="mb-3">
                <label class="form-label">Название вершины</label>
                <input type="text" class="form-control node-name" value="${this.name}">
            </div>
            <div class="mb-3">
                <label class="form-label">Описание</label>
                <textarea class="form-control node-desc">${this.description}</textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Высота (Z)</label>
                <input type="number" 
                        class="form-control node-z_cord" 
                        name="z_coordinate"
                        step="any" value="${this.z_coordinate}">
            </div>
            
            <button type="button" class="btn btn-primary btn-sm node_save">Сохранить</button>
            <button class="delete btn btn-danger btn-sm">Удалить</button>
        </form>
    `;
    }

    delete() {
        console.log(`удалена вершина ${this.id}`)
        edges = edges.filter(edge => {
            if (edge.node1.id === this.id || edge.node2.id === this.id) {
                console.log(`ребро ${edge.id} удалилось из-за удаления одной из вершин`)
                edge.delete();
                return false;
            }
            return true;
        });


        this.map.removeChild(this.marker);
        const index = nodes.findIndex(n => n.id === this.id);
        if (index !== -1) nodes.splice(index, 1);

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
        const index = edges.findIndex(e => e.id === this.id);
        if (index !== -1) edges.splice(index, 1);
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
    constructor(ymaps3, formHandler, nodes, edges) {  
        // Сохраняем необходимые компоненты API
        this.ymaps3 = ymaps3;
        this.YMap = ymaps3.YMap;
        this.YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer;
        this.YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer;
        this.YMapLayer = ymaps3.YMapLayer;
        this.YMapFeatureDataSource = ymaps3.YMapFeatureDataSource;
        this.YMapListener = ymaps3.YMapListener;
        this.nodes = nodes 
        this.edges = edges
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
        const newNode = new Node(event.coordinates, nodes.length, this.map, this.ymaps3, this.formHandler);
        this.nodes.push(newNode);

        console.log(this.nodes)
        
        // Используем FormHandler для обновления формы
        this.formHandler.setNodeCoords(event.coordinates);
    }

    EdgeFormSubmitEventHandler() {
        this.formHandler.edgeSubmit.addEventListener('click', (e) => {
            e.stopPropagation()
            e.preventDefault();
            console.log('Начало обработки');
        
            console.log('Значения select:', {
                node1: this.formHandler.node1Select.value,
                node2: this.formHandler.node2Select.value
            });
            const node1Id = parseInt(this.formHandler.node1Select.value);
            const node2Id = parseInt(this.formHandler.node2Select.value);
            const node1 = this.nodes.find(n => n.id === node1Id);
            const node2 = this.nodes.find(n => n.id === node2Id);
    
            if (!node1 || !node2) {
                alert('Выберите два узла!');
                return;
            }
    
            if (node1.id === node2.id) {
                alert('Нельзя соединить узел сам с собой!');
                return;
            }
    
            const newEdge = new Edge(
                this.edges.length,
                node1,
                node2,
                this.map,
                this.ymaps3,
                this.formHandler
            );
    
            this.edges.push(newEdge);
            console.log('Создано новое ребро:', newEdge);
            console.log('Конец обработки');
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
    Controller = new DatabaseController();
    Controller.GetCurrentData();
    const formHandler = new FormHandler();
    
    // Передаем зависимости в MapInteraction
    const interaction = new MapInteraction(ymaps3, formHandler, nodes, edges);
    interaction.init();
}

initMap();