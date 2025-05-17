# Используем официальный образ Python
FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем переменные окружения
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV DJANGO_SETTINGS_MODULE=WireMap.settings

# Создаем рабочую директорию
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Создаем скрипт для проверки базы данных
RUN echo '#!/bin/bash\n\
echo "Waiting for database..."\n\
while ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; do\n\
    sleep 1\n\
done\n\
echo "Database is ready!"\n\
' > /app/wait-for-db.sh && chmod +x /app/wait-for-db.sh

# Собираем статику Django
RUN python manage.py collectstatic --noinput

# Создаем скрипт для запуска
RUN echo '#!/bin/bash\n\
/app/wait-for-db.sh\n\
python manage.py migrate\n\
gunicorn WireMap.wsgi:application --bind 0.0.0.0:${PORT}\n\
' > /app/start.sh && chmod +x /app/start.sh

# Команда для запуска
CMD ["/app/start.sh"]