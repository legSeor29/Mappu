from django.core.management.base import BaseCommand
import os
import subprocess
import logging

logger = logging.getLogger('MainApp')

class Command(BaseCommand):
    help = 'Build Sphinx documentation'
    
    def handle(self, *args, **options):
        docs_dir = os.path.join(os.getcwd(), 'docs')
        self.stdout.write('Building documentation...')
        
        try:
            # Запуск сборки HTML документации
            result = subprocess.run(['make', 'html'], cwd=docs_dir, 
                                   capture_output=True, text=True, check=True)
            
            self.stdout.write(self.style.SUCCESS('Documentation built successfully!'))
            self.stdout.write(result.stdout)
            
            # Вывод информации о расположении документации
            self.stdout.write(self.style.SUCCESS(
                f'Documentation is available at {os.path.join(docs_dir, "build/html/index.html")}'
            ))
        except subprocess.CalledProcessError as e:
            self.stdout.write(self.style.ERROR('Error building documentation!'))
            self.stdout.write(self.style.ERROR(e.stderr))
            logger.error(f"Error building documentation: {e.stderr}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Unexpected error: {str(e)}'))
            logger.error(f"Unexpected error building documentation: {str(e)}") 