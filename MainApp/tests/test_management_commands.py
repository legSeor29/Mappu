import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from MainApp.tests.factories import UserFactory
from django.contrib.auth import get_user_model

@pytest.mark.django_db
class TestManagementCommands:
    def test_mgmt_create_superuser_command(self):
        """Test create superuser command"""
        User = get_user_model()
        call_command('createsuperuser',
                    username='mgmt_super',
                    email='mgmt_super@example.com',
                    interactive=False)
        user = User.objects.get(username='mgmt_super')
        assert user.is_superuser
        assert user.is_staff

    def test_mgmt_create_superuser_command_missing_username(self):
        """Test create superuser command with missing username"""
        with pytest.raises(CommandError):
            call_command('createsuperuser',
                        email='mgmt_missing_user@example.com',
                        interactive=False)

    def test_mgmt_create_superuser_command_missing_email(self):
        """Test create superuser command with missing email"""
        with pytest.raises(CommandError):
            call_command('createsuperuser',
                        username='mgmt_missing_email',
                        interactive=False)

    def test_mgmt_create_superuser_command_duplicate_username(self):
        """Test create superuser command with duplicate username"""
        User = get_user_model()
        UserFactory(username='mgmt_duplicate')
        with pytest.raises(CommandError):
            call_command('createsuperuser',
                        username='mgmt_duplicate',
                        email='mgmt_duplicate@example.com',
                        interactive=False) 