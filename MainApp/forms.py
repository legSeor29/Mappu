from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser, Node, Edge, Map, HashTag


class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'phone')

class CustomUserChangeForm(UserChangeForm):

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'phone')

class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={'class': 'form-control'}))
    phone = forms.CharField(max_length=20, required=False, widget=forms.TextInput(attrs={'class': 'form-control'}))
    
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'phone', 'password1', 'password2')

    def __init__(self, *args, **kwargs):
        super(UserRegistrationForm, self).__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'class': 'form-control'})
        self.fields['password1'].widget.attrs.update({'class': 'form-control'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control'})

class CreateMapForm(forms.ModelForm):
    hashtags_input = forms.CharField(
        max_length=200, 
        required=False, 
        label='Хештеги',
        help_text='Введите хештеги через пробел (например: #природа #город #маршрут)',
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': '#природа #город #маршрут'})
    )
    
    class Meta:
        model = Map
        fields = ['title', 'description', 'center_latitude', 'center_longitude', 'hashtags_input']
        
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        if commit:
            instance.save()
            
            # Handle hashtags
            if self.cleaned_data.get('hashtags_input'):
                # Clear existing hashtags
                instance.hashtags.clear()
                
                # Process hashtags
                hashtags_text = self.cleaned_data['hashtags_input'].strip()
                hashtag_names = [tag.strip().lower() for tag in hashtags_text.split() if tag.strip()]
                
                # Remove # symbol if present
                hashtag_names = [name[1:] if name.startswith('#') else name for name in hashtag_names]
                
                # Add hashtags to the map
                for tag_name in hashtag_names:
                    if tag_name:  # Skip empty tags
                        tag, created = HashTag.objects.get_or_create(name=tag_name)
                        instance.hashtags.add(tag)
                        
            self.save_m2m()
            
        return instance

class NodeForm(forms.ModelForm):
    class Meta:
        model = Node
        fields = ['name', 'latitude', 'longitude', 'description', 'z_coordinate']

class EdgeForm(forms.ModelForm):
    class Meta:
        model = Edge
        fields = ['node1', 'node2', 'description']

class UserProfileForm(forms.ModelForm):
    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'phone', 'image']
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'phone': forms.TextInput(attrs={'class': 'form-control'}),
        }
        
    def clean_image(self):
        image = self.cleaned_data.get('image', False)
        if image and hasattr(image, 'size'):
            if image.size > 5 * 1024 * 1024:  # 5MB
                raise forms.ValidationError("Размер изображения не должен превышать 5 МБ")
            return image
        # Если изображение не выбрано, вернуть текущее
        elif self.instance and self.instance.pk:
            return self.instance.image
        return None

class AvatarUpdateForm(forms.ModelForm):
    class Meta:
        model = CustomUser
        fields = ['image']
        
    def clean_image(self):
        image = self.cleaned_data.get('image', False)
        if image and hasattr(image, 'size'):
            if image.size > 5 * 1024 * 1024:  # 5MB
                raise forms.ValidationError("Размер изображения не должен превышать 5 МБ")
            return image
        # Если изображение не выбрано, вернуть текущее
        elif self.instance and self.instance.pk:
            return self.instance.image
        return None