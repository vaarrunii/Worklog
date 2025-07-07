# worklog-backend/worklog/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core import views # Assuming your views are in core/views.py
from rest_framework_simplejwt.views import (
    TokenRefreshView,
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
    path('api/', include(router.urls)), # Include DRF router URLs
    path('api/login/', views.LoginView.as_view(), name='login'), # Your custom login view if any
    path('api/logout/', views.LogoutView.as_view(), name='logout'),
    path('api/current-user/', views.CurrentUserView.as_view(), name='current-user'),
    path('api/register/', views.RegisterUserView.as_view(), name='register'),

    # Simple JWT Token Endpoints
    # --- CRITICAL FIX: Use your CustomTokenObtainPairView here ---
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
