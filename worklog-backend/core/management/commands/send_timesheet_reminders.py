# core/management/commands/send_timesheet_reminders.py
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.contrib.auth.models import User
from core.models import TimesheetEntry
from datetime import date, timedelta

class Command(BaseCommand):
    help = 'Sends email reminders to users who have not filled their timesheets for the previous day.'

    def handle(self, *args, **options):
        yesterday = date.today() - timedelta(days=1)
        self.stdout.write(f"Checking for timesheet reminders for {yesterday}...")

        users_to_remind = []
        # Filter for active users who are not staff (i.e., regular users)
        all_regular_users = User.objects.filter(is_active=True, is_staff=False)

        for user in all_regular_users:
            # Check if the user has any timesheet entries for yesterday
            has_entry_yesterday = TimesheetEntry.objects.filter(user=user, date=yesterday).exists()
            if not has_entry_yesterday:
                users_to_remind.append(user)

        if not users_to_remind:
            self.stdout.write(self.style.SUCCESS("No users need timesheet reminders today."))
            return

        for user in users_to_remind:
            subject = 'Reminder: Please fill your WorkLog timesheet!'
            message = (
                f"Hi {user.first_name if user.first_name else user.username},\n\n"
                f"This is a friendly reminder to fill your timesheet for {yesterday} on WorkLog.\n"
                "Please log in to WorkLog to submit your hours.\n\n"
                "Thank you,\n"
                "The WorkLog Team"
            )
            from_email = 'noreply@worklog.com' # Use the email configured in settings.py
            recipient_list = [user.email]

            if user.email: # Only send if user has an email
                try:
                    send_mail(subject, message, from_email, recipient_list, fail_silently=False)
                    self.stdout.write(self.style.SUCCESS(f"Successfully sent reminder to {user.username} ({user.email})"))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Failed to send reminder to {user.username} ({user.email}): {e}"))
            else:
                self.stdout.write(self.style.WARNING(f"Skipping reminder for {user.username} (no email address)."))

        self.stdout.write(self.style.SUCCESS(f"Finished sending timesheet reminders for {yesterday}."))
