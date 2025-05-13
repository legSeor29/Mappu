export { Edge }
import { getEdges, getController } from './store.js';
 

class Edge {
    constructor(id, node1, node2, map, ymaps3, formHandler) {
        
        // Проверка, что не создаем ребро от узла к самому себе
        if (!node1 || !node2) {
            console.error("Ошибка: попытка создать ребро с отсутствующими узлами");
            throw new Error("Ребро требует два существующих узла");
        }
        
        if (node1.id === node2.id) {
            console.error(`Ошибка: попытка создать ребро от узла к самому себе (ID: ${node1.id})`);
            throw new Error(`Нельзя создать ребро от узла к самому себе (ID: ${node1.id})`);
        }
        
        // Дополнительная проверка с числовым преобразованием
        if (parseInt(node1.id) === parseInt(node2.id)) {
            console.error(`Ошибка: попытка создать ребро от узла к самому себе после преобразования (ID: ${node1.id})`);
            throw new Error(`Нельзя создать ребро от узла к самому себе (ID: ${node1.id})`);
        }
        
        // Выводим информацию о создаваемом ребре для отладки
        console.log(`Создается ребро #${id}: node1=${node1.id} (${typeof node1.id}), node2=${node2.id} (${typeof node2.id})`);
        
        this.node1 = node1;
        this.node2 = node2;
        this.map = map;
        this.ymaps3 = ymaps3;
        this.formHandler = formHandler;
        this.feature = null;
        this.listener = null;
        this.id = id;
        
        // Параметры стиля ребра (теперь в одном объекте)
        this.style = {
            color: "#1DA1F2",      // Цвет по умолчанию
            width: 3,              // Ширина по умолчанию
            lineStyle: "solid",    // Стиль линии: solid, dashed, dotted
            opacity: 1             // Прозрачность
        };
        
        // Вычисляемое свойство для dashStyle на основе lineStyle
        this.dashStyle = []; // Будет рассчитываться в updateDashStyle()
        
        // Кэширование последних координат для оптимизации
        this._lastStart = null;
        this._lastEnd = null;
        this._cachedCoordinates = null;
        
        // Создаем глобальное модальное меню при инициализации класса
        this.createGlobalMenu();
        
        // Обновляем dashStyle на основе lineStyle
        this.updateDashStyle();
        
        // Создаем графический элемент ребра
        this.createFeature();
        
        const controller = getController(); // Получаем контроллер из store
        if (controller && controller.addNewEdge && 
            (!controller.initialEdgeIds || !controller.initialEdgeIds.has(id))) {
            controller.addNewEdge(this);
        }
    }
    
    // Метод для обновления dashStyle на основе lineStyle
    updateDashStyle() {
        if (this.style.lineStyle === 'dashed') {
            this.dashStyle = [4, 4]; // Пунктирная линия: 4px штрих, 4px пробел
        } else if (this.style.lineStyle === 'dotted') {
            this.dashStyle = [2, 2]; // Точечная линия: 2px штрих, 2px пробел
        } else {
            this.dashStyle = []; // Сплошная линия (пустой массив)
        }
        return this.dashStyle;
    }

    createFeature() {
        // Генерируем координаты с учетом кривизны Земли
        const coordinates = this.getCoordinatesWithCurvature();

        // Создаем опции для ребра с увеличенной зоной нажатия
        const edgeOptions = {
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            style: {
                stroke: [{
                    width: this.style.width, 
                    color: this.style.color,
                    opacity: this.style.opacity,
                    dashStyle: this.dashStyle
                }],
                cursor: 'pointer',
                hitRadius: 20 // Увеличиваем область клика вокруг ребра
            },
            source: 'edges'
        };

        // Создаем ребро
        this.feature = new this.ymaps3.YMapFeature(edgeOptions);

        // Добавляем ребро на карту
        this.map.addChild(this.feature);
        
        // Создаем и добавляем слушатель событий для ребра
        this.createEdgeListener();

        console.log(`[DEBUG] Ребро ${this.id} создано с ${coordinates.length} точками`);
    }
    
