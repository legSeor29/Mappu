import os
from pathlib import Path
import dj_database_url
from django.conf.global_settings import LOGIN_URL, LOGIN_REDIRECT_URL, LOGOUT_REDIRECT_URL
import urllib.parse

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-$!52o53%$p2^%r1fhia35ie#7zbpz@c)dl@1z6y@1%pp0)r5pt')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
CSRF_TRUSTED_ORIGINS = [
    'https://mappu.ru',
]

RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
ALLOWED_HOSTS = [RENDER_EXTERNAL_HOSTNAME] if RENDER_EXTERNAL_HOSTNAME else []
ALLOWED_HOSTS.extend(os.getenv('ALLOWED_HOSTS', '*').split(','))


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'MainApp.apps.MainappConfig',
]

AUTH_USER_MODEL = 'MainApp.CustomUser'

# Явно проверяем, существует ли медиа директория
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
if not os.path.exists(MEDIA_ROOT):
    try:
        os.makedirs(MEDIA_ROOT, exist_ok=True)
        os.makedirs(os.path.join(MEDIA_ROOT, 'profile_pics'), exist_ok=True)
        print(f"Created media directories at {MEDIA_ROOT}")
    except Exception as e:
        print(f"Error creating media directories: {e}")

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Добавлен WhiteNoise
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'WireMap.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'WireMap.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

# Настройки базы данных
DATABASE_URL = os.environ.get('DATABASE_URL')

# Безопасно выводим информацию о базе данных для диагностики
if DATABASE_URL:
    print(f"Database URL schema: {DATABASE_URL.split('://')[0] if '://' in DATABASE_URL else 'unknown'}")
    print(f"Database URL length: {len(DATABASE_URL)}")

# Базовая конфигурация для SQLite
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Если есть DATABASE_URL, пробуем использовать PostgreSQL
if DATABASE_URL:
    try:
        # Явно парсим URL для большей безопасности
        parsed_url = urllib.parse.urlparse(DATABASE_URL)
        
        # Получаем компоненты URL
        db_scheme = parsed_url.scheme
        db_user = parsed_url.username
        db_password = parsed_url.password
        db_host = parsed_url.hostname
        db_port = parsed_url.port or '5432'  # PostgreSQL порт по умолчанию
        db_name = parsed_url.path.lstrip('/') if parsed_url.path else 'postgres'
        
        # Выводим информацию для диагностики (без секретов)
        print(f"Database connection info: {db_scheme}://{db_user}@{db_host}:{db_port}/{db_name}")
        
        # Настраиваем PostgreSQL
        DATABASES['default'] = {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': db_name,
            'USER': db_user,
            'PASSWORD': db_password,
            'HOST': db_host,
            'PORT': db_port,
            'CONN_MAX_AGE': 600,
        }
        print("Successfully configured PostgreSQL database")
    except Exception as e:
        print(f"Error parsing DATABASE_URL: {str(e)}")
        print("Falling back to SQLite database")

# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = '/static/'

# Путь к директории, где будут собираться статические файлы
STATIC_ROOT = os.getenv('STATIC_ROOT', os.path.join(BASE_DIR, 'MainApp/staticfiles'))

# Дополнительные директории для поиска статических файлов
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'MainApp/static'),  # Обратите внимание на правильный путь
    os.path.join(BASE_DIR, 'docs/build/html'),  # Путь к сгенерированной документации Sphinx
]

# Конфигурация WhiteNoise для производственной среды
if not DEBUG:
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/login/'
SECURE_REFERRER_POLICY = 'origin'

# добавляем необходимые настройки логирования
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'debug.log'),
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
        'MainApp': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

env_path = Path('/.env') or Path('/etc/secrets/.env')
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value