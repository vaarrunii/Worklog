from django.db import models
from django.contrib.auth import get_user_model
from datetime import timedelta

User = get_user_model()

class Project(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Task(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('on_hold', 'On Hold'),
    ]

    project = models.ForeignKey(Project, related_name='tasks', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    assigned_to = models.ForeignKey(User, related_name='tasks', on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, related_name='created_tasks', on_delete=models.SET_NULL, null=True, blank=True)
    due_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0) # Percentage
    parent_task = models.ForeignKey('self', related_name='subtasks', on_delete=models.CASCADE, null=True, blank=True)
    # NEW FIELD: Reporting Manager
    reporting_manager = models.ForeignKey(User, related_name='managed_tasks', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('project', 'name', 'parent_task')
        ordering = ['project__name', 'parent_task__name', 'name']

    def __str__(self):
        if self.parent_task:
            return f"{self.project.name} > {self.parent_task.name} > {self.name}"
        return f"{self.project.name} > {self.name}"

class TimesheetEntry(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(User, related_name='timesheet_entries', on_delete=models.CASCADE)
    task = models.ForeignKey(Task, related_name='timesheet_entries', on_delete=models.CASCADE)
    date = models.DateField()
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    # NEW FIELD: Status for timesheet entry
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'task', 'date')
        ordering = ['-date', 'task__name']

    def __str__(self):
        return f"{self.user.username} - {self.task.name} on {self.date}: {self.hours} hours ({self.status})"

class LeaveRequest(models.Model):
    LEAVE_TYPE_CHOICES = [
        ('sick', 'Sick Leave'),
        ('vacation', 'Vacation'),
        ('personal', 'Personal Leave'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(User, related_name='leave_requests', on_delete=models.CASCADE)
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    is_hourly = models.BooleanField(default=False)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    admin_comments = models.TextField(blank=True, null=True)
    approved_by = models.ForeignKey(User, related_name='approved_leave_requests', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}'s {self.leave_type} request from {self.start_date} ({self.status})"

class TaskTimeEntry(models.Model):
    """
    Model to store hourly time entries for a specific task.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_time_entries')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='time_entries')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    description = models.TextField(blank=True, null=True, help_text="What was done during this time slot?")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def duration_minutes(self):
        """Calculates the duration of the entry in minutes."""
        if self.start_time and self.end_time:
            duration = self.end_time - self.start_time
            return duration.total_seconds() / 60
        return 0

    @property
    def duration_hours(self):
        """Calculates the duration of the entry in hours."""
        return self.duration_minutes / 60

    def __str__(self):
        return f"{self.user.username} - {self.task.name}: {self.start_time.strftime('%Y-%m-%d %H:%M')} to {self.end_time.strftime('%H:%M')}"

    class Meta:
        ordering = ['start_time']
        verbose_name_plural = "Task Time Entries"

# NEW MODEL: Notice
class Notice(models.Model):
    """
    Model to store notices/reminders sent by admin to users.
    """
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notices')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at'] # Order by newest first
        verbose_name_plural = "Notices"

    def __str__(self):
        return f"Notice: {self.title} (by {self.created_by.username if self.created_by else 'N/A'})"
