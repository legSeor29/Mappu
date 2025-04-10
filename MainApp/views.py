from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.exceptions import PermissionDenied
from .forms import UserRegistrationForm, NodeForm, EdgeForm, CreateMapForm
from .models import Node, Edge, Map
from django.http import JsonResponse, HttpResponseForbidden
from django.db.models import Max
from .serializers import MapSerializer
from .permissions import IsMapOwner
from rest_framework import generics

class MapDetailAPI(generics.RetrieveUpdateDestroyAPIView):
    queryset = Map.objects.all()
    serializer_class = MapSerializer
    permission_classes = [IsMapOwner]

    def perform_update(self, serializer):
        # Дополнительные проверки при обновлении
        if serializer.instance.owner != self.request.user:
            raise PermissionDenied("Вы не можете изменять эту карту")
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