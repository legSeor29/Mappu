import { Edge } from './edge.js';
import { Node } from './node.js';
 

let nodes = {};
let edges = {};
const mapId = document.getElementById('mapId').innerText;
let Controller;

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
                    null, // formHandler не нужен для view
                    node.name,
                    node.description,
                    node.z_coordinate,
                    node.temp_id, // если есть
                    true // isViewOnly
                );
                
                // Добавляем в глобальный объект узлов
                nodes[node.id] = newNode;
                
                console.log(`Узел ${node.id} загружен из базы данных`);
            }
            
            // Заполняем ребра
            for (const edge of data.edges) {
                // Проверяем, есть ли оба узла
                if (nodes[edge.node1] && nodes[edge.node2]) {
                    // Создаем ребро через импортируемый Edge
                    const newEdge = new Edge(
                        edge.id,
                        nodes[edge.node1],
                        nodes[edge.node2],
                        edge.description,
                        this.map,
                        this.ymaps3,
                        null, // formHandler не нужен для view
                        edge.temp_id, // если есть
                        true // isViewOnly
                    );
                    // Применяем стили, если они есть
                    if (edge.style) {
                        newEdge.style = edge.style;
                        if (typeof newEdge.updateDashStyle === 'function') newEdge.updateDashStyle();
                        if (typeof newEdge.updateStyle === 'function') newEdge.updateStyle();
                    }
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