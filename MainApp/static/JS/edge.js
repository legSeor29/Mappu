export { Edge }
import { edges, Controller } from './edit_map.js';
 

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
        this.menuVisible = false;
        this.id = id;
       
        this.createFeature();
        
        // Добавляем ребро для отслеживания если оно новое
        if (Controller && Controller.addNewEdge && 
            (!Controller.initialEdgeIds || !Controller.initialEdgeIds.has(id))) {
            Controller.addNewEdge(this);
        }
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
            this.formHandler.setCurrentEdge?.(this.id);
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
        
        // Отмечаем ребро как удаленное
        if (Controller && Controller.markEdgeDeleted) {
            Controller.markEdgeDeleted(this.id);
        }
    }

    updatePosition() {
        this.feature.update({
            geometry: {
                type: 'LineString',
                coordinates: [this.node1.coordinates, this.node2.coordinates]
            }
        });
        
        // Отмечаем ребро как измененное при изменении позиции
        if (Controller && Controller.markEdgeChanged) {
            Controller.markEdgeChanged(this);
        }
    }
}
