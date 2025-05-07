import pytest
from MainApp.serializers import MapSerializer, NodeSerializer, EdgeSerializer
from MainApp.tests.factories import UserFactory, HashTagFactory
from MainApp.models import Map, Node, Edge

@pytest.mark.django_db
class TestSerializers:
    @pytest.fixture
    def user(self):
        return UserFactory()

    @pytest.fixture
    def hashtag(self):
        return HashTagFactory()
    
    @pytest.fixture
    def node1(self):
        return Node.objects.create(name="Node 1 Ser", latitude=10, longitude=11)

    @pytest.fixture
    def node2(self):
        return Node.objects.create(name="Node 2 Ser", latitude=20, longitude=22)

    def test_node_serializer_valid(self):
        """Test NodeSerializer with valid data."""
        data = {'name': 'Valid Node', 'latitude': 1.0, 'longitude': 1.0}
        serializer = NodeSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        node = serializer.save()
        assert node.name == data['name']

    def test_node_serializer_invalid_latitude(self):
        """Test NodeSerializer with invalid latitude."""
        data = {'name': 'Invalid Lat Node', 'latitude': 91.0, 'longitude': 1.0}
        serializer = NodeSerializer(data=data)
        assert not serializer.is_valid()
        assert 'latitude' in serializer.errors

    def test_edge_serializer_valid(self, node1, node2):
        """Test EdgeSerializer with valid data."""
        data = {'node1': node1.pk, 'node2': node2.pk, 'description': 'Valid Edge'}
        serializer = EdgeSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
        edge = serializer.save()
        assert edge.node1 == node1
        assert edge.node2 == node2

    def test_edge_serializer_invalid_same_node(self, node1):
        """Test EdgeSerializer validation for same node."""
        data = {'node1': node1.pk, 'node2': node1.pk}
        serializer = EdgeSerializer(data=data)
        assert not serializer.is_valid()
        # The custom validate method raises a non-field error
        assert 'non_field_errors' in serializer.errors or '__all__' in serializer.errors

    def test_map_serializer_create(self, user, hashtag, node1, node2):
        """Test creating a map using MapSerializer with nodes and edges."""
        map_data = {
            'title': 'Test Map Serializer Create',
            'description': 'Test Description Create',
            'is_published': True,
            'hashtags': [hashtag.pk],
            # Nodes and edges are typically handled by nested serializers or separate endpoints
            # If MapSerializer handles nested creation:
            # 'nodes': [{'name': 'Node A', 'latitude': 1, 'longitude': 1}],
            # 'edges_data': [{'node1': node1.pk, 'node2': node2.pk}] # Using edges_data for write
        }
        
        serializer = MapSerializer(data=map_data)
        assert serializer.is_valid(), serializer.errors
        map_obj = serializer.save(owner=user) 
        
        assert map_obj.title == map_data['title']
        assert map_obj.owner == user
        assert map_obj.is_published == map_data['is_published']
        assert hashtag in map_obj.hashtags.all()
        # Add asserts for nodes/edges if nested creation is expected and implemented

    def test_map_serializer_validation_missing_title(self):
        """Test map serializer validation for missing title."""
        map_data = {
            'description': 'Test Description Validation',
            'is_published': True
        }
        serializer = MapSerializer(data=map_data)
        is_valid = serializer.is_valid()
        assert not is_valid, f"Serializer should be invalid due to missing title, but it was valid. Errors: {serializer.errors}"
        assert 'title' in serializer.errors, f"'title' should be in serializer errors, but errors are: {serializer.errors}"
        assert 'owner' not in serializer.errors, f"'owner' should not be in serializer errors as it is read-only, but errors are: {serializer.errors}" 