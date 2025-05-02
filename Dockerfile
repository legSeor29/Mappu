# Используем официальный образ Python
FROM python:3.13-slim

# Устанавливаем переменные окружения
ENV PYTHONUNBUFFERED=1

# Создаем рабочую директорию
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Собираем статику Django
RUN python manage.py collectstatic --noinput

# Команда для запуска Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "myproject.wsgi"]