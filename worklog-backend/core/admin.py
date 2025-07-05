# core/admin.py
from django.contrib import admin
from .models import Project, Task, TimesheetEntry, LeaveRequest
from django.contrib.auth.models import User # Import User model

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at', 'updated_at')
    search_fields = ('name', 'description')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    # Updated list_display to use 'status' instead of 'is_completed'
    list_display = ('name', 'project', 'assigned_to', 'status', 'progress', 'created_at')
    # Updated list_filter to use 'status' instead of 'is_completed'
    list_filter = ('project', 'assigned_to', 'status')
    search_fields = ('name', 'description')
    raw_id_fields = ('project', 'assigned_to') # For better UX with many projects/users

@admin.register(TimesheetEntry)
class TimesheetEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'task', 'date', 'hours', 'created_at')
    list_filter = ('user', 'task__project', 'date')
    search_fields = ('user__username', 'task__name', 'notes')
    date_hierarchy = 'date'
    raw_id_fields = ('user', 'task')

@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'leave_type', 'start_date', 'end_date', 'status', 'approved_by', 'created_at')
    list_filter = ('leave_type', 'status', 'user', 'approved_by')
    search_fields = ('user__username', 'reason')
    raw_id_fields = ('user', 'approved_by')
    actions = ['approve_requests', 'reject_requests']

    def approve_requests(self, request, queryset):
        # Ensure only staff can approve/reject and set approved_by
        if request.user.is_staff:
            queryset.update(status='approved', approved_by=request.user)
            self.message_user(request, "Selected leave requests have been approved.")
        else:
            self.message_user(request, "You do not have permission to approve requests.", level='error')
    approve_requests.short_description = "Approve selected leave requests"

    def reject_requests(self, request, queryset):
        if request.user.is_staff:
            queryset.update(status='rejected', approved_by=request.user)
            self.message_user(request, "Selected leave requests have been rejected.")
        else:
            self.message_user(request, "You do not have permission to reject requests.", level='error')
    reject_requests.short_description = "Reject selected leave requests"

