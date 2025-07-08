# worklog-backend/core/views.py

from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Q # Import Q for complex lookups

from .models import Project, Task, TimesheetEntry, LeaveRequest, TaskTimeEntry # NEW: Import TaskTimeEntry model
from .serializers import (
    UserSerializer, ProjectSerializer, TaskSerializer,
    TimesheetEntrySerializer, LeaveRequestSerializer,
    TaskTimeEntrySerializer # NEW: Import TaskTimeEntrySerializer
)
from .permissions import IsAssignedUserOrAdmin # Import your custom permission

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated] # Default to authenticated access

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        Allows anyone to create a user (register).
        """
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()] # For other actions, user must be authenticated

    def get_queryset(self):
        """
        Optionally restricts the returned users to only the requesting user
        if not an admin.
        """
        if self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    # Only admins can manage projects
    permission_classes = [IsAuthenticated] # Will be further restricted by IsAdminUser in settings or a custom permission

    def get_permissions(self):
        """
        Admins can perform all actions. Regular users can only read projects.
        """
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()] # Any authenticated user can view projects
        return [permissions.IsAdminUser()] # Only admin can create, update, delete

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAssignedUserOrAdmin] # Use your custom permission

    def get_queryset(self):
        """
        Allow admins to see all tasks.
        Allow regular users to see tasks assigned to them or tasks they created.
        """
        if self.request.user.is_staff:
            return Task.objects.all()

        # For regular users, return tasks assigned to them OR tasks they created
        # (This covers the 'My Tasks' feature where users create their own tasks)
        return Task.objects.filter(Q(assigned_to=self.request.user) | Q(created_by=self.request.user)).distinct()


    def perform_create(self, serializer):
        """
        Automatically sets the 'assigned_to' field to the requesting user
        if not explicitly provided, and 'created_by' to the requesting user.
        """
        # Ensure 'assigned_to' is set to the requesting user if not provided or if user is not admin
        if not self.request.user.is_staff and not serializer.validated_data.get('assigned_to'):
            serializer.save(assigned_to=self.request.user, created_by=self.request.user)
        elif self.request.user.is_staff and not serializer.validated_data.get('assigned_to'):
            # If admin is creating and assigned_to is not specified, assign to admin
            serializer.save(assigned_to=self.request.user, created_by=self.request.user)
        else:
            # If assigned_to is provided, ensure it matches requesting user if not admin
            if not self.request.user.is_staff and serializer.validated_data.get('assigned_to') != self.request.user:
                raise permissions.PermissionDenied("You can only assign tasks to yourself.")
            serializer.save(created_by=self.request.user) # Always set created_by

    def perform_update(self, serializer):
        """
        Allows only the assigned user or admin to update the task.
        """
        if not self.request.user.is_staff and serializer.instance.assigned_to != self.request.user:
            raise permissions.PermissionDenied("You do not have permission to update this task.")
        serializer.save()

    def perform_destroy(self, instance):
        """
        Allows only the assigned user or admin to delete the task.
        """
        if not self.request.user.is_staff and instance.assigned_to != self.request.user:
            raise permissions.PermissionDenied("You do not have permission to delete this task.")
        instance.delete()


class TimesheetEntryViewSet(viewsets.ModelViewSet):
    queryset = TimesheetEntry.objects.all()
    serializer_class = TimesheetEntrySerializer
    permission_classes = [IsAuthenticated] # Default to authenticated access

    def get_queryset(self):
        """
        Users can only see their own timesheet entries. Admins see all.
        """
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_staff:
            # Admins can filter by user and date range
            user_id = self.request.query_params.get('user')
            start_date = self.request.query_params.get('start_date')
            end_date = self.request.query_params.get('end_date')

            if user_id:
                queryset = queryset.filter(user_id=user_id)
            if start_date:
                queryset = queryset.filter(date__gte=start_date)
            if end_date:
                queryset = queryset.filter(date__lte=end_date)
            return queryset
        return queryset.filter(user=user)

    def perform_create(self, serializer):
        """
        Automatically sets the 'user' field to the requesting user.
        """
        if not self.request.user.is_staff and serializer.validated_data.get('user') and serializer.validated_data['user'] != self.request.user:
            raise permissions.PermissionDenied("You can only create timesheet entries for yourself.")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """
        Allows only the owner or admin to update the timesheet entry.
        """
        if not self.request.user.is_staff and serializer.instance.user != self.request.user:
            raise permissions.PermissionDenied("You do not have permission to update this timesheet entry.")
        serializer.save()

    def perform_destroy(self, instance):
        """
        Allows only the owner or admin to delete the timesheet entry.
        """
        if not self.request.user.is_staff and instance.user != self.request.user:
            raise permissions.PermissionDenied("You do not have permission to delete this timesheet entry.")
        instance.delete()


class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAssignedUserOrAdmin] # Use your custom permission here too

    def get_queryset(self):
        """
        Users can only see their own leave requests. Admins see all.
        """
        if self.request.user.is_staff:
            # Admins can filter by user
            user_id = self.request.query_params.get('user')
            if user_id:
                return LeaveRequest.objects.filter(user_id=user_id)
            return LeaveRequest.objects.all()
        return LeaveRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """
        Automatically sets the 'user' field to the requesting user.
        """
        # Ensure 'user' is set to the requesting user if not provided or if user is not admin
        if not self.request.user.is_staff and serializer.validated_data.get('user') and serializer.validated_data['user'] != self.request.user:
            raise permissions.PermissionDenied("You can only create leave requests for yourself.")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        """
        Allows only the owner or admin to update the leave request.
        Admins can change status, regular users cannot change status if it's already approved/rejected.
        """
        if not self.request.user.is_staff:
            # Regular user trying to update
            if serializer.instance.user != self.request.user:
                raise permissions.PermissionDenied("You do not have permission to update this leave request.")

            # Prevent regular users from changing status if it's not pending
            if serializer.instance.status != 'pending' and 'status' in serializer.validated_data and serializer.validated_data['status'] != serializer.instance.status:
                raise permissions.PermissionDenied("You cannot change the status of an already processed leave request.")

            # Prevent regular users from setting admin_comments or approved_by
            if 'admin_comments' in serializer.validated_data or 'approved_by' in serializer.validated_data:
                raise permissions.PermissionDenied("You cannot set admin comments or approved by user.")

        serializer.save()

    def perform_destroy(self, instance):
        """
        Allows only the owner or admin to delete the leave request.
        """
        if not self.request.user.is_staff and instance.user != self.request.user:
            raise permissions.PermissionDenied("You do not have permission to delete this leave request.")
        instance.delete()


# --- NEW VIEWS FOR TASK TIME ENTRIES ---
class TaskTimeEntryListCreateView(generics.ListCreateAPIView):
    """
    API view to list all time entries for the authenticated user
    or create a new time entry.
    Can also filter by task.
    """
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated] # Ensure permissions.IsAuthenticated is imported

    def get_queryset(self):
        queryset = TaskTimeEntry.objects.filter(user=self.request.user)
        task_id = self.request.query_params.get('task_id')
        if task_id:
            queryset = queryset.filter(task__id=task_id)
        return queryset

    def perform_create(self, serializer):
        # The user is automatically set in the serializer's create method
        serializer.save()

class TaskTimeEntryRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update, or delete a specific time entry.
    Ensures only the owner can access their entries.
    """
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated] # Ensure permissions.IsAuthenticated is imported

    def get_queryset(self):
        return TaskTimeEntry.objects.filter(user=self.request.user)
