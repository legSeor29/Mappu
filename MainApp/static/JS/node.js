export { Node }

import { 
    getNodes, 
    getEdges, 
    addSelectedNode, 
    clearSelectedNodes, 
    getSelectedNodes, 
    getController,
    getNextDisplayId
} from './store.js';
import { Edge } from './edge.js';

class Node {
    constructor(coordinates, id, map, ymaps3, formHandler, name = null, description = null, z_coordinate = 0, temp_id = null, isViewOnly = false) {  
        this.id = id;
        this.coordinates = coordinates;
        // Get a guaranteed sequential display ID from the store
        this.displayId = getNextDisplayId('node');
        
        // Установка имени по умолчанию, если оно не было передано
        this.name = name || `Вершина ${this.displayId}`;
        this.description = description
        this.z_coordinate = z_coordinate
        this.temp_id = temp_id
        this.map = map;
        this.ymaps3 = ymaps3; // Сохраняем ссылку на API
        this.formHandler = formHandler;
        this.marker = null;
        this.menuVisible = false; // Добавляем флаг видимости меню
        if (!this.isViewOnly && this.formHandler && typeof this.formHandler.addNodeOption === 'function') {
            this.formHandler.addNodeOption(this);
        }
        this.placeholderUrl = '/static/placeholder.png'
        this.isViewOnly = isViewOnly;
        this.createMarker();
        
        const controller = getController(); // Получаем контроллер из store
        if (controller && typeof controller.addNewNode === 'function' && 
            !controller.initialNodeIds.has(id)) {
            const nodeCreatedByUserAction = !document.getElementById('mapId')._loadingData;
            if (nodeCreatedByUserAction) {
                console.log(`Узел ${id} создан пользователем, отмечаем как новый`);
                controller.addNewNode(this);
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
            if (!this.isViewOnly && this.formHandler && typeof this.formHandler.setFirstAvailableNode === 'function') {
                this.formHandler.setFirstAvailableNode(this.id);
            }
            //this.menuVisible = false;
            //menu.style.display = 'none';
        });

        markerElement.addEventListener("mousedown", (e) => {
            if (this.isViewOnly) return;
            console.log('Обработка нажатия колесика мыши...');
            e.stopPropagation();
            e.preventDefault();
            if (e.button === 1) {
                addSelectedNode(this); // Используем функцию из store
                console.log(getSelectedNodes()); // Используем функцию из store
                if (getSelectedNodes().length == 2) {
                    console.log('Создается новое ребро...')
                    const edges = getEdges(); // Получаем edges из store
                    const selectedNodes = getSelectedNodes(); // Получаем selectedNodes из store

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
            
                    edges[newEdge.id] = newEdge; // Модифицируем edges из store
                    console.log('Создано новое ребро:', newEdge);
                    clearSelectedNodes(); // Используем функцию из store
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
        if (this.isViewOnly) {
            const info = document.createElement('div');
            info.className = 'node-info-window';
            info.innerHTML = `
                <div class="card border-0">
                    <div class="card-header bg-primary text-white">
                        <span class="fw-bold">${this.name || 'Без названия'}</span>
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
            return info;
        } else {
            const menu = document.createElement('div');
            menu.innerHTML = `
                <div class="node-header" style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4361ee, #3a0ca3); color: white; padding: 12px 16px; border-radius: 12px 12px 0 0;">
                    <h5 style="margin: 0; font-size: 15px; font-weight: 600; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                        <i class="fa fa-map-marker" style="margin-right: 6px; font-size: 14px;">📍</i>Вершина #${this.displayId}
                    </h5>
                </div>
                <form class="node-form" style="background-color: white; padding: 18px; border-radius: 0 0 12px 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <div class="mb-3">
                        <label class="form-label" style="font-weight: 600; font-size: 14px; color: #333; margin-bottom: 6px; display: block;">
                            Название вершины
                        </label>
                        <input type="text" class="form-control node-name" value="${this.name || ''}" 
                               style="width: 100%; border-radius: 8px; border: 1px solid #e0e0e0; padding: 10px 14px; margin-bottom: 14px; transition: all 0.2s ease; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" style="font-weight: 600; font-size: 14px; color: #333; margin-bottom: 6px; display: block;">
                            Описание
                        </label>
                        <textarea class="form-control node-desc" 
                                  style="width: 100%; border-radius: 8px; border: 1px solid #e0e0e0; padding: 10px 14px; margin-bottom: 14px; min-height: 90px; transition: all 0.2s ease; resize: vertical; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">${this.description || ''}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label" style="font-weight: 600; font-size: 14px; color: #333; margin-bottom: 6px; display: block;">
                            Высота (Z)
                        </label>
                        <input type="number" class="form-control node-z_cord" name="z_coordinate" step="any" value="${this.z_coordinate}"
                               style="width: 100%; border-radius: 8px; border: 1px solid #e0e0e0; padding: 10px 14px; margin-bottom: 18px; transition: all 0.2s ease; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; gap: 12px;">
                        <button type="button" class="btn btn-primary btn-sm node_save" 
                                style="flex: 1; background: linear-gradient(135deg, #4361ee, #3a0ca3); color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 6px rgba(67, 97, 238, 0.2);">
                            Сохранить
                        </button>
                        <button type="button" class="delete btn btn-danger btn-sm" 
                                style="flex: 1; background: linear-gradient(135deg, #ef233c, #d90429); color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 6px rgba(239, 35, 60, 0.2);">
                            Удалить
                        </button>
                    </div>
                </form>
            `;
            
            // Добавляем стили при наведении для полей ввода и кнопок
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                .node-menu input:hover, .node-menu textarea:hover {
                    border-color: #4361ee !important;
                }
                
                .node-menu input:focus, .node-menu textarea:focus {
                    border-color: #4361ee !important;
                    box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.25) !important;
                    outline: none !important;
                }
                
                .node-menu .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 10px rgba(67, 97, 238, 0.3) !important;
                }
                
                .node-menu .btn-danger:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 10px rgba(239, 35, 60, 0.3) !important;
                }
                
                .node-menu .btn-primary:active, .node-menu .btn-danger:active {
                    transform: translateY(0);
                }
            `;
            document.head.appendChild(styleElement);
            
            menu.style.cssText = `
                display: none;
                position: absolute;
                top: -15px;
                left: 50px;
                z-index: 1000;
                min-width: 280px;
                font-family: 'Segoe UI', Arial, sans-serif;
                border-radius: 12px;
                overflow: hidden;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                box-shadow: 0 15px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
                border: 1px solid rgba(0,0,0,0.08);
            `;
            menu.className = 'node-menu';
            
            // Плавное появление меню при отображении
            const originalDisplay = menu.style.display;
            Object.defineProperty(menu.style, 'display', {
                set: function(value) {
                    this.cssText = this.cssText.replace(/display:.*?;/, `display: ${value};`);
                    if (value !== 'none') {
                        setTimeout(() => {
                            menu.style.opacity = '1';
                            menu.style.transform = 'translateY(0)';
                        }, 10);
                    } else {
                        menu.style.opacity = '0';
                        menu.style.transform = 'translateY(10px)';
                    }
                }
            });
            
            menu.querySelector(`.node_save`).addEventListener('click', (e) => {
                //e.stopPropagation();
                console.log('Сохранение данных о вершине...')
                
                // Добавляем визуальную обратную связь при сохранении
                const saveBtn = menu.querySelector('.node_save');
                const originalText = saveBtn.innerText;
                saveBtn.innerText = '✓ Сохранено';
                saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                
                setTimeout(() => {
                    saveBtn.innerText = originalText;
                    saveBtn.style.background = 'linear-gradient(135deg, #4361ee, #3a0ca3)';
                }, 1500);
                
                // Сохраняем старые значения для проверки изменений
                const oldName = this.name;
                const oldDesc = this.description;
                const oldZ = this.z_coordinate;
                
                this.name = menu.querySelector('.node-name').value; 
                this.description = menu.querySelector('.node-desc').value;
                this.z_coordinate = menu.querySelector('.node-z_cord').value; 
                this.formHandler.updateNodeOptions(this);
                
                const controller = getController(); // Получаем контроллер из store
                if (controller && controller.markNodeChanged && 
                    (oldName !== this.name || oldDesc !== this.description || oldZ !== this.z_coordinate)) {
                    controller.markNodeChanged(this);
                }
            });
            
            menu.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Добавляем подтверждение удаления
                const deleteBtn = menu.querySelector('.delete');
                if (deleteBtn.classList.contains('confirm')) {
                    this.delete();
                } else {
                    deleteBtn.innerText = 'Подтвердить';
                    deleteBtn.classList.add('confirm');
                    deleteBtn.style.background = 'linear-gradient(135deg, #000000, #333333)';
                    
                    setTimeout(() => {
                        deleteBtn.innerText = 'Удалить';
                        deleteBtn.classList.remove('confirm');
                        deleteBtn.style.background = 'linear-gradient(135deg, #ef233c, #d90429)';
                    }, 3000);
                }
            });
            
            return menu;
        }
    }
    
    updateMenu(menu) {
        if (this.isViewOnly) return;
        menu.querySelector('.node-name').value = this.name || '';
        menu.querySelector('.node-desc').innerText = this.description || '';
        menu.querySelector('.node-z_cord').value = this.z_coordinate;
    }

    delete() {
        console.log(`удалена вершина ${this.id}`)
        const edges = getEdges(); // Получаем edges из store
        const nodes = getNodes(); // Получаем nodes из store

        // Удаление всех связанных ребер
        const relatedEdges = Object.values(edges).filter(e => 
            e.node1.id === this.id || e.node2.id === this.id
        );
        
        relatedEdges.forEach(edge => {
            edge.delete(); // Используем новый метод delete
        });
        this.map.removeChild(this.marker);
        delete nodes[this.id]; // Модифицируем nodes из store
        // Очищаем поля формы если удаляемый ID был в них
        if (!this.isViewOnly && this.formHandler && typeof this.formHandler.removeNodeOption === 'function') {
            this.formHandler.removeNodeOption(this.id);
        }
        
        const controller = getController(); // Получаем контроллер из store
        if (controller && controller.markNodeDeleted) {
            controller.markNodeDeleted(this.id);
        }
    }
}