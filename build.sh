#!/bin/bash
# Exit on error
set -o errexit

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Creating media directories..."
mkdir -p media/profile_pics

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Расширенная диагностика
echo "===== DIAGNOSTIC INFORMATION ====="
echo "Current directory: $(pwd)"
echo "Python version: $(python --version)"
echo "DATABASE_URL exists: $(if [ -n "$DATABASE_URL" ]; then echo "Yes (length: ${#DATABASE_URL})"; else echo "No"; fi)"
echo "DATABASE_URL starts with: $(if [ -n "$DATABASE_URL" ]; then echo "${DATABASE_URL:0:15}..."; else echo "N/A"; fi)"
echo "RENDER_EXTERNAL_HOSTNAME: $RENDER_EXTERNAL_HOSTNAME"
echo "PYTHON_VERSION: $PYTHON_VERSION"
echo "=================================="

# Проверяем настройки базы данных перед миграцией
echo "Checking database connection..."
python - << END
import os
import sys
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WireMap.settings')

try:
    import django
    django.setup()
    from django.db import connections
    
    # Пробуем подключиться к базе данных
    start_time = time.time()
    connection = connections['default']
    connection.ensure_connection()
    end_time = time.time()
    
    # Если дошли сюда, значит подключение успешно
    print(f"✅ Successfully connected to database in {end_time - start_time:.2f} seconds")
    
    # Показываем параметры подключения
    db_settings = connection.settings_dict
    print(f"Engine: {db_settings['ENGINE']}")
    print(f"Name: {db_settings['NAME']}")
    print(f"User: {db_settings['USER']}")
    print(f"Host: {db_settings['HOST']}")
    print(f"Port: {db_settings['PORT']}")
    
except Exception as e:
    print(f"❌ Error connecting to database: {e}")
    print("Database configuration may be incorrect")
    # Не выходим с ошибкой, продолжаем сборку
END

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