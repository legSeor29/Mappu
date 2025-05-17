#!/bin/bash
# Выход при ошибке
set -e

echo "Установка зависимостей..."
pip install -r requirements.txt

echo "Сборка статических файлов..."
python manage.py collectstatic --noinput

echo "Сборка успешно завершена!" 