from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import path
<<<<<<< HEAD
from MainApp.views import main_page, register, edit_map, create_map, api_data, MapDetailAPI
from django.urls import path
from MainApp import views
=======
from MainApp.views import main_page, register, edit_map, create_map, MapDetailAPI

>>>>>>> map_changes

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', main_page, name="main"),
    path('register/', register, name='register'),
    path('login/', LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', LogoutView.as_view(template_name='logged_out.html'), name= 'logout'),
    path('edit_map/<int:map_id>', edit_map, name='edit_map'),
    path('create_map/', create_map, name='create_map'),
<<<<<<< HEAD
    path('api/maps/<int:pk>/', MapDetailAPI.as_view(), name='map-detail'),
    path('maps/my-maps/', views.user_maps, name='user_maps'),
    path('delete-map/<int:map_id>/', views.delete_map, name='delete_map'),

=======
    path('api/v1/maps/<int:pk>/', MapDetailAPI.as_view(), name='map-detail'),
>>>>>>> map_changes
]
