let nodes = {};
let edges = {};
let selectedNodes = [];
const mapId = document.getElementById('mapId').innerText
let Controller;
export { nodes, edges, selectedNodes, mapId, Controller }
 
import { DatabaseController } from './controller.js';
import { MapInteraction } from './interaction.js';
import { FormHandler } from './form_handler.js';
 

async function initMap() {
    console.log("initMap called");
    await ymaps3.ready;
     
    const formHandler = new FormHandler();
    // Передаем зависимости в MapInteraction
    const interaction = new MapInteraction(ymaps3, formHandler, nodes, edges);
    Controller = new DatabaseController(formHandler);
    interaction.init();
    Controller.map = interaction.map;
    Controller.ymaps3 = interaction.ymaps3;
    Controller.GetCurrentData();
    document.querySelector('button[name="save_changes"]').addEventListener('click', (e) => {
        Controller.UpdateData();
    })
}

initMap();