    // Создает слушатель событий для ребра
    createEdgeListener() {
        // Обработчик клика на ребро
        const clickHandler = (object) => {
            // Проверяем, что клик был на наше ребро
            if (object && object.type === 'feature' && object.entity === this.feature) {
                console.log(`[DEBUG] Клик на ребро ${this.id} через YMapListener`);
                this.showGlobalMenu();
                return true; // Предотвращаем всплытие события
            }
            return false;
        };
        
        // Обработчик правого клика
        const contextMenuHandler = (object) => {
            if (object && object.type === 'feature' && object.entity === this.feature) {
                console.log(`[DEBUG] Контекстное меню на ребре ${this.id} через YMapListener`);
                this.showGlobalMenu();
                return true; // Предотвращаем всплытие события
            }
            return false;
        };
        
        // Обработчик двойного клика
        const dblClickHandler = (object) => {
            if (object && object.type === 'feature' && object.entity === this.feature) {
                console.log(`[DEBUG] Двойной клик на ребре ${this.id} через YMapListener`);
                this.showGlobalMenu();
                return true; // Предотвращаем всплытие события
            }
            return false;
        };

        // Создание объекта-слушателя
        this.listener = new this.ymaps3.YMapListener({
            layer: 'any', // Слушаем события на всех слоях
            onClick: clickHandler,
            onContextMenu: contextMenuHandler,
            onDblClick: dblClickHandler
        });
        
        // Добавление слушателя на карту
        this.map.addChild(this.listener);
    }

    delete() {
        console.log(`вы удалили ребро ${this.id}`);
        
        // Удаляем ребро с карты
        this.map.removeChild(this.feature);
        
        // Удаляем слушатель событий, если он был создан
        if (this.listener) {
            this.map.removeChild(this.listener);
        }
        
        // Удаляем глобальное меню
        const globalMenu = document.getElementById(`edge-global-menu-${this.id}`);
        if (globalMenu) {
            document.body.removeChild(globalMenu);
        }
        
        const edges = getEdges(); // Получаем edges из store
        delete edges[this.id]; // Модифицируем edges из store
        
        const controller = getController(); // Получаем контроллер из store
        if (controller && controller.markEdgeDeleted) {
            controller.markEdgeDeleted(this.id);
        }
    }

    updatePosition() {
        // Получаем новые координаты с учетом кривизны
        const coordinates = this.getCoordinatesWithCurvature();
        
        // Обновляем геометрию ребра
        this.feature.update({
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        });
        
        const controller = getController(); // Получаем контроллер из store
        if (controller && controller.markEdgeChanged) {
            controller.markEdgeChanged(this);
        }
    }

    updateStyle() {
        // Обновляем dashStyle на основе lineStyle
        this.updateDashStyle();
        
        // Обновляем только стили без изменения геометрии
        this.feature.update({
            style: {
                stroke: [{
                    width: this.style.width, 
                    color: this.style.color,
                    opacity: this.style.opacity,
                    dashStyle: this.dashStyle
                }],
                cursor: 'pointer',
                hitRadius: 20 // Увеличиваем область клика вокруг ребра
            }
        });
        
        console.log(`[DEBUG] Обновлены стили ребра ${this.id}:`, this.style);
        
        const controller = getController();
        if (controller && controller.markEdgeChanged) {
            controller.markEdgeChanged(this);
        }
    }

    /**
     * Получает координаты для ребра с учетом кривизны Земли
     * Оптимизирован с кэшированием и адаптивной детализацией
     */
    getCoordinatesWithCurvature() {
        const start = this.node1.coordinates;
        const end = this.node2.coordinates;
        
        // Проверяем, изменились ли координаты с момента последнего вычисления
        if (this._lastStart && this._lastEnd && 
            this._lastStart[0] === start[0] && 
            this._lastStart[1] === start[1] && 
            this._lastEnd[0] === end[0] && 
            this._lastEnd[1] === end[1] && 
            this._cachedCoordinates) {
            return this._cachedCoordinates;
        }
        
        // Кэшируем текущие координаты
        this._lastStart = [...start];
        this._lastEnd = [...end];
        
        // Генерируем дугу большого круга
        this._cachedCoordinates = this.generateGreatCircle(start, end);
        return this._cachedCoordinates;
    }

