export { Node }

import { nodes, edges, selectedNodes, mapId } from './edit_map.js';

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