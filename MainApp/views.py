from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework import status
from .forms import UserRegistrationForm, NodeForm, EdgeForm, CreateMapForm, UserProfileForm, AvatarUpdateForm
from .models import Node, Edge, Map, CustomUser, HashTag
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
    """
    Представление главной страницы сайта.
    
    Отображает списки карт пользователя и публичных карт других пользователей.
    
    Args:
        request: Объект HttpRequest
        
    Returns:
        HttpResponse: Ответ с отрендеренным шаблоном
    
    Raises:
        Exception: При ошибке получения публичных карт
    """
    logger.info("Main page accessed")
    logger.debug("User: {0}".format(request.user))
    
    # Получаем все карты пользователя
    user_maps = Map.objects.filter(owner=request.user)
    try:
        # Получаем публичные карты других пользователей
        public_maps = Map.objects.filter(is_published=True).exclude(owner=request.user)
        logger.debug("Found {0} public maps".format(len(public_maps)))
    except Exception as e:
        logger.error("Error fetching public maps: {0}".format(e))
        public_maps = []
    
    logger.debug("Found {0} user maps".format(len(user_maps)))
    
    context = {
        'user_maps': user_maps,
        'public_maps': public_maps
    }
    return render(request, 'main_page.html', context)


def register(request):
    """
    Представление для регистрации новых пользователей.
    
    Args:
        request: Объект HttpRequest
        
    Returns:
        HttpResponse: При GET-запросе - форма регистрации,
                      При POST-запросе с валидной формой - перенаправление на страницу входа
    """
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            messages.success(request, 'Регистрация успешна! Теперь вы можете войти в систему.')
            return redirect('login')  # перенаправляем на страницу входа
    else:
        form = UserRegistrationForm()
    
    return render(request, 'register.html', {'form': form})

