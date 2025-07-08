# worklog-backend/core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView, LogoutView, ProjectViewSet, TaskViewSet,
    TimesheetEntryViewSet, LeaveRequestViewSet,
    UserViewSet, CurrentUserView, RegisterUserView,
    TaskTimeEntryListCreateView, TaskTimeEntryRetrieveUpdateDestroyView # NEW: Import TaskTimeEntry views
)

router = DefaultRouter()
router.register(r'projects', ProjectViewSet)
router.register(r'tasks', TaskViewSet)
router.register(r'timesheets', TimesheetEntryViewSet)
router.register(r'leave-requests', LeaveRequestViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('register/', RegisterUserView.as_view(), name='register'), # New registration endpoint
    path('current-user/', CurrentUserView.as_view(), name='current-user'),
    path('', include(router.urls)), # This includes all ViewSet URLs (projects, tasks, timesheets, leave-requests, users)

    # NEW: Explicitly add URL patterns for TaskTimeEntry views
    path('task-time-entries/', TaskTimeEntryListCreateView.as_view(), name='task-time-entry-list-create'),
    path('task-time-entries/<int:pk>/', TaskTimeEntryRetrieveUpdateDestroyView.as_view(), name='task-time-entry-retrieve-update-destroy'),
]
