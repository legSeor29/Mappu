# Generated by Django 5.2 on 2025-05-13 14:30

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('MainApp', '0004_alter_customuser_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='edge',
            name='style',
            field=models.JSONField(blank=True, default=dict, null=True),
        ),
    ]
