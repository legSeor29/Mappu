import pytest
from django.urls import reverse
from django.test import Client
from MainApp.tests.factories import UserFactory
from MainApp.models import Map # Import Map

@pytest.mark.django_db
class TestViews:
    @pytest.fixture
    def client(self):
        return Client()

    @pytest.fixture
    def user(self):
        return UserFactory()
    
    @pytest.fixture
    def user_map(self, user):
        """Create a map owned by the test user."""
        return Map.objects.create(owner=user, title="User's Test Map", description="Test Desc")

    def test_main_page_unauthenticated(self, client):
        """Test main page view for unauthenticated user (expects redirect to login)"""
        response = client.get(reverse('main'))
        assert response.status_code == 302
        assert response.url.startswith('/login/') # More robust check

    def test_main_page_authenticated(self, client, user):
        """Test main page view for authenticated user"""
        client.force_login(user)
        response = client.get(reverse('main'))
        assert response.status_code == 200

    def test_register_view_get(self, client):
        """Test user registration page loads (GET)."""
        response = client.get(reverse('register'))
        assert response.status_code == 200

    def test_register_view_post(self, client):
        """Test user registration (POST)."""
        data = {
            'username': 'testuser_reg',
            'email': 'test_reg@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123'
        }
        response = client.post(reverse('register'), data)
        assert response.status_code == 302 # Redirect after successful registration
        assert response.url == reverse('login') # Check redirect target
        # Optionally check if user was created
        from django.contrib.auth import get_user_model
        User = get_user_model()
        assert User.objects.filter(username='testuser_reg').exists()

    def test_profile_view_authenticated(self, client, user):
        """Test profile view for authenticated user"""
        client.force_login(user)
        response = client.get(reverse('profile'))
        assert response.status_code == 200

    def test_profile_view_unauthenticated(self, client):
        """Test profile view for unauthenticated user"""
        response = client.get(reverse('profile'))
        assert response.status_code == 302
        assert response.url.startswith('/login/')

    def test_maps_gallery(self, client):
        """Test maps gallery view"""
        response = client.get(reverse('maps_gallery'))
        assert response.status_code == 200

    # --- New Tests --- 
    def test_create_map_get(self, client, user):
        """Test create map page loads (GET)."""
        client.force_login(user)
        response = client.get(reverse('create_map'))
        assert response.status_code == 200

    def test_create_map_post(self, client, user):
        """Test creating a map (POST)."""
        client.force_login(user)
        map_data = {
            'title': 'Created via Test',
            'description': 'Map created during testing.',
            'center_latitude': 51.0,
            'center_longitude': 0.0,
            'hashtags_input': '#created #test'
        }
        response = client.post(reverse('create_map'), map_data)
        assert response.status_code == 302 # Should redirect to edit_map
        # Find the created map to check redirect URL
        created_map = Map.objects.get(title='Created via Test')
        assert response.url == reverse('edit_map', kwargs={'map_id': created_map.pk})
        assert created_map.owner == user
        assert created_map.hashtags.count() == 2

    def test_view_map(self, client, user_map):
        """Test viewing a specific map."""
        user_map.is_published = True 
        user_map.save()
        response = client.get(reverse('view_map', kwargs={'map_id': user_map.pk}))
        assert response.status_code == 200
        # Check context instead of raw content
        assert 'map' in response.context
        assert response.context['map'].title == user_map.title
        # assert user_map.title in str(response.content) # Less reliable check

    def test_delete_map_post(self, client, user_map):
        """Test deleting a map (POST)."""
        user = user_map.owner
        client.force_login(user)
        map_id = user_map.pk
        response = client.post(reverse('delete_map', kwargs={'map_id': map_id}))
        assert response.status_code == 302 # Should redirect after delete
        assert response.url == reverse('user_maps') # Correct redirect target
        assert not Map.objects.filter(pk=map_id).exists()

    def test_publish_map_post(self, client, user_map):
        """Test publishing a map (POST)."""
        user = user_map.owner
        client.force_login(user)
        user_map.is_published = False
        user_map.save()
        response = client.post(reverse('publish_map', kwargs={'map_id': user_map.pk}))
        user_map.refresh_from_db()
        assert response.status_code == 302 # Assuming redirect
        assert user_map.is_published == True

    def test_unpublish_map_post(self, client, user_map):
        """Test unpublishing a map (POST)."""
        user = user_map.owner
        client.force_login(user)
        user_map.is_published = True
        user_map.save()
        response = client.post(reverse('unpublish_map', kwargs={'map_id': user_map.pk}))
        user_map.refresh_from_db()
        assert response.status_code == 302 # Assuming redirect
        assert user_map.is_published == False
        
    def test_user_maps_view(self, client, user_map):
        """Test the view showing maps owned by the user."""
        user = user_map.owner
        client.force_login(user)
        map2_title = "User's Second Map"
        Map.objects.create(owner=user, title=map2_title)
        response = client.get(reverse('user_maps'))
        assert response.status_code == 200
        # Check context for the list of maps
        assert 'maps' in response.context
        map_titles_in_context = [m['title'] for m in response.context['maps']]
        assert user_map.title in map_titles_in_context
        assert map2_title in map_titles_in_context
        # assert user_map.title in str(response.content) # Less reliable check
        # assert map2_title in str(response.content) # Less reliable check 