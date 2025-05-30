from django.contrib import admin
from django.contrib.auth.views import LoginView
from django.urls import path
from MainApp.views import main_page, register, edit_map, create_map, MapDetailAPI, custom_logout, profile, docs_index, video_lesson_view, help_view, import_map, terms_of_use_view, privacy_policy_view
from MainApp import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', main_page, name="main"),
    path('register/', register, name='register'),
    path('login/', LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', custom_logout, name='logout'),
    path('profile/', profile, name='profile'),
    path('edit_map/<int:map_id>', edit_map, name='edit_map'),
    path('create_map/', create_map, name='create_map'),
    path('maps/import/', import_map, name='import_map'),
    path('api/v1/maps/<int:pk>/', MapDetailAPI.as_view(), name='map-detail'),
    path('maps/my-maps/', views.user_maps, name='user_maps'),
    path('delete-map/<int:map_id>/', views.delete_map, name='delete_map'),
    path('maps/gallery/', views.maps_gallery, name='maps_gallery'),
    path('publish-map/<int:map_id>/', views.publish_map, name='publish_map'),
    path('unpublish-map/<int:map_id>/', views.unpublish_map, name='unpublish_map'),
    path('view-map/<int:map_id>/', views.view_map, name='view_map'),
    path('docs/', docs_index, name='docs'),
    path('video-lesson/', views.video_lesson_view, name='video_lesson'),
    path('help/', views.help_view, name='help'),
    path('terms-of-use/', terms_of_use_view, name='terms_of_use'),
    path('privacy-policy/', privacy_policy_view, name='privacy_policy'),
]

# Serving media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
