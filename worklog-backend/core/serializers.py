# core/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Project, Task, TimesheetEntry, LeaveRequest

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['is_staff']

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

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'

class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.ReadOnlyField(source='project.name')
    assigned_to_username = serializers.ReadOnlyField(source='assigned_to.username')

    class Meta:
        model = Task
        fields = '__all__'

class TimesheetEntrySerializer(serializers.ModelSerializer):
    user_username = serializers.ReadOnlyField(source='user.username')
    task_name = serializers.ReadOnlyField(source='task.name')
    project_name = serializers.ReadOnlyField(source='task.project.name')

    class Meta:
        model = TimesheetEntry
        fields = '__all__'

class LeaveRequestSerializer(serializers.ModelSerializer):
    user_username = serializers.ReadOnlyField(source='user.username')
    approved_by_username = serializers.ReadOnlyField(source='approved_by.username')

    class Meta:
        model = LeaveRequest
        # Ensure 'is_hourly', 'start_time', 'end_time' are included in fields
        fields = '__all__'

