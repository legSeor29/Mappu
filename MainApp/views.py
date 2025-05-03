from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework import status
from .forms import UserRegistrationForm, NodeForm, EdgeForm, CreateMapForm, UserProfileForm, AvatarUpdateForm
from .models import Node, Edge, Map, CustomUser
from django.http import JsonResponse, HttpResponseForbidden
from django.db.models import Max
from .serializers import MapSerializer
from .permissions import IsMapOwner
from rest_framework import generics
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout


import logging

logger = logging.getLogger(__name__)

class MapDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = Map.objects.all()
    serializer_class = MapSerializer
    permission_classes = [IsMapOwner]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            logger.info(f"Запрос на обновление карты ID: {instance.id}")
            logger.debug(f"Данные запроса: {request.data}")
            
            # Проверка прав доступа
            if instance.owner != request.user:
                logger.warning(f"Отказ в доступе: пользователь {request.user} пытается редактировать карту пользователя {instance.owner}")
                raise PermissionDenied("Вы не можете изменять эту карту")
            
            # Всегда используем partial=True, так как используется только PATCH
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            
            if not serializer.is_valid():
                logger.error(f"Ошибка валидации: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            self.perform_update(serializer)
            logger.info(f"Карта ID: {instance.id} успешно обновлена")
            return Response(serializer.data)
            
        except Exception as e:
            logger.exception("Ошибка при обновлении карты")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_update(self, serializer):
        serializer.save()

@login_required
def main_page(request):
    return render(request, 'main_page.html')


def register(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            messages.success(request, f'Аккаунт создан для {user.username}! Теперь вы можете войти в систему.')
            return redirect('login')
    else:
        form = UserRegistrationForm()
    return render(request, 'register.html', {'form': form})

@login_required
def profile(request):
    if request.method == 'POST':
        form = AvatarUpdateForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Аватар успешно обновлен!')
            return redirect('profile')
    else:
        form = AvatarUpdateForm(instance=request.user)
    
    context = {
        'form': form,
        'user': request.user,
    }
    return render(request, 'profile.html', context)


@login_required
def create_map(request):
    if request.method == 'POST':
        form = CreateMapForm(request.POST)
        print(f"Form is valid: {form.is_valid()}")
        if form.is_valid():
            # Создаём объект карты без сохранения в БД
            new_map = form.save(commit=False)
            # Устанавливаем владельца из текущего пользователя
            print(f"Current user: {request.user}, id: {request.user.id}, is authenticated: {request.user.is_authenticated}")
            new_map.owner = request.user
            # Сохраняем в БД
            try:
                new_map.save()
                # Сохраняем M2M связи, если они есть в форме
                form.save_m2m()
                messages.success(request, 'Карта успешно создана!')
                return redirect('main')
            except Exception as e:
                print(f"Error saving map: {e}")
                messages.error(request, f'Ошибка при создании карты: {e}')
    else:
        form = CreateMapForm()

    return render(request, 'create_map.html', {
        'form': form,
    })

def edit_map(request, map_id):
    map_obj = get_object_or_404(Map, pk=map_id)
    if map_obj.owner != request.user:
        return HttpResponseForbidden()
    node_form = NodeForm()
    edge_form = EdgeForm()
    errors = []

    if request.method == 'POST':
        print(request.POST)
        if 'node_submit' in request.POST:
            node_form = NodeForm(request.POST)
            if node_form.is_valid():
                new_node = node_form.save()
                map_instance = Map.objects.get(id=map_id)
                map_instance.nodes.add(new_node)
            else:
                errors.append("Node save error.")

        elif 'edge_submit' in request.POST:
            edge_form = EdgeForm(request.POST)
            if edge_form.is_valid():
                new_edge = edge_form.save()
                map_instance = Map.objects.get(id=map_id)
                map_instance.edges.add(new_edge)
            else:
                errors.append("Edge save error.")

    return render(request, 'edit_map.html', {
        'node_form': node_form,
        'edge_form': edge_form,
        'map_id': map_id,
        'errors': errors,
    })


@login_required
def user_maps(request):
    maps = Map.objects.filter(owner=request.user).prefetch_related('nodes', 'edges')

    # Создаем список карт с дополнительной информацией
    maps_with_stats = []
    for map_obj in maps:
        maps_with_stats.append({
            'id': map_obj.id,
            'title': map_obj.title,
            'description': map_obj.description,
            'center_latitude': map_obj.center_latitude,
            'center_longitude': map_obj.center_longitude,
            'nodes_count': map_obj.nodes.count(),
            'edges_count': map_obj.edges.count(),
            'created_at': map_obj.created_at if hasattr(map_obj, 'created_at') else None,
            'is_published': map_obj.is_published,
        })

    context = {
        'maps': maps_with_stats,
        'title': 'Мои карты'
    }

    return render(request, 'my_maps.html', context)


@login_required
def delete_map(request, map_id):
    map_obj = get_object_or_404(Map, id=map_id, owner=request.user)
    if request.method == 'POST':
        map_obj.delete()
        return redirect('user_maps')  # Перенаправляем обратно на список карт
    return redirect('user_maps')


def maps_gallery(request):
    maps = Map.objects.filter(is_published=True).prefetch_related('nodes', 'edges', 'owner')
    
    # Create a list of maps with additional information
    maps_with_stats = []
    for map_obj in maps:
        maps_with_stats.append({
            'id': map_obj.id,
            'title': map_obj.title,
            'description': map_obj.description,
            'center_latitude': map_obj.center_latitude,
            'center_longitude': map_obj.center_longitude,
            'nodes_count': map_obj.nodes.count(),
            'edges_count': map_obj.edges.count(),
            'owner': map_obj.owner.username,
            'created_at': map_obj.created_at if hasattr(map_obj, 'created_at') else None,
        })

    context = {
        'maps': maps_with_stats,
        'title': 'Галерея карт'
    }

    return render(request, 'maps_gallery.html', context)

def custom_logout(request):
    logout(request)
    return redirect('login')


@login_required
def publish_map(request, map_id):
    map_obj = get_object_or_404(Map, id=map_id, owner=request.user)
    if request.method == 'POST':
        map_obj.is_published = True
        map_obj.save()
        messages.success(request, 'Карта успешно опубликована!')
    return redirect('user_maps')

@login_required
def unpublish_map(request, map_id):
    map_obj = get_object_or_404(Map, id=map_id, owner=request.user)
    if request.method == 'POST':
        map_obj.is_published = False
        map_obj.save()
        messages.success(request, 'Карта снята с публикации!')
    return redirect('user_maps')

def view_map(request, map_id):
    map_obj = get_object_or_404(Map, id=map_id)
    
    # Создаем контекст с информацией о карте
    context = {
        'map': {
            'id': map_obj.id,
            'title': map_obj.title,
            'description': map_obj.description,
            'center_latitude': map_obj.center_latitude,
            'center_longitude': map_obj.center_longitude,
            'nodes_count': map_obj.nodes.count(),
            'edges_count': map_obj.edges.count(),
            'owner': map_obj.owner.username,
            'created_at': map_obj.created_at if hasattr(map_obj, 'created_at') else None,
            'nodes': map_obj.nodes.all(),
            'edges': map_obj.edges.all(),
        }
    }

    return render(request, 'view_map.html', context)