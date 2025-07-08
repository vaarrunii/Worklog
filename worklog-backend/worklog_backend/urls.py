# worklog-backend/worklog_backend/urls.py

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.http import JsonResponse  # ✅ NEW: For root response

# Your views
from core.views import (
    UserViewSet, ProjectViewSet, TaskViewSet, TimesheetEntryViewSet, LeaveRequestViewSet,
    TaskTimeEntryListCreateView, TaskTimeEntryRetrieveUpdateDestroyView
)
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenBlacklistView,
)

# Custom JWT view
from core.serializers import MyTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView as OriginalTokenObtainPairView

class CustomTokenObtainPairView(OriginalTokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

# DRF Router
router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'tasks', TaskViewSet)
router.register(r'timesheets', TimesheetEntryViewSet)
router.register(r'leave-requests', LeaveRequestViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', TokenBlacklistView.as_view(), name='token_blacklist'),

    path('api/task-time-entries/', TaskTimeEntryListCreateView.as_view(), name='task-time-entry-list-create'),
    path('api/task-time-entries/<int:pk>/', TaskTimeEntryRetrieveUpdateDestroyView.as_view(), name='task-time-entry-retrieve-update-destroy'),

    # ✅ NEW: Root URL — returns a JSON health check
    path('', lambda request: JsonResponse({
        "status": "ok",
        "message": "Worklog backend is live ✅"
    })),
]
