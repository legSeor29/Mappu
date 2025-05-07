import factory
from django.contrib.auth import get_user_model
from MainApp.models import HashTag

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = get_user_model()

    username = factory.Sequence(lambda n: f'user{n}')
    email = factory.LazyAttribute(lambda obj: f'{obj.username}@example.com')
    password = factory.PostGenerationMethodCall('set_password', 'password123')

class HashTagFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = HashTag

    name = factory.Sequence(lambda n: f'hashtag{n}') 