    /**
     * Вычисляет приближенное расстояние между двумя точками в километрах
     * Использует формулу гаверсинуса для сферической модели Земли
     */
    getDistanceInKm(point1, point2) {
        const R = 6371; // Радиус Земли в км
        const dLat = (point2[1] - point1[1]) * Math.PI / 180;
        const dLon = (point2[0] - point1[0]) * Math.PI / 180;
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
            
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Генерирует массив точек, представляющих дугу большого круга
     * с адаптивной детализацией в зависимости от расстояния
     */
    generateGreatCircle(start, end, maxPoints = 30) {
        // Проверка на случай, если точки совпадают
        if (start[0] === end[0] && start[1] === end[1]) {
            return [start, end];
        }
        
        // Вычисляем расстояние для определения нужной детализации
        const distanceKm = this.getDistanceInKm(start, end);
        
        // Для очень коротких расстояний достаточно прямой линии
        if (distanceKm < 5) {
            return [start, end];
        }
        
        // Адаптивно определяем количество точек в зависимости от расстояния
        let numPoints;
        if (distanceKm < 50) {
            numPoints = 8;  // Для коротких рёбер (5-50 км)
        } else if (distanceKm < 200) {
            numPoints = 12;  // Для средних рёбер (50-200 км)
        } else if (distanceKm < 500) {
            numPoints = 18; // Для длинных рёбер (200-500 км)
        } else {
            numPoints = maxPoints; // Для очень длинных рёбер (>500 км)
        }
        
        // Ограничиваем максимальным значением
        numPoints = Math.min(numPoints, maxPoints);
        
        // Конвертируем координаты из градусов в радианы
        const lon1 = start[0] * Math.PI / 180;
        const lat1 = start[1] * Math.PI / 180;
        const lon2 = end[0] * Math.PI / 180;
        const lat2 = end[1] * Math.PI / 180;
        
        // Расчет угловой дистанции в радианах между точками (формула гаверсинуса)
        const d = 2 * Math.asin(
            Math.sqrt(
                Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
                Math.cos(lat1) * Math.cos(lat2) * 
                Math.pow(Math.sin((lon2 - lon1) / 2), 2)
            )
        );
        
        // Генерируем точки вдоль дуги большого круга
        const points = [];
        for (let i = 0; i <= numPoints; i++) {
            const f = i / numPoints; // Доля пути
            
            // Промежуточная точка на дуге большого круга (формула сферической интерполяции)
            const a = Math.sin((1 - f) * d) / Math.sin(d);
            const b = Math.sin(f * d) / Math.sin(d);
            
            const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
            const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
            const z = a * Math.sin(lat1) + b * Math.sin(lat2);
            
            const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
            const lon = Math.atan2(y, x);
            
            // Конвертируем обратно в градусы
            points.push([lon * 180 / Math.PI, lat * 180 / Math.PI]);
        }
        
        return points;
    }

    // Метод для создания глобального модального меню
    createGlobalMenu() {
        // Удаляем существующее меню если оно уже есть
        const existingMenu = document.getElementById(`edge-global-menu-${this.id}`);
        if (existingMenu) {
            document.body.removeChild(existingMenu);
        }
        
        // Создаем контейнер для модального окна
        const modalContainer = document.createElement('div');
        modalContainer.id = `edge-global-menu-${this.id}`;
        modalContainer.className = 'edge-global-menu-container';
        modalContainer.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 100000;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', Arial, sans-serif;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Создаем содержимое модального окна
        const modalContent = document.createElement('div');
        modalContent.className = 'edge-modal-content';
        modalContent.style.cssText = `
            background-color: white;
            padding: 24px;
            border-radius: 12px;
            min-width: 320px;
            max-width: 500px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.1);
            position: relative;
            transform: translateY(20px);
            transition: transform 0.3s ease;
        `;
        
        // Заголовок с ID ребра и кнопкой закрытия
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e0e0e0; padding-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #4361ee; letter-spacing: 0.5px;">
                    <i style="margin-right: 8px; font-size: 16px;">🔗</i>Настройка ребра #${this.id}
                </h3>
                <button id="close-modal-${this.id}" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #888; transition: color 0.2s ease;">×</button>
            </div>
            <div class="edge-menu">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #333;">Цвет:</label>
                    <input type="color" id="edge-color-${this.id}" class="form-control edge-color-input" value="${this.style.color}" 
                           style="width: 100%; height: 40px; border-radius: 8px; border: 1px solid #e0e0e0; cursor: pointer; transition: all 0.2s ease;">
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #333;">
                        Ширина: <span id="width-value-${this.id}" style="font-weight: 500; color: #4361ee;">${this.style.width}px</span>
                    </label>
                    <input type="range" id="edge-width-${this.id}" min="1" max="10" value="${this.style.width}" 
                           style="width: 100%; height: 6px; border-radius: 3px; -webkit-appearance: none; appearance: none; background: linear-gradient(to right, #4361ee, #3a0ca3); outline: none; transition: all 0.2s ease;">
                </div>
                <div class="form-group" style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #333;">Стиль линии:</label>
                    <select id="edge-style-${this.id}" 
                            style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #e0e0e0; font-size: 14px; color: #333; background-color: white; cursor: pointer; outline: none; transition: all 0.2s ease; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
                        <option value="solid">Сплошная</option>
                        <option value="dashed">Пунктирная</option>
                        <option value="dotted">Точечная</option>
                    </select>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 24px;">
                    <button id="edge-save-${this.id}" style="flex: 1; background: linear-gradient(135deg, #4361ee, #3a0ca3); color: white; border: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 6px rgba(67, 97, 238, 0.2);">
                        Сохранить
                    </button>
                    <button id="edge-delete-${this.id}" style="flex: 1; background: linear-gradient(135deg, #ef233c, #d90429); color: white; border: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 6px rgba(239, 35, 60, 0.2);">
                        Удалить связь
                    </button>
                </div>
            </div>
        `;
        
        // Добавляем содержимое в контейнер
        modalContainer.appendChild(modalContent);
        
        // Добавляем модальное окно в body
        document.body.appendChild(modalContainer);
        
        // Добавляем стили для расширенных стилей элементов формы
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* Стили для ползунка в разных браузерах */
            #edge-width-${this.id}::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #4361ee;
                cursor: pointer;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                transition: all 0.2s ease;
            }
            
            #edge-width-${this.id}::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            
            #edge-width-${this.id}::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #4361ee;
                cursor: pointer;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                transition: all 0.2s ease;
            }
            
            #edge-width-${this.id}::-moz-range-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            
            /* Стили для hover эффектов */
            #close-modal-${this.id}:hover {
                color: #000;
            }
            
            #edge-save-${this.id}:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 10px rgba(67, 97, 238, 0.3);
            }
            
            #edge-delete-${this.id}:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 10px rgba(239, 35, 60, 0.3);
            }
            
            #edge-save-${this.id}:active, #edge-delete-${this.id}:active {
                transform: translateY(0);
            }
            
            /* Стили для фокуса элементов формы */
            select#edge-style-${this.id}:hover, select#edge-style-${this.id}:focus, input#edge-color-${this.id}:hover, input#edge-color-${this.id}:focus {
                border-color: #4361ee;
                box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.25);
            }
        `;
        document.head.appendChild(styleElement);
        
        // Добавляем обработчики событий
        
        // Обновление значения ширины при изменении ползунка
        const widthInput = document.getElementById(`edge-width-${this.id}`);
        const widthValue = document.getElementById(`width-value-${this.id}`);
        if (widthInput && widthValue) {
            widthInput.addEventListener('input', () => {
                widthValue.textContent = `${widthInput.value}px`;
            });
        }
        
        // Закрытие модального окна
        const closeButton = document.getElementById(`close-modal-${this.id}`);
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.hideGlobalMenu();
            });
        }
        
        // Закрытие по клику вне модального окна
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                this.hideGlobalMenu();
            }
        });
        
        // Сохранение настроек
        const saveButton = document.getElementById(`edge-save-${this.id}`);
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                const colorInput = document.getElementById(`edge-color-${this.id}`);
                const widthInput = document.getElementById(`edge-width-${this.id}`);
                const styleSelect = document.getElementById(`edge-style-${this.id}`);
                
                if (colorInput && widthInput && styleSelect) {
                    // Обновляем объект стиля
                    this.style.color = colorInput.value;
                    this.style.width = parseInt(widthInput.value);
                    this.style.lineStyle = styleSelect.value;
                    
                    // Обновляем стиль ребра
                    this.updateStyle();
                    
                    console.log(`[DEBUG] Сохранены настройки для ребра ${this.id}:`, this.style);
                    
                    // Добавляем визуальную обратную связь при сохранении
                    const originalText = saveButton.innerText;
                    const originalBackground = saveButton.style.background;
                    saveButton.innerText = '✓ Сохранено';
                    saveButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    
                    setTimeout(() => {
                        saveButton.innerText = originalText;
                        saveButton.style.background = originalBackground;
                    }, 1500);
                }
                
                this.hideGlobalMenu();
            });
        }
        
        // Удаление ребра
        const deleteButton = document.getElementById(`edge-delete-${this.id}`);
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                // Добавляем подтверждение удаления
                if (deleteButton.classList.contains('confirm')) {
                    console.log(`[DEBUG] Удаление ребра ${this.id} через глобальное меню`);
                    this.hideGlobalMenu();
                    this.delete();
                } else {
                    deleteButton.innerText = 'Подтвердить';
                    deleteButton.classList.add('confirm');
                    deleteButton.style.background = 'linear-gradient(135deg, #000000, #333333)';
                    
                    setTimeout(() => {
                        if (deleteButton && document.body.contains(deleteButton)) {
                            deleteButton.innerText = 'Удалить связь';
                            deleteButton.classList.remove('confirm');
                            deleteButton.style.background = 'linear-gradient(135deg, #ef233c, #d90429)';
                        }
                    }, 3000);
                }
            });
        }
    }
    
    // Показать глобальное меню
    showGlobalMenu() {
        const menu = document.getElementById(`edge-global-menu-${this.id}`);
        if (menu) {
            // Сначала обновляем значения в форме, чтобы отразить текущие настройки ребра
            const colorInput = document.getElementById(`edge-color-${this.id}`);
            const widthInput = document.getElementById(`edge-width-${this.id}`);
            const styleSelect = document.getElementById(`edge-style-${this.id}`);
            const widthValue = document.getElementById(`width-value-${this.id}`);
            
            if (colorInput) colorInput.value = this.style.color;
            if (widthInput) widthInput.value = this.style.width;
            if (widthValue) widthValue.textContent = `${this.style.width}px`;
            
            // Установка правильного значения стиля линии
            if (styleSelect) {
                styleSelect.value = this.style.lineStyle;
            }
            
            // Устанавливаем display: flex для центрирования содержимого
            menu.style.display = 'flex';
            
            // Анимация появления
            setTimeout(() => {
                menu.style.opacity = '1';
                const modalContent = menu.querySelector('.edge-modal-content');
                if (modalContent) {
                    modalContent.style.transform = 'translateY(0)';
                }
            }, 10);
            
            console.log(`[DEBUG] Показываем глобальное модальное меню для ребра ${this.id}`);
        } else {
            console.error(`[DEBUG] Не найдено глобальное меню для ребра ${this.id}`);
            // Если меню не было создано, создаем его
            this.createGlobalMenu();
            this.showGlobalMenu();
        }
    }
    
    // Скрыть глобальное меню
    hideGlobalMenu() {
        const menu = document.getElementById(`edge-global-menu-${this.id}`);
        if (menu) {
            // Анимация исчезновения
            menu.style.opacity = '0';
            const modalContent = menu.querySelector('.edge-modal-content');
            if (modalContent) {
                modalContent.style.transform = 'translateY(20px)';
            }
            
            // Скрываем после завершения анимации
            setTimeout(() => {
                menu.style.display = 'none';
            }, 300);
            
            console.log(`[DEBUG] Скрываем глобальное модальное меню для ребра ${this.id}`);
        }
    }
}
