Представления (Views)
==================

В этом разделе описаны представления (views) приложения, обрабатывающие запросы пользователей.

Основные представления
---------------------

.. autofunction:: MainApp.views.main_page

.. autofunction:: MainApp.views.register

.. autofunction:: MainApp.views.profile

.. autofunction:: MainApp.views.edit_profile

.. autofunction:: MainApp.views.custom_logout

Работа с картами
---------------

.. autofunction:: MainApp.views.create_map

.. autofunction:: MainApp.views.edit_map

.. autofunction:: MainApp.views.view_map

.. autofunction:: MainApp.views.user_maps

.. autofunction:: MainApp.views.maps_gallery

.. autofunction:: MainApp.views.delete_map

.. autofunction:: MainApp.views.publish_map

.. autofunction:: MainApp.views.unpublish_map

API-представления
----------------

.. autoclass:: MainApp.views.MapDetailAPI
   :members:
   :show-inheritance:

.. autoclass:: MainApp.views.MapListCreateAPIView
   :members:
   :show-inheritance:

.. autoclass:: MainApp.views.MapDetailAPIView
   :members:
   :show-inheritance: 