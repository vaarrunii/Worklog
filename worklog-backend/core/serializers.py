# worklog-backend/core/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Project, Task, TimesheetEntry, LeaveRequest

# Existing User-related Serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['is_staff'] # is_staff should not be directly editable via this serializer

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

# Existing Project Serializer
class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'

# Existing Task Serializer
class TaskSerializer(serializers.ModelSerializer):
    # Read-only fields to display related object names
    project_name = serializers.ReadOnlyField(source='project.name')
    assigned_to_username = serializers.ReadOnlyField(source='assigned_to.username')

    class Meta:
        model = Task
        fields = '__all__' # Includes all fields, including the new read-only ones

# Existing Timesheet Entry Serializer
class TimesheetEntrySerializer(serializers.ModelSerializer):
    # Read-only fields to display related object names
    user_username = serializers.ReadOnlyField(source='user.username')
    task_name = serializers.ReadOnlyField(source='task.name')
    project_name = serializers.ReadOnlyField(source='task.project.name') # Access project name via task

    class Meta:
        model = TimesheetEntry
        fields = '__all__' # Includes all fields, including the new read-only ones

# Existing Leave Request Serializer
class LeaveRequestSerializer(serializers.ModelSerializer):
    # Read-only fields to display related object names
    user_username = serializers.ReadOnlyField(source='user.username')
    approved_by_username = serializers.ReadOnlyField(source='approved_by.username')

    class Meta:
        model = LeaveRequest
        # Ensure 'is_hourly', 'start_time', 'end_time' are included in fields if not already
        fields = '__all__' # Includes all fields, including the new read-only ones

# --- YOU MUST ADD THIS NEW SERIALIZER FOR JWT TOKEN RESPONSE ---
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
