# core/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView, LogoutView, ProjectViewSet, TaskViewSet,
    TimesheetEntryViewSet, LeaveRequestViewSet,
    UserViewSet, CurrentUserView, RegisterUserView # <-- Added RegisterUserView
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
    path('', include(router.urls)),
]