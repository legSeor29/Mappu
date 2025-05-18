export { MapInteraction }

import { 
    getNodes, 
    getEdges, 
    // getSelectedNodes, // Не используется напрямую, но используется в Node.js
    getController 
} from './store.js';
import { Node } from './node.js';
import { Edge } from './edge.js'; 

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
        
        const nodes = getNodes(); // Получаем nodes из store
        
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
        
        nodes[newNodeId] = newNode; // Модифицируем nodes из store
        
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
        
            const nodes = getNodes(); // Получаем nodes из store
            const edges = getEdges(); // Получаем edges из store
            const controller = getController(); // Получаем controller из store
        
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

            // Удаляем проверку и логику добавления в очередь pendingEdges
            // Просто создаём ребро напрямую, как при клике колесиком мыши
            
            const existingEdgeIds = Object.keys(edges).map(id => parseInt(id, 10));
            const newEdgeId = existingEdgeIds.length > 0 ? Math.max(...existingEdgeIds) + 1 : 1;
            const newEdge = new Edge(
                newEdgeId,
                node1,
                node2,
                this.formHandler.edgeDesc ? this.formHandler.edgeDesc.value : '',
                this.map,
                this.ymaps3,
                this.formHandler
            );
    
            edges[newEdgeId] = newEdge; // Модифицируем edges из store
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
        
            const nodes = getNodes(); // Получаем nodes из store
            // const controller = getController(); // Получаем controller из store
        
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
            nodes[newNodeId] = newNode; // Модифицируем nodes из store
            // controller.addNewNode(newNode); // addNewNode вызывается в конструкторе Node

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