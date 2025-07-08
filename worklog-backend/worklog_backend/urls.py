# worklog-backend/worklog_backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
# Assuming your views are in core/views.py. Make sure these imports are correct.
from core.views import (
    UserViewSet, ProjectViewSet, TaskViewSet, TimesheetEntryViewSet, LeaveRequestViewSet,
    TaskTimeEntryListCreateView, TaskTimeEntryRetrieveUpdateDestroyView # NEW: Import TaskTimeEntry views
)
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenBlacklistView, # Import TokenBlacklistView for logout
)

# --- CRITICAL IMPORTS AND CUSTOM VIEW DEFINITION ---
# Import your custom serializer
from core.serializers import MyTokenObtainPairSerializer
# Import the original TokenObtainPairView under an alias to avoid name collision
from rest_framework_simplejwt.views import TokenObtainPairView as OriginalTokenObtainPairView

# Create a custom view that uses your custom serializer
class CustomTokenObtainPairView(OriginalTokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
# --- END CRITICAL IMPORTS AND CUSTOM VIEW DEFINITION ---

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'users', UserViewSet) # Use UserViewSet directly
router.register(r'projects', ProjectViewSet) # Use ProjectViewSet directly
router.register(r'tasks', TaskViewSet) # Use TaskViewSet directly
router.register(r'timesheets', TimesheetEntryViewSet) # Use TimesheetEntryViewSet directly
router.register(r'leave-requests', LeaveRequestViewSet) # Use LeaveRequestViewSet directly

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)), # Include DRF router URLs for users, projects, tasks, timesheets, leave-requests

    # Simple JWT Token Endpoints
    # The 'api/token/' path handles login (obtaining tokens)
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Logout endpoint (blacklists the refresh token)
    path('api/logout/', TokenBlacklistView.as_view(), name='token_blacklist'), # Use TokenBlacklistView directly

    # NEW: Explicitly add URL patterns for TaskTimeEntry views
    path('api/task-time-entries/', TaskTimeEntryListCreateView.as_view(), name='task-time-entry-list-create'),
    path('api/task-time-entries/<int:pk>/', TaskTimeEntryRetrieveUpdateDestroyView.as_view(), name='task-time-entry-retrieve-update-destroy'),
]
