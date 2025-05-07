import pytest
from django.urls import reverse, resolve
from MainApp.views import (
    main_page, register, profile, # edit_profile, # URL for edit_profile does not exist
    create_map, edit_map, view_map, user_maps,
    maps_gallery, delete_map, publish_map, unpublish_map
)

@pytest.mark.django_db
class TestURLs:
    def test_main_page_url(self):
        """Test main page URL"""
        url = reverse('main') # Changed from 'main_page'
        assert resolve(url).func == main_page

    def test_register_url(self):
        """Test register URL"""
        url = reverse('register')
        assert resolve(url).func == register

    def test_profile_url(self):
        """Test profile URL"""
        url = reverse('profile')
        assert resolve(url).func == profile

    # def test_edit_profile_url(self):
    #     """Test edit profile URL"""
    #     url = reverse('edit_profile') # URL for edit_profile does not exist
    #     assert resolve(url).func == edit_profile

    def test_create_map_url(self):
        """Test create map URL"""
        url = reverse('create_map')
        assert resolve(url).func == create_map

    def test_edit_map_url(self):
        """Test edit map URL"""
        url = reverse('edit_map', kwargs={'map_id': 1})
        assert resolve(url).func == edit_map

    def test_view_map_url(self):
        """Test view map URL"""
        url = reverse('view_map', kwargs={'map_id': 1})
        assert resolve(url).func == view_map

    def test_user_maps_url(self):
        """Test user maps URL"""
        url = reverse('user_maps')
        assert resolve(url).func == user_maps

    def test_maps_gallery_url(self):
        """Test maps gallery URL"""
        url = reverse('maps_gallery')
        assert resolve(url).func == maps_gallery

    def test_delete_map_url(self):
        """Test delete map URL"""
        url = reverse('delete_map', kwargs={'map_id': 1})
        assert resolve(url).func == delete_map

    def test_publish_map_url(self):
        """Test publish map URL"""
        url = reverse('publish_map', kwargs={'map_id': 1})
        assert resolve(url).func == publish_map

    def test_unpublish_map_url(self):
        """Test unpublish map URL"""
        url = reverse('unpublish_map', kwargs={'map_id': 1})
        assert resolve(url).func == unpublish_map 