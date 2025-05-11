let _nodes = {};
let _edges = {};
let _selectedNodes = [];
let _mapId = null;
let _controller = null;

export const getNodes = () => _nodes;
export const setNodes = (newNodes) => {
    _nodes = newNodes;
};

export const getEdges = () => _edges;
export const setEdges = (newEdges) => {
    _edges = newEdges;
};

export const getSelectedNodes = () => _selectedNodes;
export const setSelectedNodes = (newSelectedNodes) => {
    _selectedNodes = newSelectedNodes;
}
export const addSelectedNode = (node) => {
    _selectedNodes.push(node);
};
export const clearSelectedNodes = () => {
    _selectedNodes = [];
};

export const getMapId = () => _mapId;
export const setMapId = (newMapId) => {
    _mapId = newMapId;
};
// Инициализация mapId из DOM при первой загрузке store
// Это менее идеально, чем передача из edit_map, но если mapId нужен глобально до инициализации карты
if (typeof document !== 'undefined') {
    const mapIdElement = document.getElementById('mapId');
    if (mapIdElement) {
        _mapId = mapIdElement.innerText;
    }
}


export const getController = () => _controller;
export const setController = (newController) => {
    _controller = newController;
};

export const resetNodesAndEdges = () => {
    _nodes = {};
    _edges = {};
};
