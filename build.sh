#!/bin/bash
# Выход при ошибке
set -o errexit

echo "Установка зависимостей..."
pip install -r requirements.txt

echo "Ожидание готовности базы данных..."
# Извлекаем имя пользователя из DATABASE_URL
DB_USER=$(python -c "import os; from urllib.parse import urlparse; print(urlparse(os.getenv('DATABASE_URL', '')).username or 'myuser')")
# Ожидаем готовности базы данных с правильным пользователем
until pg_isready -U "$DB_USER"; do
    echo "Ожидание подключения к базе данных..."
    sleep 2
done

echo "Сборка статических файлов..."
python manage.py collectstatic --noinput

echo "Сборка успешно завершена!" 