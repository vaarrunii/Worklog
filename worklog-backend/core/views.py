from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser # Import IsAdminUser
from django.contrib.auth import get_user_model
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import Project, Task, TimesheetEntry, LeaveRequest, TaskTimeEntry, Notice # Import Notice
from .serializers import (
    UserSerializer, ProjectSerializer, TaskSerializer,
    TimesheetEntrySerializer, LeaveRequestSerializer,
    TaskTimeEntrySerializer, NoticeSerializer, # Import NoticeSerializer
    UserRegistrationSerializer
)
from .permissions import IsAssignedUserOrAdmin

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [permissions.IsAdminUser()]

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAssignedUserOrAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_staff:
            return queryset

        # For regular users, return tasks assigned to them OR tasks they created
        return queryset.filter(Q(assigned_to=self.request.user) | Q(created_by=self.request.user)).distinct()

    def perform_create(self, serializer):
        # Always set 'created_by' to the current authenticated user
        serializer.save(created_by=self.request.user)

        # If the user is not an admin and they try to assign to someone else, prevent it.
        # If assigned_to is not provided by a regular user, assign to themselves.
        if not self.request.user.is_staff:
            if 'assigned_to' in serializer.validated_data and serializer.validated_data['assigned_to'] != self.request.user:
                raise permissions.PermissionDenied("You can only assign tasks to yourself.")
            elif 'assigned_to' not in serializer.validated_data:
                # If assigned_to is not provided, default to the current user
                serializer.instance.assigned_to = self.request.user
                serializer.instance.save()

    def perform_update(self, serializer):
        # The IsAssignedUserOrAdmin permission handles the initial check for retrieve/update/destroy.
        # This method adds specific logic for updates.
        task = self.get_object()
        # Allow update if user is admin OR (user is assigned_to OR user is created_by)
        if not self.request.user.is_staff and \
           not (task.assigned_to == self.request.user or task.created_by == self.request.user):
            self.permission_denied(self.request, message="You do not have permission to edit this task.")

        # If a non-admin tries to change assigned_to to someone else
        if not self.request.user.is_staff and \
           'assigned_to' in serializer.validated_data and \
           serializer.validated_data['assigned_to'] != self.request.user:
            raise permissions.PermissionDenied("You can only assign tasks to yourself.")

        serializer.save()

    def perform_destroy(self, instance):
        # The IsAssignedUserOrAdmin permission handles the initial check.
        # This method ensures only admin or the creator can delete.
        if not self.request.user.is_staff and instance.created_by != self.request.user:
            self.permission_denied(self.request, message="You do not have permission to delete this task.")
        instance.delete()


