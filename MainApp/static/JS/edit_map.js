let map;
let selectedCoordinates = [];
const nodeForm = document.getElementById('node-form');
const edgeForm = document.getElementById('edge-form');

document.getElementById('add-node').addEventListener('click', () => {
    nodeForm.style.display = "block";
    edgeForm.style.display = "none";
});

document.getElementById('add-edge').addEventListener('click', () => {
    nodeForm.style.display = "none";
    edgeForm.style.display = "block";
});

async function initMap() {
    await ymaps3.ready;

    // Импортируем необходимые модули
    const {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer} = ymaps3;
    const {YMapMarker} = ymaps3Markers; // Импорт из отдельного модуля

    map = new YMap(
        document.getElementById('map'),
        {
            location: {
                center: [37.588144, 55.733842],
                zoom: 10
            }
        }
    );

    // Добавляем слои
    map.addChild(new YMapDefaultSchemeLayer());
    map.addChild(new YMapDefaultFeaturesLayer());

    // Обработчик кликов для добавления маркеров
    map.addEventListener('click', (event) => {
        const marker = new YMapMarker({
            coordinates: event.coordinates,
            title: "Новая точка",
            subtitle: "Описание точки",
            color: "#FF0000"
        });

        map.addChild(marker);
        console.log('Маркер добавлен:', event.coordinates);
    });
}

initMap();