let nodes = {};
let edges = {};
const mapId = document.getElementById('mapId').innerText;

class DatabaseController {
    constructor() {   
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
        
        // Очищаем объекты узлов и ребер перед заполнением
        nodes = {};
        edges = {};
        
        try {
            // Заполняем узлы
            for (const node of data.nodes) {
                // Создаем узел из данных с сервера
                const newNode = new Node(
                    [node.longitude, node.latitude],
                    node.id,
                    this.map,
                    this.ymaps3,
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
                // Проверяем, есть ли оба узла
                if (nodes[edge.node1] && nodes[edge.node2]) {
                    // Создаем ребро
                    const newEdge = new Edge(
                        edge.id,
                        nodes[edge.node1],
                        nodes[edge.node2],
                        this.map,
                        this.ymaps3
                    );
                    
                    // Добавляем в глобальный объект ребер
                    edges[edge.id] = newEdge;
                    
                    console.log(`Ребро ${edge.id} загружено из базы данных`);
                } else {
                    console.warn(`Невозможно загрузить ребро ${edge.id}: один или оба узла не найдены`);
                }
            }
            
            console.log('Текущие данные заполнены');
            console.log(nodes, edges);
        } catch (error) {
            console.error("Ошибка при получении данных:", error);
        }
    }
}

class Node {
    constructor(coordinates, id, map, ymaps3, name = null, description = null, z_coordinate = 0) {  
        this.id = id;
        this.coordinates = coordinates;
        this.name = name;
        this.description = description;
        this.z_coordinate = z_coordinate;
        this.map = map;
        this.ymaps3 = ymaps3;
        this.marker = null;
        this.placeholderUrl = 'https://cdn.animaapp.com/projects/6761c31b315a42798e3ee7e6/releases/67db012a45e0bcae5c95cfd1/img/placeholder-1.png';
        this.createMarker();
    }

    createMarker() {
        const markerElement = this.createImageMarker(this.placeholderUrl);
        const infoElement = this.createInfoWindow();
        const container = document.createElement('div');
        
        container.style.pointerEvents = 'auto';
        container.append(markerElement, infoElement);

        // Только просмотр информации при клике
        markerElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleInfoWindow(infoElement);
        });

        // Закрытие информации при клике вне элемента
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                infoElement.style.display = 'none';
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
            pointer-events: auto;
        `;
        return element;
    }

    createInfoWindow() {
        const info = document.createElement('div');
        info.innerHTML = `
            <div class="card border-0">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <span class="fw-bold">${this.name || 'Без названия'}</span>
                    <i class="fas fa-times-circle close-info" style="cursor: pointer;"></i>
                </div>
                <div class="card-body">
                    ${this.description ? `<p class="mb-2">${this.description}</p>` : 
                      '<p class="text-muted mb-2 fst-italic">Нет описания</p>'}
                    <div class="d-flex justify-content-between border-top pt-2 mt-2">
                        <span class="badge bg-light text-dark">
                            <i class="fas fa-arrows-alt-v me-1"></i> ${this.z_coordinate} м
                        </span>
                        <span class="badge bg-light text-dark">
                            <i class="fas fa-map-marker-alt me-1"></i> ${this.coordinates[1].toFixed(4)}, ${this.coordinates[0].toFixed(4)}
                        </span>
                    </div>
                </div>
            </div>
        `;
        info.style.cssText = `
            display: none;
            position: absolute;
            z-index: 1000;
            width: 250px;
            transform: translate(20px, -100%);
            box-shadow: 0 3px 14px rgba(0,0,0,0.3);
            border-radius: 8px;
            overflow: hidden;
        `;
        info.className = 'node-info-window';
        
        // Add close button functionality
        const closeBtn = info.querySelector('.close-info');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                info.style.display = 'none';
            });
        }
        
        return info;
    }
    
    toggleInfoWindow(infoElement) {
        // Close all other info windows first
        document.querySelectorAll('.node-info-window').forEach(el => {
            if (el !== infoElement) el.style.display = 'none';
        });
        
        // Toggle this info window
        if (infoElement.style.display === 'none') {
            infoElement.style.display = 'block';
        } else {
            infoElement.style.display = 'none';
        }
    }
}

class Edge {
    constructor(id, node1, node2, map, ymaps3) {
        this.node1 = node1;
        this.node2 = node2;
        this.map = map;
        this.ymaps3 = ymaps3;
        this.feature = null;
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
        
        // Создаем саму линию
        this.feature = new this.ymaps3.YMapFeature({
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            style: {
                stroke: [{width: 3, color: "#1DA1F2"}]
            },
            source: 'edges'
        }, lineElement);

        this.map.addChild(this.feature);
    }
}

class MapViewer {
    constructor(ymaps3) {  
        // Сохраняем необходимые компоненты API
        this.ymaps3 = ymaps3;
        this.YMap = ymaps3.YMap;
        this.YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer;
        this.YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer;
        this.YMapLayer = ymaps3.YMapLayer;
        this.YMapFeatureDataSource = ymaps3.YMapFeatureDataSource;
        
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
        this.addMapControls();
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

    addMapControls() {
        // Add zoom controls
        const zoomControl = document.createElement('div');
        zoomControl.className = 'map-controls';
        zoomControl.innerHTML = `
            <div class="btn-group-vertical shadow-sm">
                <button class="btn btn-light btn-zoom-in" title="Приблизить">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="btn btn-light btn-zoom-out" title="Отдалить">
                    <i class="fas fa-minus"></i>
                </button>
            </div>
        `;
        
        // Add styles for controls
        const style = document.createElement('style');
        style.textContent = `
            .map-controls {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 1000;
            }
            .node-info-window .card {
                background-color: white;
            }
            .node-info-window .card-header {
                padding: 0.5rem 1rem;
            }
            .node-info-window .card-body {
                padding: 0.75rem;
            }
        `;
        document.head.appendChild(style);
        
        // Append controls to map container
        document.getElementById('map').appendChild(zoomControl);
        
        // Add event handlers
        zoomControl.querySelector('.btn-zoom-in').addEventListener('click', () => {
            const currentZoom = this.map.location.zoom;
            this.map.setLocation({zoom: currentZoom + 1});
        });
        
        zoomControl.querySelector('.btn-zoom-out').addEventListener('click', () => {
            const currentZoom = this.map.location.zoom;
            this.map.setLocation({zoom: currentZoom - 1});
        });
    }
}

async function initMap() {
    console.log("initMap called");
    await ymaps3.ready;
    
    // Создаем просмотрщик карты
    const viewer = new MapViewer(ymaps3);
    viewer.init();
    
    // Инициализируем контроллер для получения данных
    Controller = new DatabaseController();
    Controller.map = viewer.map;
    Controller.ymaps3 = viewer.ymaps3;
    
    // Загружаем данные карты
    Controller.GetCurrentData();
}

// Инициализируем карту при загрузке страницы
initMap(); 