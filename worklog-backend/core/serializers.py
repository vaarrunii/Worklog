from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Project, Task, TimesheetEntry, LeaveRequest, TaskTimeEntry, Notice # Import Notice
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

# Existing User-related Serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['is_staff']

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    is_staff = serializers.BooleanField(default=False, write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'is_staff']

    def create(self, validated_data):
        is_staff = validated_data.pop('is_staff', False)
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_staff=is_staff,
            is_active=True
        )
        return user

# Existing Project Serializer
class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'

# --- UPDATED Task Serializer for sub-tasks and Reporting Manager ---
class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    parent_task_name = serializers.CharField(source='parent_task.name', read_only=True)
    # NEW: Add reporting_manager_username
    reporting_manager_username = serializers.CharField(source='reporting_manager.username', read_only=True)

    subtasks_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
        source='subtasks'
    )

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'project_name', 'name', 'description',
            'assigned_to', 'assigned_to_username',
            'created_by', 'created_by_username',
            'due_date', 'status', 'progress', 'parent_task', 'parent_task_name',
            'reporting_manager', 'reporting_manager_username', # NEW: Include reporting_manager fields
            'subtasks_ids', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by']

# --- CORRECTED Timesheet Entry Serializer (MODIFIED) ---
class TimesheetEntrySerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    task_name = serializers.CharField(source='task.name', read_only=True)
    project_name = serializers.CharField(source='task.project.name', read_only=True)

    task_parent_task_id = serializers.IntegerField(source='task.parent_task.id', read_only=True)
    task_parent_task_name = serializers.CharField(source='task.parent_task.name', read_only=True)

    class Meta:
        model = TimesheetEntry
        fields = '__all__' # This will now include the 'status' field
        read_only_fields = ['user'] # 'user' is set automatically by the view

    def update(self, instance, validated_data):
        """
        Custom update method to prevent non-admin users from editing entries
        that are no longer in 'draft' status.
        """
        request_user = self.context.get('request').user
        if instance.status != 'draft' and not request_user.is_staff:
            raise serializers.ValidationError("Timesheet entry cannot be edited once it's no longer in 'draft' status.")
        return super().update(instance, validated_data)


class LeaveRequestSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = '__all__'
        # REMOVED 'status', 'admin_comments', 'approved_by' from read_only_fields
        # This allows them to be updated via PATCH/PUT requests.
        read_only_fields = ['user', 'created_at', 'updated_at']

    # You might not strictly need to override update if your viewset's perform_update
    # handles setting approved_by, but it's good to ensure it's here if needed
    def update(self, instance, validated_data):
        """
        Custom update method for LeaveRequest.
        Handles setting admin_comments and approved_by when status changes.
        """
        request_user = self.context.get('request').user

        # If an admin is changing the status, set approved_by
        if request_user.is_staff and 'status' in validated_data:
            new_status = validated_data['status']
            if new_status in ['approved', 'rejected']:
                instance.approved_by = request_user
            elif new_status == 'pending' and instance.status != 'pending': # If status is reverted to pending
                instance.approved_by = None # Clear approved_by
        
        # Admin comments can be set by admin at any time
        if request_user.is_staff and 'admin_comments' in validated_data:
            instance.admin_comments = validated_data['admin_comments']
        elif not request_user.is_staff and 'admin_comments' in validated_data:
            # Prevent non-admin from setting admin_comments
            raise serializers.ValidationError({"admin_comments": "You do not have permission to set admin comments."})


        # Update other fields automatically by ModelSerializer
        # Exclude fields handled manually to prevent double-setting
        for attr, value in validated_data.items():
            if attr not in ['status', 'admin_comments', 'approved_by']:
                setattr(instance, attr, value)

        instance.status = validated_data.get('status', instance.status) # Ensure status is also updated
        instance.save()
        return instance


# --- JWT TOKEN RESPONSE SERIALIZER (KEEP THIS AS IS) ---
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['is_admin'] = user.is_staff
        token['user_id'] = user.id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['is_admin'] = self.user.is_staff
        return data

# --- NEW SERIALIZER: TaskTimeEntrySerializer ---
class TaskTimeEntrySerializer(serializers.ModelSerializer):
    duration_minutes = serializers.ReadOnlyField()
    duration_hours = serializers.ReadOnlyField()
    task_name = serializers.CharField(source='task.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = TaskTimeEntry
        fields = ['id', 'task', 'user', 'start_time', 'end_time', 'description',
                  'duration_minutes', 'duration_hours', 'task_name', 'user_username', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']

    def validate(self, data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("End time must be after start time.")
        return data

    def create(self, validated_data):
        if 'request' in self.context and hasattr(self.context['request'], 'user'):
            validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

# NEW SERIALIZER: NoticeSerializer
class NoticeSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Notice
        fields = ['id', 'title', 'content', 'created_by', 'created_by_username', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at'] # created_by will be set by the view
