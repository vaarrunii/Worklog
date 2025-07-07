# worklog-backend/worklog_backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core import views # Assuming your views are in core/views.py
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
router.register(r'users', views.UserViewSet)
router.register(r'projects', views.ProjectViewSet)
router.register(r'tasks', views.TaskViewSet)
router.register(r'timesheets', views.TimesheetEntryViewSet)
router.register(r'leave-requests', views.LeaveRequestViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)), # Include DRF router URLs for users, projects, tasks, timesheets, leave-requests
    
    # Simple JWT Token Endpoints
    # The 'api/token/' path handles login (obtaining tokens)
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Logout endpoint (blacklists the refresh token)
    path('api/logout/', TokenBlacklistView.as_view(), name='token_blacklist'), # Use TokenBlacklistView directly
]

# Note: The paths for 'api/login/', 'api/current-user/', and 'api/register/'
# are removed here because their functionality is covered by:
# - 'api/token/' for login (token obtain)
# - 'api/users/' (UserViewSet) for user registration (POST) and current user details (GET /api/users/<id>/)
# - 'api/logout/' (TokenBlacklistView) for logout
