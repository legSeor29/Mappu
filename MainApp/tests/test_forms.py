import pytest
from django.core.exceptions import ValidationError # Now needed for EdgeForm test
from MainApp.forms import UserRegistrationForm, UserProfileForm, CreateMapForm, NodeForm, EdgeForm
from MainApp.models import Node, HashTag # Import Node for EdgeForm test
from MainApp.tests.factories import UserFactory, HashTagFactory # Import factories

@pytest.mark.django_db
class TestForms:
    def test_user_registration_form_valid(self):
        """Test valid user registration form data"""
        form_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password1': 'testpass123',
            'password2': 'testpass123'
            # 'phone' is optional in UserRegistrationForm based on form definition
        }
        form = UserRegistrationForm(data=form_data)
        assert form.is_valid(), form.errors

    def test_user_registration_form_password_mismatch(self):
        """Test user registration form with mismatched passwords"""
        form_data = {
            'username': 'testuser2',
            'email': 'test2@example.com',
            'password1': 'testpass123',
            'password2': 'differentpass'
        }
        form = UserRegistrationForm(data=form_data)
        assert not form.is_valid()
        assert 'password2' in form.errors

    def test_user_registration_form_invalid_email(self):
        """Test user registration form with invalid email"""
        form_data = {
            'username': 'testuser3',
            'email': 'invalid-email',
            'password1': 'testpass123',
            'password2': 'testpass123'
        }
        form = UserRegistrationForm(data=form_data)
        assert not form.is_valid()
        assert 'email' in form.errors

    def test_user_profile_form_valid(self):
        """Test valid user profile form data"""
        # UserProfileForm requires 'username'. 'phone' and 'image' are optional or handled by clean_image.
        form_data = {
            'username': 'profileuser',
            'email': 'profile@example.com',
            'phone': '1234567890', # Added phone
            # 'image' can be omitted if not required or if a default/None is acceptable
        }
        form = UserProfileForm(data=form_data)
        assert form.is_valid(), form.errors

    def test_user_profile_form_invalid_email(self):
        """Test user profile form with invalid email"""
        form_data = {
            'username': 'profileuser2',
            'email': 'invalid-email',
            'phone': '0987654321' # Added phone
        }
        form = UserProfileForm(data=form_data)
        assert not form.is_valid()
        assert 'email' in form.errors

    # --- New Tests --- 
    def test_create_map_form_valid(self):
        """Test valid CreateMapForm data"""
        form_data = {
            'title': 'My New Map',
            'description': 'A map created via form.',
            'center_latitude': 55.75,
            'center_longitude': 37.61,
            'hashtags_input': '#test #map #form'
        }
        form = CreateMapForm(data=form_data)
        assert form.is_valid(), form.errors

    def test_create_map_form_save_hashtags(self):
        """Test that CreateMapForm correctly saves hashtags."""
        form_data = {
            'title': 'Map With Hashtags',
            'description': 'Testing hashtag saving.',
            'center_latitude': 50.0,
            'center_longitude': 10.0,
            'hashtags_input': '#unique #tag1 tag2 #test'
        }
        form = CreateMapForm(data=form_data)
        assert form.is_valid(), form.errors
        owner = UserFactory()
        instance = form.save(commit=False)
        instance.owner = owner
        # Need to call save with commit=True to trigger hashtag processing
        form.save(commit=True) 
        instance.refresh_from_db() # Refresh instance to get updated M2M fields

        assert instance.pk is not None
        assert instance.hashtags.count() == 4, f"Expected 4 hashtags, got {instance.hashtags.count()}"
        assert HashTag.objects.filter(name='unique').exists()
        assert HashTag.objects.filter(name='tag1').exists()
        assert HashTag.objects.filter(name='tag2').exists()
        assert HashTag.objects.filter(name='test').exists()
        assert all(tag.name in ['unique', 'tag1', 'tag2', 'test'] for tag in instance.hashtags.all())

    def test_node_form_valid(self):
        """Test valid NodeForm data."""
        form_data = {
            'name': 'Test Node',
            'latitude': 55.1,
            'longitude': 37.2,
            'description': 'Node desc'
        }
        form = NodeForm(data=form_data)
        assert form.is_valid(), form.errors

    def test_edge_form_valid(self):
        """Test valid EdgeForm data."""
        node1 = Node.objects.create(name='Node 1', latitude=1, longitude=1)
        node2 = Node.objects.create(name='Node 2', latitude=2, longitude=2)
        form_data = {
            'node1': node1.pk,
            'node2': node2.pk,
            'description': 'Edge desc'
        }
        form = EdgeForm(data=form_data)
        assert form.is_valid(), form.errors

    def test_edge_form_invalid_same_node(self):
        """Test EdgeForm validation when node1 and node2 are the same."""
        node1 = Node.objects.create(name='Node Same', latitude=3, longitude=3)
        form_data = {
            'node1': node1.pk,
            'node2': node1.pk,
            'description': 'Invalid edge'
        }
        form = EdgeForm(data=form_data)
        # Ensure the clean method was added to EdgeForm in forms.py
        assert not form.is_valid(), "Form should be invalid if node1 and node2 are the same."
        # Check for the specific non-field error raised by the clean method
        assert '__all__' in form.errors
        assert any('Ребро не может соединять узел сам с собой.' in e for e in form.errors['__all__']) 