class TaskTimeEntryListCreateView(generics.ListCreateAPIView):
    """
    API view to list all time entries for the authenticated user
    or create a new time entry.
    Admins can view all entries; regular users can only view their own.
    Can also filter by task.
    """
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admins can see all time entries
        if self.request.user.is_staff:
            queryset = TaskTimeEntry.objects.all()
        else:
            # Regular users can only see their own time entries
            queryset = TaskTimeEntry.objects.filter(user=self.request.user)

        # Allow filtering by task_id for both admins and regular users
        task_id = self.request.query_params.get('task_id')
        if task_id:
            queryset = queryset.filter(task__id=task_id)

        # Allow filtering by user_id for admins
        if self.request.user.is_staff:
            user_id = self.request.query_params.get('user_id')
            if user_id:
                queryset = queryset.filter(user__id=user_id)

        return queryset.order_by('-start_time') # Order by most recent first

    def perform_create(self, serializer):
        # The user is automatically set in the serializer's create method
        serializer.save()

class TaskTimeEntryRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    API view to retrieve, update, or delete a specific time entry.
    Ensures only the owner or admin can access their entries.
    """
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admins can access any entry. Regular users can only access their own.
        if self.request.user.is_staff:
            return TaskTimeEntry.objects.all()
        return TaskTimeEntry.objects.filter(user=self.request.user)
