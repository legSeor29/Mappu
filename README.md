# Mappu - Интерактивные карты

![Version](https://img.shields.io/badge/версия-1.0.0-blue)
![Django](https://img.shields.io/badge/Django-5.1.6-green)
![Python](https://img.shields.io/badge/Python-3.8+-yellow)
![Pylint](https://img.shields.io/badge/pylint-8.81%2F10-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-77%25-green)


Веб-приложение для создания и управления интерактивными картами с поддержкой многопользовательской работы и публикации.

## 📋 Особенности

- 🗺️ **Интерактивные карты** - создавайте карты с узлами и связями между ними
- 🔄 **Совместная работа** - делитесь картами с другими пользователями
- 🔍 **Поиск по хэштегам** - находите карты по интересующим вас темам
- 👤 **Управление профилем** - настраивайте информацию о себе
- 🔐 **Разграничение доступа** - публичные и приватные карты

## 🚀 Установка и запуск

### Требования

- Python 3.8+
- Django 5.1.6+
- Другие зависимости из requirements.txt

### Шаги установки

1. **Клонирование репозитория**
   ```bash
   git clone <репозиторий>
   cd final-project-kalinin-team
   ```

2. **Создание виртуального окружения**
   ```bash
   python -m venv venv
   source venv/bin/activate   # На Linux/Mac
   venv\Scripts\activate      # На Windows
   ```

3. **Установка зависимостей**
   ```bash
   pip install -r requirements.txt
   ```

4. **Настройка базы данных**
   ```bash
   python manage.py migrate
   ```

5. **Создание суперпользователя**
   ```bash
   python manage.py createsuperuser
   ```

6. **Запуск сервера разработки**
   ```bash
   python manage.py runserver
   ```

После выполнения этих шагов приложение будет доступно по адресу http://127.0.0.1:8000/

## 🧪 Тестирование и проверка кода

### Установка инструментов тестирования

```bash
# Установка pytest и coverage
pip install pytest pytest-django pytest-cov coverage
```

### Проверка кода с Pylint

```bash
# Запуск Pylint с настройками для Django
python pylint_runner.py

# Создание HTML-отчета
python pylint_runner.py --html

# Проверка только определенных приложений
python pylint_runner.py --apps MainApp
```

### Запуск тестов

```bash
# Запуск всех тестов
pytest

# Проверка покрытия кода тестами
pytest --cov=MainApp --cov-report=term-missing --cov-report=html
```

Эта команда:
- `--cov=MainApp` - проверяет покрытие кода в приложении MainApp
- `--cov-report=term-missing` - показывает в терминале непокрытые строки кода
- `--cov-report=html` - создает HTML-отчет о покрытии в директории htmlcov/

После выполнения команды вы можете открыть файл `htmlcov/index.html` в браузере для просмотра детального отчета о покрытии кода.

## 📚 Документация

Проект содержит автоматически генерируемую документацию с помощью Sphinx.

### Установка Sphinx и зависимостей

```bash
pip install sphinx sphinx_rtd_theme
```

### Генерация HTML-документации

```bash
cd docs
make html
```

После выполнения этих команд документация будет доступна по пути `docs/build/html/index.html`

## 📁 Структура проекта

```
final-project-kalinin-team/
├── MainApp/                # Основное приложение
│   ├── models.py           # Модели данных
│   ├── views.py            # Представления
│   ├── forms.py            # Формы
│   ├── serializers.py      # Сериализаторы API
│   ├── permissions.py      # Разрешения API
│   ├── admin.py            # Администрирование
│   └── templates/          # HTML-шаблоны
│
├── WireMap/                # Проект Django
│   ├── settings.py         # Настройки проекта
│   └── urls.py             # Маршрутизация URL
│
├── docs/                   # Документация
│   ├── source/             # Исходники документации
│   └── build/              # Сгенерированная документация
│
├── manage.py               # Скрипт управления Django
├── requirements.txt        # Зависимости проекта
├── pylint_runner.py        # Скрипт для запуска Pylint
└── README.md               # Этот файл
```

## 📝 Команды управления проектом

### Основные команды Django

```bash
# Создание миграций
python manage.py makemigrations

# Применение миграций
python manage.py migrate

# Создание суперпользователя
python manage.py createsuperuser

# Сбор статических файлов
python manage.py collectstatic

# Запуск оболочки Django
python manage.py shell

# Запуск сервера разработки
python manage.py runserver
```

## 👨‍💻 Авторы

- **Kalinin Team** - [GitHub](https://github.com/kalinin-team)

 
