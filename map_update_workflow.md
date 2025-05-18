# Процесс обновления карты

## Обзор
Этот документ описывает процесс обновления данных карты в приложении, фокусируясь на том, что происходит при нажатии кнопки "Сохранить все изменения".

## Клиентская часть (JavaScript)

### 1. Инициализация сохранения
- Событие: Пользователь нажимает кнопку "Сохранить все изменения".
- Файл: MainApp/templates/edit_map.html
- Элемент: <button name="save_changes">
- Действие: Вызывается обработчик события click.
    // Файл: MainApp/static/JS/edit_map.js
  document.querySelector('button[name="save_changes"]').addEventListener('click', (e) => {
      getController().UpdateData(); // Получаем контроллер из store.js
  })
  
- Контроллер: Экземпляр DatabaseController из MainApp/static/JS/controller.js.

### 2. Проверка наличия изменений
- Метод: DatabaseController.UpdateData()
- Действие: Вызывает метод this.hasChanges().
    // Файл: MainApp/static/JS/controller.js
  UpdateData() {
      if (this.hasChanges()) {
          console.log('Обнаружены изменения, используем PATCH запрос');
          this.sendPatchRequest();
      } else {
          console.log('Изменения не обнаружены, используем полный PUT запрос');
          this.sendPutRequest();
      }
  }

  hasChanges() {
      // Проверяет объект this.changes, который заполняется методами 
      // addNewNode, markNodeChanged, markNodeDeleted, addNewEdge, markEdgeChanged, markEdgeDeleted
      return this.changes.infoChanged || 
            this.changes.newNodes.length > 0 || 
            Object.keys(this.changes.changedNodes).length > 0 ||
            this.changes.deletedNodeIds.length > 0 ||
            this.changes.newEdges.length > 0 ||
            Object.keys(this.changes.changedEdges).length > 0 ||
            this.changes.deletedEdgeIds.length > 0;
  }
  

### 3. Отправка данных (если изменения есть - PATCH)
- Метод: DatabaseController.sendPatchRequest()
- Действия:
    1. Собирает все изменения (новые, измененные, удаленные узлы и ребра) из this.changes в объект mapData.
    2. Получает CSRF-токен (getCsrfToken()).
    3. Отправляет PATCH запрос на /api/v1/maps/{map_id}/ с mapData в теле запроса.
- Ответ сервера: Сервер обрабатывает изменения и возвращает JSON с обновленными данными. Если были созданы новые узлы, ответ может содержать client_index_map для сопоставления временных клиентских ID с ID на сервере.

### 4. Обработка ответа сервера (PATCH)
- Метод: DatabaseController.updateLocalIdsAfterSave(updatedData)
    - Обновляет временные ID новых узлов/ребер в локальном хранилище (nodes, edges из store.js) на ID, полученные от сервера.
- Проверка необходимости второго PATCH: Если ответ содержал client_index_map и существуют "ожидающие" новые ребра (this.pendingNewEdges, добавленные при создании ребра между еще не сохраненными узлами), вызывается sendEdgesAfterNodeUpdate().
    - Метод: DatabaseController.sendEdgesAfterNodeUpdate(clientIndexMap)
        1. Обновляет ID узлов в this.pendingNewEdges, используя clientIndexMap.
        2. Отправляет второй PATCH запрос на /api/v1/maps/{map_id}/, содержащий только поле new_edges с корректными ID узлов.
        3. Сервер создает эти ребра.
- Завершение: Вызывается finalizeUpdate().

### 5. Отправка данных (если изменений нет - PUT)
- Метод: DatabaseController.sendPutRequest()
- Действия:
    1. Собирает *все* текущие узлы и ребра из локального хранилища (getNodes(), getEdges()) в объект dataToSend.
    2. Получает CSRF-токен (getCsrfToken()).
    3. Отправляет PUT запрос на /api/v1/maps/{map_id}/ с dataToSend.
- Ответ сервера: Сервер полностью заменяет данные карты и возвращает JSON с новым состоянием.
- Обработка ответа: Вызывается updateLocalIdsAfterSave() (хотя здесь это менее критично).
- Завершение: Вызывается finalizeUpdate().

### 6. Финализация обновления
- Метод: DatabaseController.finalizeUpdate()
- Действия:
    1. Обновляет наборы initialNodeIds и initialEdgeIds актуальными ID.
    2. Сбрасывает отслеживание изменений (resetChanges()).
    3. Отображает сообщение пользователю: "Карта успешно сохранена!".

## Серверная часть (Django REST framework)
- Эндпоинт: /api/v1/maps/{map_id}/
- View: Вероятно, MapViewSet или аналогичный (требуется уточнение, просмотрев MainApp/views.py или MainApp/urls.py).
- Обработка PATCH:
    - Получает частичные данные (new_nodes, changed_nodes, deleted_node_ids и т.д.).
    - Создает, обновляет, удаляет соответствующие объекты Node и Edge в базе данных.
    - Возвращает JSON с обновленными/созданными объектами и, при необходимости, client_index_map.
- Обработка PUT:
    - Получает полный список узлов и ребер.
    - Удаляет все существующие узлы/ребра, связанные с картой.
    - Создает новые узлы/ребра на основе полученных данных.
    - Возвращает JSON с полным новым состоянием карты.