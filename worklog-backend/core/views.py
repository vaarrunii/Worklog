# core/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from .models import Project, Task, TimesheetEntry, LeaveRequest
from .serializers import (
    UserSerializer, ProjectSerializer, TaskSerializer,
    TimesheetEntrySerializer, LeaveRequestSerializer,
    UserRegistrationSerializer # Import the new serializer
)
from rest_framework_simplejwt.tokens import RefreshToken # Import for JWT

# Helper function to get tokens (for login)
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

class LoginView(APIView):
    permission_classes = [AllowAny] # Allow unauthenticated users to access login

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            # For JWT authentication
            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Login successful',
                'user_id': user.id,
                'is_admin': user.is_staff, # Send back if user is staff (admin)
                'access_token': tokens['access'],
                'refresh_token': tokens['refresh'],
            }, status=status.HTTP_200_OK)
        else:
            return Response({'message': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated] # Only authenticated users can logout

    def post(self, request):
        # For JWT, typically you'd blacklist the refresh token
        # This assumes you have Simple JWT's TokenBlacklist app installed and configured
        try:
            refresh_token = request.data["refresh_token"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'message': 'Invalid token or already logged out'}, status=status.HTTP_400_BAD_REQUEST)

class RegisterUserView(APIView): # New view for user registration
    permission_classes = [AllowAny] # Allow anyone to register

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated] # Only authenticated users can get their own details

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserViewSet(viewsets.ReadOnlyModelViewSet): # ReadOnly because we only need to list/retrieve users
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser] # Only admin can list/retrieve users

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminUser] # Only admin can manage projects

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get_permissions(self):
        # Admin can create, update, delete tasks
        # Authenticated users can list/retrieve tasks assigned to them
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdminUser]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        # Admin sees all tasks. Regular users only see tasks assigned to them.
        if self.request.user.is_staff:
            return Task.objects.all()
        return Task.objects.filter(assigned_to=self.request.user)

class TimesheetEntryViewSet(viewsets.ModelViewSet):
    queryset = TimesheetEntry.objects.all()
    serializer_class = TimesheetEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can only see/manage their own timesheet entries
        # Admins can see all timesheet entries
        if self.request.user.is_staff:
            return TimesheetEntry.objects.all()
        return TimesheetEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Automatically set the user to the logged-in user
        serializer.save(user=self.request.user)

class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can only see/manage their own leave requests
        # Admins can see all leave requests
        if self.request.user.is_staff:
            return LeaveRequest.objects.all()
        return LeaveRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Only admin can change leave request status and set approved_by
        if self.request.user.is_staff:
            # If status is being changed, set approved_by
            if 'status' in serializer.validated_data and serializer.validated_data['status'] != serializer.instance.status:
                serializer.save(approved_by=self.request.user)
            else:
                serializer.save()
        else:
            # Regular users cannot change status or approved_by
            # Remove these fields from validated_data if a non-admin tries to update them
            if 'status' in serializer.validated_data:
                del serializer.validated_data['status']
            if 'approved_by' in serializer.validated_data:
                del serializer.validated_data['approved_by']
            if 'admin_comments' in serializer.validated_data: # Also prevent regular users from setting admin comments
                del serializer.validated_data['admin_comments']
            serializer.save()
