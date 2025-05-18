import { getNodes } from './store.js'; // Import getNodes

export { FormHandler }

class FormHandler {
    constructor() {
        this.nodeName = document.querySelector('input[name="node_name"]')
        this.latitudeInput = document.querySelector('.latitude');
        this.longitudeInput = document.querySelector('.longitude');
        this.nodeDesc = document.querySelector('textarea[name="node_description"]')
        this.nodeZ_coord = document.querySelector('input[name="node_z_coordinate"]')
        this.nodeSubmit = document.querySelector('button[name="node_submit"]')
        this.node1Select = document.querySelector('select[name="node1"]');
        this.node2Select = document.querySelector('select[name="node2"]');
        this.edgeSubmit = document.querySelector('button[name="edge_submit"]'); 
    }

    addNodeOption(node) {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.name;
        
        this.node1Select.appendChild(option.cloneNode(true));
        this.node2Select.appendChild(option);
    }

    removeNodeOption(nodeId) {
        const options = this.node1Select.querySelectorAll(`option[value="${nodeId}"]`);
        options.forEach(option => option.remove());
        
        const options2 = this.node2Select.querySelectorAll(`option[value="${nodeId}"]`);
        options2.forEach(option => option.remove());
    }

    populateNodeDropdowns() {
        console.log("Populating node dropdowns..."); // Add log for debugging
        // Store current selections if needed (optional, depends on desired UX)
        const selectedNode1 = this.node1Select.value;
        const selectedNode2 = this.node2Select.value;

        // Clear existing options and add a default empty option
        this.node1Select.innerHTML = '<option value="">Выберите узел</option>'; 
        this.node2Select.innerHTML = '<option value="">Выберите узел</option>';

        const nodes = getNodes(); // Get current nodes from the store
        
        // Check if nodes is an object
        if (typeof nodes === 'object' && nodes !== null) {
             for (const nodeId in nodes) {
                if (nodes.hasOwnProperty(nodeId)) {
                    const node = nodes[nodeId];
                    // Use the existing addNodeOption logic but apply it per node
                    const option = document.createElement('option');
                    option.value = node.id; 
                    // Теперь просто используем имя узла, так как оно всегда задано
                    option.textContent = node.name; 
                    
                    this.node1Select.appendChild(option.cloneNode(true));
                    this.node2Select.appendChild(option);
                }
            }
        } else {
            console.error("Nodes data is not an object:", nodes);
        }

        // Restore previous selections if they still exist (optional)
        if (this.node1Select.querySelector(`option[value="${selectedNode1}"]`)) {
            this.node1Select.value = selectedNode1;
        }
         if (this.node2Select.querySelector(`option[value="${selectedNode2}"]`)) {
            this.node2Select.value = selectedNode2;
        }
        console.log("Finished populating dropdowns. Node1 options:", this.node1Select.options.length, "Node2 options:", this.node2Select.options.length); // Debug log
    }

    setNodeCoords(coords) {
        this.longitudeInput.value = coords[0].toFixed(6);
        this.latitudeInput.value = coords[1].toFixed(6);
    }

    updateNodeOptions(node) {
        const options = this.node1Select.querySelectorAll(`option[value="${node.id}"]`);
        options.forEach(option => option.textContent = node.name);

        const options2 = this.node2Select.querySelectorAll(`option[value="${node.id}"]`);
        options2.forEach(option => option.textContent = node.name);
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