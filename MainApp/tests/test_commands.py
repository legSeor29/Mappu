import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from MainApp.tests.factories import UserFactory
from django.contrib.auth import get_user_model

@pytest.mark.django_db
class TestCommands:
    def test_create_superuser_command(self):
        """Test create superuser command"""
        User = get_user_model()
        call_command('createsuperuser',
                    username='cmd_super_new',
                    email='cmd_super_new@example.com',
                    interactive=False)
        user = User.objects.get(username='cmd_super_new')
        assert user.is_superuser
        assert user.is_staff

    def test_create_superuser_command_missing_username(self):
        """Test create superuser command with missing username"""
        with pytest.raises(CommandError):
            call_command('createsuperuser',
                        email='cmd_missing_user_new@example.com',
                        interactive=False)

    def test_create_superuser_command_missing_email(self):
        """Test create superuser command with missing email"""
        with pytest.raises(CommandError):
            call_command('createsuperuser',
                        username='cmd_missing_email_new',
                        interactive=False)

    def test_create_superuser_command_duplicate_username(self):
        """Test create superuser command with duplicate username"""
        UserFactory(username='cmd_duplicate_new')
        with pytest.raises(CommandError):
            call_command('createsuperuser',
                        username='cmd_duplicate_new',
                        email='cmd_duplicate_new@example.com',
                        interactive=False) 