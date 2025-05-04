"""
WSGI config for WireMap project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/
"""

import os
import sys
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WireMap.settings')

application = get_wsgi_application()

# Инициализация базы данных при первом запуске
if os.environ.get('INIT_DB') == 'true':
    try:
        from django.db import connection
        cursor = connection.cursor()
        
        # Проверяем существование таблицы пользователей
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'MainApp_customuser'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("WARNING: MainApp_customuser table does not exist!")
            
            # В логах будет явное предупреждение о проблеме с таблицей
            sys.stderr.write("WARNING: MainApp_customuser table does not exist!\n")
            
            # Пытаемся создать таблицу
            try:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS "MainApp_customuser" (
                        "id" serial PRIMARY KEY,
                        "password" varchar(128) NOT NULL,
                        "last_login" timestamp with time zone NULL,
                        "is_superuser" boolean NOT NULL,
                        "username" varchar(150) NOT NULL UNIQUE,
                        "first_name" varchar(150) NOT NULL,
                        "last_name" varchar(150) NOT NULL,
                        "email" varchar(254) NOT NULL,
                        "is_staff" boolean NOT NULL,
                        "is_active" boolean NOT NULL,
                        "date_joined" timestamp with time zone NOT NULL,
                        "phone" varchar(20) NULL,
                        "image" varchar(100) NULL
                    )
                """)
                print("Created MainApp_customuser table during WSGI initialization")
            except Exception as e:
                print(f"ERROR creating MainApp_customuser table: {e}")
        else:
            print("MainApp_customuser table exists.")
            
    except Exception as e:
        print(f"Error checking database: {e}")
