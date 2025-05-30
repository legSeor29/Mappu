console.log("Инициализация карты...");
initMap();

async function initMap() {
    await ymaps3.ready;
    console.log("Готово");
    const {YMap, YMapDefaultSchemeLayer} = ymaps3;
    const map = new YMap(
        document.getElementById('map'),
        {
            location: {
                center: [37.588144, 55.733842],
                zoom: 10
            }
        }
    );

    map.addChild(new YMapDefaultSchemeLayer());
}

