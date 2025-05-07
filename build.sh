#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Установка зависимостей..."
pip install -r requirements.txt

echo "Создание директорий для медиа-файлов..."
mkdir -p media/profile_pics

echo "Сбор статических файлов..."
python manage.py collectstatic --no-input

echo "Применение миграций базы данных..."
python manage.py migrate

echo "Создание суперпользователя..."
python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WireMap.settings')
import django
django.setup()

try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'adminpassword')
        print('Суперпользователь успешно создан')
    else:
        print('Суперпользователь уже существует')
except Exception as e:
    print(f'Ошибка при создании суперпользователя: {e}')
"

echo "Сборка завершена!" 