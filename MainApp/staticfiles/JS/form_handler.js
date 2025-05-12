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
        option.textContent = node.name || `Узел ${node.id}`;
        
        this.node1Select.appendChild(option.cloneNode(true));
        this.node2Select.appendChild(option);
    }

    removeNodeOption(nodeId) {
        const options = this.node1Select.querySelectorAll(`option[value="${nodeId}"]`);
        options.forEach(option => option.remove());
        
        const options2 = this.node2Select.querySelectorAll(`option[value="${nodeId}"]`);
        options2.forEach(option => option.remove());
    }

    setNodeCoords(coords) {
        this.longitudeInput.value = coords[0].toFixed(6);
        this.latitudeInput.value = coords[1].toFixed(6);
    }

    updateNodeOptions(node) {
        const options = this.node1Select.querySelectorAll(`option[value="${node.id}"]`);
        options.forEach(option => option.textContent = node.name || `Узел ${node.id}`);

        const options2 = this.node2Select.querySelectorAll(`option[value="${node.id}"]`);
        options2.forEach(option => option.textContent = node.name || `Узел ${node.id}`);
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