async function initMap() {
    await ymaps3.ready;

    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapLayer,
        YMapFeatureDataSource, // Добавляем класс для создания источника данных
        YMapListener,
        YMapMarker
    } = ymaps3;

    const map = new YMap(document.getElementById('map'), {
        location: {
            center: [37.6176, 55.7558],
            zoom: 12
        }
    });

    // 1. Создаем источник данных
    const dataSource = new YMapFeatureDataSource({
        id: 'my-markers' // Идентификатор должен совпадать с source слоя и маркеров
    });

    // 2. Создаем слой, связанный с источником
    const markerLayer = new YMapLayer({
        type: 'markers',
        source: 'my-markers', // Ссылаемся на созданный источник
        zIndex: 3500
    });

    // 3. Добавляем всё на карту в правильном порядке
    map.addChild(new YMapDefaultSchemeLayer());
    map.addChild(new YMapDefaultFeaturesLayer());
    map.addChild(dataSource); // Источник данных должен быть добавлен перед слоем
    map.addChild(markerLayer);

    // 4. Обработчик клика
    map.addChild(new YMapListener({
        layer: 'any',
        onClick: (_, event) => {
            if (!event) return;
            console.log(event.coordinates)
            const marker = new YMapMarker({
                coordinates: event.coordinates,
                source: 'my-markers' // Используем тот же источник
            }, createImageMarker('/static/IMAGES/image.png'));

            map.addChild(marker);
        }
    }));
}

function createImageMarker(src) {
    const element = document.createElement('img');
    element.src = src;
    element.style.cssText = `
        width: 40px;
        height: 40px;
        cursor: pointer;
        transform: translate(-50%, -100%); /* Центрирование */
    `;
    return element;
}

initMap();