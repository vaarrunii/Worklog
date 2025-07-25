# Generated by Django 5.2.3 on 2025-07-02 20:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='leaverequest',
            options={'ordering': ['-created_at'], 'verbose_name_plural': 'Leave Requests'},
        ),
        migrations.AlterModelOptions(
            name='timesheetentry',
            options={'verbose_name_plural': 'Timesheet Entries'},
        ),
        migrations.RemoveField(
            model_name='task',
            name='is_completed',
        ),
        migrations.RemoveField(
            model_name='timesheetentry',
            name='notes',
        ),
        migrations.AddField(
            model_name='leaverequest',
            name='admin_comments',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='due_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='progress',
            field=models.IntegerField(default=0, help_text='Progress percentage (0-100)'),
        ),
        migrations.AddField(
            model_name='task',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'), ('completed', 'Completed'), ('on_hold', 'On Hold'), ('cancelled', 'Cancelled')], default='pending', max_length=20),
        ),
        migrations.AlterField(
            model_name='leaverequest',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20),
        ),
    ]
