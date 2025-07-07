# worklog_backend/core/permissions.py

from rest_framework import permissions

class IsAssignedUserOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow:
    - Authenticated users to read any task/leave request.
    - Authenticated users to create a task/leave request for themselves.
    - The assigned user (owner) to update/delete their own task/leave request.
    - Admin users (is_staff) to perform any action on any task/leave request.
    """

    def has_permission(self, request, view):
        # Allow read permissions for any authenticated request
        # SAFE_METHODS are GET, HEAD, OPTIONS
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated

        # For POST (create) requests:
        # Allow if the user is authenticated AND
        #   - they are an admin (is_staff) OR
        #   - they are trying to assign the task/leave request to themselves.
        if request.method == 'POST':
            if request.user and request.user.is_authenticated:
                if request.user.is_staff:
                    return True # Admins can create for anyone

                # For regular users creating:
                # Check if 'assigned_to' (for Task) or 'user' (for LeaveRequest) is provided
                # and matches the requesting user's ID.
                # If not provided, assume it will be set to request.user in serializer/view
                # (which is handled by perform_create/perform_create on LeaveRequestViewSet)
                
                # For Task creation:
                if view.basename == 'task': # Check the view's basename to differentiate
                    assigned_to_id = request.data.get('assigned_to')
                    return assigned_to_id is None or assigned_to_id == request.user.id
                
                # For LeaveRequest creation:
                elif view.basename == 'leaverequest':
                    user_id_in_data = request.data.get('user')
                    return user_id_in_data is None or user_id_in_data == request.user.id
                
                return False # Default deny if not a known view or missing ID
            return False # Not authenticated for POST
        
        # For other methods (PUT, PATCH, DELETE):
        # Only authenticated users can attempt these, object-level permission will then check ownership/admin status
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated

        # Write permissions (PUT, PATCH, DELETE) are only allowed to:
        # 1. The assigned user (owner) of the object.
        # 2. Admin users (is_staff).
        
        # Check if the user is an admin
        if request.user and request.user.is_staff:
            return True

        # Check if the user is the assigned user/owner of the object
        # For Task model: obj.assigned_to
        # For LeaveRequest model: obj.user
        if hasattr(obj, 'assigned_to') and obj.assigned_to == request.user:
            return True
        if hasattr(obj, 'user') and obj.user == request.user:
            return True
            
        return False # Deny if not admin and not owner
