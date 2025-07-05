from django.db import models
from django.contrib.auth.models import User

# Project Model
class Project(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

# Task Model
class Task(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('on_hold', 'On Hold'),
        ('cancelled', 'Cancelled'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    due_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0, help_text="Progress percentage (0-100)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensures a task name is unique within a project
        unique_together = ('project', 'name')

    def __str__(self):
        return f"{self.name} ({self.project.name})"

# Timesheet Entry Model
class TimesheetEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='timesheet_entries')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='timesheet_entries')
    date = models.DateField()
    hours = models.DecimalField(max_digits=4, decimal_places=2) # e.g., 8.00, 7.50
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensures a user cannot log hours for the same task on the same day twice
        unique_together = ('user', 'task', 'date')
        verbose_name_plural = "Timesheet Entries"

    def __str__(self):
        return f"{self.user.username} - {self.task.name} on {self.date} ({self.hours} hours)"

# Leave Request Model
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

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leave_requests')
    admin_comments = models.TextField(blank=True, null=True)
    
    # New fields for hourly leave
    is_hourly = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Leave Requests"
        ordering = ['-created_at']

    def __str__(self):
        if self.is_hourly:
            return f"{self.user.username} - {self.leave_type} on {self.start_date} from {self.start_time} to {self.end_time} ({self.status})"
        return f"{self.user.username} - {self.leave_type} from {self.start_date} to {self.end_date} ({self.status})"

