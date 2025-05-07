#!/bin/bash
# Exit on error
set -o errexit

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Creating media directories..."
mkdir -p media/profile_pics

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Applying database migrations..."
python manage.py migrate

echo "Creating superuser if needed..."
python - << END
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WireMap.settings')
import django
django.setup()

try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'adminpassword')
        print('Superuser created successfully')
    else:
        print('Superuser already exists')
except Exception as e:
    print(f'Error creating superuser: {e}')
END

echo "Build completed!" 