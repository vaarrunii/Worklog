from rest_framework import serializers
from django.contrib.auth import get_user_model # Use get_user_model for custom user models
# NEW: Import TaskTimeEntry model
from .models import Project, Task, TimesheetEntry, LeaveRequest, TaskTimeEntry
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer # Keep this import

User = get_user_model() # Get the active user model

# Existing User-related Serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['is_staff'] # is_staff should not be directly editable via this serializer

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    # ADDED: Make is_staff an optional field for registration.
    # It's write_only so it's not returned in the response after creation.
    # required=False allows the frontend to omit it for regular users.
    is_staff = serializers.BooleanField(default=False, write_only=True, required=False)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'is_staff'] # Include is_staff in fields

    def create(self, validated_data):
        # Extract is_staff from validated_data. If not provided, default to False.
        is_staff = validated_data.pop('is_staff', False)

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_staff=is_staff, # Use the extracted is_staff value here
            is_active=True # Ensure user is always active on creation
        )
        return user

# Existing Project Serializer
class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'

# --- UPDATED Task Serializer for sub-tasks (MODIFIED) ---
class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)

    subtasks_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=True,
        source='subtasks'
    )

    parent_task_name = serializers.CharField(source='parent_task.name', read_only=True)

    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'project', 'project_name', 'name', 'description',
            'assigned_to', 'assigned_to_username',
            'created_by', 'created_by_username',
            'due_date', 'status', 'progress', 'parent_task', 'parent_task_name',
            'subtasks_ids', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by']

# --- UPDATED Timesheet Entry Serializer (MODIFIED) ---
class TimesheetEntrySerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    task_name = serializers.CharField(source='task.name', read_only=True)
    project_name = serializers.CharField(source='task.project.name', read_only=True)

    task_parent_task_id = serializers.IntegerField(source='task.parent_task.id', read_only=True)
    task_parent_task_name = serializers.CharField(source='task.parent_task.name', read_only=True)

    class Meta:
        model = TimesheetEntry
        fields = '__all__'
        read_only_fields = ['user']

# Existing Leave Request Serializer
class LeaveRequestSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = '__all__'
        read_only_fields = ['user', 'status', 'admin_comments', 'approved_by']

# --- JWT TOKEN RESPONSE SERIALIZER (KEEP THIS AS IS) ---
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Customizes the JWT token response to include user details like user_id,
    username, email, and is_admin status.
    This serializer is used by rest_framework_simplejwt's TokenObtainPairView
    to return additional data upon successful login.
    """
    @classmethod
    def get_token(cls, user):
        """
        Adds custom claims to the JWT token itself.
        These claims are encoded into the token payload.
        """
        token = super().get_token(user)

        # Add custom claims to the token payload
        token['username'] = user.username
        token['email'] = user.email
        token['is_admin'] = user.is_staff # Use user.is_staff to determine admin status
        token['user_id'] = user.id

        return token

    def validate(self, attrs):
        """
        Validates the user's credentials and adds custom data to the
        response payload that the frontend receives directly.
        """
        # Call the parent validate method to perform default authentication
        data = super().validate(attrs)

        # Add extra responses to the login payload that the frontend consumes
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['is_admin'] = self.user.is_staff # This is the critical line for the frontend's logic

        return data

# --- NEW SERIALIZER: TaskTimeEntrySerializer ---
class TaskTimeEntrySerializer(serializers.ModelSerializer):
    """
    Serializer for TaskTimeEntry model.
    Includes read-only fields for duration.
    """
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
        """
        Check that the start time is before the end time.
        """
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("End time must be after start time.")
        return data

    def create(self, validated_data):
        # Automatically set the user to the currently authenticated user
        if 'request' in self.context and hasattr(self.context['request'], 'user'):
            validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
