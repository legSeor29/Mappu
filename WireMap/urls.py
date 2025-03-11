
from django.contrib import admin
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import path
from MainApp.views import main_page, register, edit_map

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', main_page, name="main"),
    path('register/', register, name='register'),
    path('login/', LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', LogoutView.as_view(template_name='logged_out.html'), name= 'logout'),
    path('edit_map/<int:map_id>', edit_map, name='edit_map'),
    path('create_map/', edit_map, name='create_map'),
]
