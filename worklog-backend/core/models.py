from django.db import models
from django.contrib.auth import get_user_model # Use get_user_model for custom user models
from datetime import timedelta # NEW: Import timedelta for duration calculation

User = get_user_model() # Get the active user model

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
    created_by = models.ForeignKey(User, related_name='created_tasks', on_delete=models.SET_NULL, null=True, blank=True) # <-- ADDED THIS FIELD
    due_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0) # Percentage
    parent_task = models.ForeignKey('self', related_name='subtasks', on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensure unique task names within a project, considering parent
        # This line might need adjustment if you have existing data that violates it.
        # For new projects/tasks, it's good to keep.
        unique_together = ('project', 'name', 'parent_task')
        ordering = ['project__name', 'parent_task__name', 'name'] # Order for display

    def __str__(self):
        if self.parent_task:
            return f"{self.project.name} > {self.parent_task.name} > {self.name}"
        return f"{self.project.name} > {self.name}"

class TimesheetEntry(models.Model):
    user = models.ForeignKey(User, related_name='timesheet_entries', on_delete=models.CASCADE)
    task = models.ForeignKey(Task, related_name='timesheet_entries', on_delete=models.CASCADE)
    date = models.DateField()
    hours = models.DecimalField(max_digits=5, decimal_places=2) # e.g., 8.00, 7.50
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'task', 'date') # A user can only log hours once per task per day
        ordering = ['-date', 'task__name']

    def __str__(self):
        return f"{self.user.username} - {self.task.name} on {self.date}: {self.hours} hours"

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
    end_date = models.DateField(blank=True, null=True) # Null for hourly leave
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

# --- NEW MODEL: TaskTimeEntry ---
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
        # Use task.name instead of task.title, as your Task model has 'name'
        return f"{self.user.username} - {self.task.name}: {self.start_time.strftime('%Y-%m-%d %H:%M')} to {self.end_time.strftime('%H:%M')}"

    class Meta:
        ordering = ['start_time']
        verbose_name_plural = "Task Time Entries"
