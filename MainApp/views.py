from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework import status
from .forms import UserRegistrationForm, NodeForm, EdgeForm, CreateMapForm
from .models import Node, Edge, Map
from django.http import JsonResponse, HttpResponseForbidden
from django.db.models import Max
from .serializers import MapSerializer
from .permissions import IsMapOwner
from rest_framework import generics
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
            form.save()
            return redirect('login')  # Перенаправление на страницу входа
    else:
        form = UserRegistrationForm()
    return render(request, 'register.html', {'form': form})

def profile(request):
    pass


@login_required
def create_map(request):
    if request.method == 'POST':
        form = CreateMapForm(request.POST)
        if form.is_valid():
            # Создаём объект карты без сохранения в БД
            new_map = form.save(commit=False)
            # Устанавливаем владельца из текущего пользователя
            new_map.owner = request.user
            # Сохраняем в БД
            new_map.save()
            # Сохраняем M2M связи, если они есть в форме
            form.save_m2m()

            messages.success(request, 'Карта успешно создана!')
            return redirect('main')
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
def maps_gallery(request):
    pass