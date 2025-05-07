import pytest
from django.contrib.auth.models import Permission
from MainApp.tests.factories import UserFactory

@pytest.mark.django_db
class TestPermissions:
    @pytest.fixture
    def owner(self):
        return UserFactory()

    @pytest.fixture
    def other_user(self):
        return UserFactory()

    def test_user_permissions(self, owner, other_user):
        """Test basic user permissions"""
        assert owner.is_authenticated
        assert other_user.is_authenticated
        assert owner != other_user 