class TimesheetEntryViewSet(viewsets.ModelViewSet):
    queryset = TimesheetEntry.objects.all()
    serializer_class = TimesheetEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_staff:
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
        if not self.request.user.is_staff and serializer.validated_data.get('user') and serializer.validated_data['user'] != self.request.user:
            raise permissions.PermissionDenied("You can only create timesheet entries for yourself.")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        # Prevent update if status is not 'draft' for non-admins
        if instance.status != 'draft' and not self.request.user.is_staff:
            return Response(
                {"detail": "This timesheet entry cannot be edited as it is no longer in 'draft' status."},
                status=status.HTTP_403_FORBIDDEN
            )
        # Allow owner or admin to update
        if instance.user != self.request.user and not self.request.user.is_staff:
            self.permission_denied(self.request, message="You do not have permission to update this timesheet entry.")
        serializer.save()

    def perform_destroy(self, instance):
        # Allow owner or admin to delete
        if instance.user != self.request.user and not self.request.user.is_staff:
            self.permission_denied(self.request, message="You do not have permission to delete this timesheet entry.")
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def submit(self, request, pk=None):
        entry = self.get_object()
        if entry.user != request.user:
            return Response({'detail': 'You do not have permission to submit this entry.'}, status=status.HTTP_403_FORBIDDEN)
        if entry.status == 'draft':
            entry.status = 'submitted'
            entry.save()
            return Response({'status': 'Timesheet entry submitted.'})
        return Response({'detail': 'Timesheet entry is not in draft status.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAdminUser])
    def update_status(self, request, pk=None):
        entry = self.get_object()
        new_status = request.data.get('status')
        if new_status in ['approved', 'rejected']:
            entry.status = new_status
            entry.save()
            return Response(self.get_serializer(entry).data)
        return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)


# --- LeaveRequestViewSet (Corrected and Cleaned) ---
class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated] # Using IsAuthenticated, assuming IsAssignedUserOrAdmin is for Tasks

    def get_queryset(self):
        # Always order by created_at descending
        queryset = LeaveRequest.objects.all().order_by('-created_at')

        if self.request.user.is_staff:
            # Admin can filter by a specific user's leave requests if 'user' query param is provided
            user_id = self.request.query_params.get('user')
            if user_id:
                return queryset.filter(user_id=user_id)
            # If no user_id is specified, admin sees all leave requests
            return queryset
        else:
            # Regular user only sees their own leave requests
            return queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Ensure user can only create requests for themselves if not staff
        if not self.request.user.is_staff and serializer.validated_data.get('user') and serializer.validated_data['user'] != self.request.user:
            raise permissions.PermissionDenied("You can only create leave requests for yourself.")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        request_user = self.request.user

        # Admin can update any field and set approved_by
        if request_user.is_staff:
            # If status is being changed to approved/rejected, set approved_by
            if 'status' in serializer.validated_data and serializer.validated_data['status'] in ['approved', 'rejected']:
                # Pass the user object directly for ForeignKey
                serializer.save(approved_by=request_user)
            else:
                serializer.save() # For other admin updates, just save normally
        else:
            # Regular user trying to update
            if instance.user != request_user:
                raise permissions.PermissionDenied("You do not have permission to update this leave request.")

            # Prevent regular users from changing status if it's not pending
            # Also prevent them from changing status to 'approved' or 'rejected'
            if 'status' in serializer.validated_data and (instance.status != 'pending' or serializer.validated_data['status'] in ['approved', 'rejected']):
                raise permissions.PermissionDenied("You cannot change the status of an already processed leave request or set it to approved/rejected.")

            # Prevent regular users from setting admin_comments or approved_by
            if 'admin_comments' in serializer.validated_data or 'approved_by' in serializer.validated_data:
                raise permissions.PermissionDenied("You cannot set admin comments or approved by user.")

            serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.is_staff and instance.user != self.request.user:
            raise permissions.PermissionDenied("You do not have permission to delete this leave request.")
        instance.delete()


# NEW: Define a filter class for TaskTimeEntry
class TaskTimeEntryFilter(django_filters.FilterSet):
    # These filters directly map to the query parameters sent by the frontend
    # for date range and specific IDs.
    start_time__gte = django_filters.DateTimeFilter(field_name="start_time", lookup_expr='gte')
    end_time__lte = django_filters.DateTimeFilter(field_name="end_time", lookup_expr='lte')
    user_id = django_filters.NumberFilter(field_name="user__id")
    task_id = django_filters.NumberFilter(field_name="task__id")
    project_id = django_filters.NumberFilter(field_name="task__project__id")

    class Meta:
        model = TaskTimeEntry
        fields = ['start_time', 'end_time', 'user', 'task', 'task__project']


# --- NEW VIEWS FOR TASK TIME ENTRIES ---
class TaskTimeEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = TaskTimeEntryFilter

    def get_queryset(self):
        queryset = TaskTimeEntry.objects.all()

        # IMPORTANT: Apply user-specific filtering FIRST for security
        # Regular users should only ever see their own time entries.
        if not self.request.user.is_staff:
            queryset = queryset.filter(user=self.request.user)

        return queryset.order_by('-start_time')

    def perform_create(self, serializer):
        # Ensure the user creating the entry is the authenticated user
        serializer.save(user=self.request.user)


class TaskTimeEntryRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TaskTimeEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            return TaskTimeEntry.objects.all()
        return TaskTimeEntry.objects.filter(user=self.request.user)

# NEW VIEWS FOR NOTICES
class NoticeViewSet(viewsets.ModelViewSet):
    queryset = Notice.objects.all()
    serializer_class = NoticeSerializer
    permission_classes = [IsAuthenticated] # Base permission

    def get_permissions(self):
        """
        Set custom permissions for different actions.
        Admins can create, update, delete. All authenticated users can list and retrieve.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()] # Only admins can perform these actions
        return [IsAuthenticated()] # All authenticated users can list/retrieve

    def perform_create(self, serializer):
        # Set the created_by field to the current authenticated user (who must be an admin)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # Ensure only the admin who created the notice (or any admin) can update it.
        # The IsAdminUser permission already covers this.
        serializer.save()

    def perform_destroy(self, instance):
        # Ensure only admins can delete notices.
        # The IsAdminUser permission already covers this.
        instance.delete()