@login_required
def profile(request):
    """
    Представление страницы профиля пользователя.
    
    Отображает информацию о пользователе, количество его карт и последнюю редактируемую карту.
    
    Args:
        request: Объект HttpRequest с аутентифицированным пользователем
        
    Returns:
        HttpResponse: Ответ с отрендеренным шаблоном профиля
    
    Raises:
        Exception: При ошибке получения последней карты
    """
    user = request.user
    maps_count = Map.objects.filter(owner=user).count()
    
    if request.method == 'POST':
        form = AvatarUpdateForm(request.POST, request.FILES, instance=user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Аватар успешно обновлен')
            return redirect('profile')
    else:
        form = AvatarUpdateForm(instance=user)
    
    try:
        latest_map = Map.objects.filter(owner=user).order_by('-updated_at').first()
    except Exception as e:
        latest_map = None
        messages.error(request, "Ошибка при получении последней карты: {0}".format(str(e)))
    
    context = {
        'user': user,
        'maps_count': maps_count,
        'latest_map': latest_map,
        'form': form
    }
    
    return render(request, 'profile.html', context)


@login_required
def create_map(request):
    """
    Представление для создания новой карты.
    
    Args:
        request: Объект HttpRequest с аутентифицированным пользователем
        
    Returns:
        HttpResponse: При GET-запросе - форма создания карты,
                      При POST-запросе с валидной формой - перенаправление на страницу редактирования карты
    """
    if request.method == 'POST':
        # Pass the user to the form
        form = CreateMapForm(request.POST, user=request.user) 
        if form.is_valid():
            # Call save with commit=True, form now handles owner and hashtags
            map_instance = form.save() 
            
            messages.success(request, 'Карта успешно создана!')
            return redirect('edit_map', map_id=map_instance.id)
    else:
        # Pass user for GET request if needed by form init, though not currently used there
        form = CreateMapForm(user=request.user)

    return render(request, 'create_map.html', {'form': form})

def edit_map(request, map_id):
    map_obj = get_object_or_404(Map, pk=map_id)
    if map_obj.owner != request.user:
        return HttpResponseForbidden()
    node_form = NodeForm()
    edge_form = EdgeForm()
    errors = []

    # Initial hashtags string for the form
    hashtags_str = ' '.join([f"#{tag.name}" for tag in map_obj.hashtags.all()])

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
                
        elif 'hashtags_submit' in request.POST:
            hashtags_text = request.POST.get('hashtags_input', '').strip()
            
            # Clear existing hashtags
            map_obj.hashtags.clear()
            
            # Process the hashtags
            hashtag_names = [tag.strip().lower() for tag in hashtags_text.split() if tag.strip()]
            # Remove # symbol if present
            hashtag_names = [name[1:] if name.startswith('#') else name for name in hashtag_names]
            
            # Add hashtags to the map
            for tag_name in hashtag_names:
                if tag_name:  # Skip empty tags
                    tag, created = HashTag.objects.get_or_create(name=tag_name)
                    map_obj.hashtags.add(tag)
            
            # Update the hashtags string for the form
            hashtags_str = ' '.join([f"#{tag.name}" for tag in map_obj.hashtags.all()])
            messages.success(request, 'Хештеги успешно обновлены!')

    return render(request, 'edit_map.html', {
        'node_form': node_form,
        'edge_form': edge_form,
        'map_id': map_id,
        'errors': errors,
        'map': map_obj,
        'hashtags_str': hashtags_str,
    })


@login_required
def user_maps(request):
    maps = Map.objects.filter(owner=request.user).prefetch_related('nodes', 'edges', 'hashtags')

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
            'hashtags': map_obj.hashtags.all(),
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
    # Get hashtag filter parameter
    hashtag_filter = request.GET.get('hashtag', '').strip().lower()
    
    # Base queryset - published maps
    maps_queryset = Map.objects.filter(is_published=True)
    
    # Apply hashtag filtering if provided
    active_hashtag = None
    if hashtag_filter:
        # Remove # if present
        if hashtag_filter.startswith('#'):
            hashtag_filter = hashtag_filter[1:]
        
        # Store active hashtag for template
        active_hashtag = hashtag_filter
        
        # Filter maps by hashtag
        maps_queryset = maps_queryset.filter(hashtags__name=hashtag_filter)
    
    # Prefetch related data for performance
    maps = maps_queryset.prefetch_related('nodes', 'edges', 'owner', 'hashtags').distinct()
    
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
            'hashtags': map_obj.hashtags.all(),
        })

    context = {
        'maps': maps_with_stats,
        'title': 'Галерея карт',
        'active_hashtag': active_hashtag,
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
    """
    Представление для просмотра карты без возможности редактирования.
    
    Проверяет права доступа к карте и отображает карту с её деталями.
    
    Args:
        request: Объект HttpRequest
        map_id: Идентификатор карты для просмотра
        
    Returns:
        HttpResponse: Ответ с отрендеренным шаблоном просмотра карты
                      или перенаправление на главную страницу при отсутствии прав доступа
    """
    map_instance = get_object_or_404(Map, id=map_id)
    
    # Проверяем, что карта опубликована или пользователь ее владелец
    if not map_instance.is_published and (not request.user.is_authenticated or map_instance.owner != request.user):
        messages.error(request, 'У вас нет доступа к этой карте')
        return redirect('main_page')
    
    return render(request, 'view_map.html', {
        'map': map_instance,
        'is_owner': request.user.is_authenticated and map_instance.owner == request.user
    })

@login_required
def docs_index(request):
    """
    Представление для перенаправления на главную страницу документации.
    
    Args:
        request: Объект HttpRequest с аутентифицированным пользователем
        
    Returns:
        HttpResponse: Перенаправление на главную страницу документации Sphinx
    """
    return redirect('/static/index.html')

def video_lesson_view(request):
    return render(request, 'video_lesson.html')

def help_view(request):
    return render(request, 'help.html')

def terms_of_use_view(request):
    return render(request, 'terms_of_use.html')