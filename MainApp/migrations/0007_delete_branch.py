from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('MainApp', '0006_branch'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Branch',
        ),
    ]
