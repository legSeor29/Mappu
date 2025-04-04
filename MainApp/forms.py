from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import Node, Edge, Map

class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

class CreateMapForm(forms.ModelForm):
    class Meta:
        model = Map
        fields = ['title', 'description', 'center_latitude', 'center_longitude']

class NodeForm(forms.ModelForm):
    class Meta:
        model = Node
        fields = ['name', 'latitude', 'longitude', 'description', 'z_coordinate']

class EdgeForm(forms.ModelForm):
    class Meta:
        model = Edge
        fields = ['node1', 'node2', 'description']