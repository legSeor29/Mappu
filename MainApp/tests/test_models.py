import pytest
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from MainApp.models import HashTag

@pytest.mark.django_db
class TestHashTagModel:
    def test_create_hashtag(self):
        """Test creating a hashtag"""
        hashtag = HashTag.objects.create(name="test")
        assert hashtag.name == "test"
        assert str(hashtag) == "test"

    def test_hashtag_name_lowercase(self):
        """Test that hashtag name is converted to lowercase"""
        hashtag = HashTag.objects.create(name="TEST")
        assert hashtag.name == "test"

    def test_unique_hashtag_name(self):
        """Test that hashtag names must be unique at the database level"""
        HashTag.objects.create(name="test")
        with pytest.raises(IntegrityError):
            HashTag.objects.create(name="test")

    def test_hashtag_max_length(self):
        """Test that hashtag name cannot exceed max length upon full_clean"""
        long_name = "a" * 51
        hashtag = HashTag(name=long_name)
        with pytest.raises(ValidationError):
            hashtag.full_clean()
        # To test database level constraint (optional, as full_clean is preferred for model validation):
        # with pytest.raises(DataError): # Or appropriate DB error for exceeding max_length
        #     HashTag.objects.create(name=long_name) 