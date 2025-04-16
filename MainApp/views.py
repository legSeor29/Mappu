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

def api_data(request, map_id):
    map_obj = get_object_or_404(
        Map.objects.prefetch_related('nodes', 'edges'),
        pk=map_id
    )
    max_node_id = Node.objects.aggregate(Max('id'))['id__max'] or 0
    max_edge_id = Edge.objects.aggregate(Max('id'))['id__max'] or 0

    # Сериализуем узлы
    nodes_data = [
        {
            'id': node.id,
            'name': node.name,
            'lat': node.latitude,
            'lng': node.longitude,
            'z': node.z_coordinate,
            'description': node.description
        }
        for node in map_obj.nodes.all()
    ]

    # Сериализуем связи
    edges_data = [
        {
            'id': edge.id,
            'from': edge.node1_id,
            'to': edge.node2_id,
            'description': edge.description
        }
        for edge in map_obj.edges.all()
    ]

    # Собираем общий контекст
    data = {
        'map': {
            'title': map_obj.title,
            'center': {
                'lat': map_obj.center_latitude,
                'lng': map_obj.center_longitude
            }
        },
        'nodes': nodes_data,
        'edges': edges_data,

        'max_ids': {
            'node': max_node_id,
            'edge': max_edge_id
        }
    }

    return JsonResponse(data, safe=False)

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
        })

    context = {
        'maps': maps_with_stats,
        'title': 'Мои карты'
    }

    return render(request, 'my_maps.html', context)



def maps_gallery(request):
    pass