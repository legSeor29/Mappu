import { DatabaseController } from './controller.js';
import { MapInteraction } from './interaction.js';
import { FormHandler } from './form_handler.js';
import { 
    getNodes, 
    getEdges, 
    getSelectedNodes, 
    clearSelectedNodes,
    setMapId, 
    getController, 
    setController,
    getMapId
} from './store.js';

// Устанавливаем mapId из DOM в хранилище
// Это нужно сделать до того, как Controller попытается его использовать
if (typeof document !== 'undefined') {
    const mapIdElement = document.getElementById('mapId');
    if (mapIdElement) {
        setMapId(mapIdElement.innerText);
    }
}


async function initMap() {
    console.log("initMap called");
    await ymaps3.ready;
     
    const formHandler = new FormHandler();
    
    const interaction = new MapInteraction(ymaps3, formHandler);
    interaction.init();
    
    const newController = new DatabaseController(formHandler);
    setController(newController);

    getController().map = interaction.map;
    getController().ymaps3 = interaction.ymaps3;
    
    getController().GetCurrentData();
    
    document.querySelector('button[name="save_changes"]').addEventListener('click', (e) => {
        getController().UpdateData();
    })
}

initMap();

// Экспортировать напрямую переменные больше не нужно, 
// так как они управляются через store.js
// Если какой-то части приложения нужны эти значения, она должна импортировать геттеры из store.js
// export { nodes, edges, selectedNodes, mapId, Controller } // Удаляем этот экспорт