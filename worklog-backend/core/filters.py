import django_filters
from .models import TaskTimeEntry # Make sure this import path is correct

class TaskTimeEntryFilter(django_filters.FilterSet):
    # Filtering for a specific date (start_time__gte and end_time__lte)
    start_time_gte = django_filters.DateTimeFilter(field_name="start_time", lookup_expr='gte')
    end_time_lte = django_filters.DateTimeFilter(field_name="end_time", lookup_expr='lte')

    # You might already have these, but ensure they are there for other filters
    user_id = django_filters.NumberFilter(field_name="user__id")
    task_id = django_filters.NumberFilter(field_name="task__id")
    project_id = django_filters.NumberFilter(field_name="task__project__id")


    class Meta:
        model = TaskTimeEntry
        fields = {
            'start_time': ['gte', 'lte'], # This is the primary one for date range
            'end_time': ['gte', 'lte'],   # This is also important if you use end_time for duration
            'user': ['exact'],
            'task': ['exact'],
            'task__project': ['exact'], # To filter by project ID
        }
        # You can also explicitly list the fields if Meta fields is not enough
        # fields = ['start_time_gte', 'end_time_lte', 'user_id', 'task_id', 'project_id']