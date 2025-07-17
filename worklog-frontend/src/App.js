import React, { useState, useEffect, useCallback, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Default styles for react-calendar
import moment from 'moment'; // Import moment for date/time handling

// Define your Django API base URL
// IMPORTANT: This must be your deployed Render backend URL or your local Django backend URL
const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Changed to localhost for testing


// Helper function to make authenticated API calls with JWT token
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle token expiration (optional, but good practice)
  if (response.status === 401 && !options._isRetry) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('access_token', data.access);
          localStorage.setItem('refresh_token', data.refresh);
          localStorage.setItem('user_role', data.is_admin ? 'admin' : 'user');
          localStorage.setItem('user_id', data.user_id);

          const retryOptions = { ...options, _isRetry: true };
          return authenticatedFetch(url, retryOptions);
        } else {
          console.error('Failed to refresh token. Logging out.');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('user_id');
          window.location.reload(); // Force a reload to clear state and redirect to login
          return response;
        }
      } catch (refreshError) {
        console.error('Network error during token refresh:', refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        window.location.reload(); // Force a reload to clear state and redirect to login
        return response;
      }
    } else {
      console.warn('No refresh token available. Logging out.');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      window.location.reload(); // Force a reload to clear state and redirect to login
      return response;
    }
  }

  return response;
}

// Helper to get dates for a week starting from a given date (Monday is day 0, Sunday is day 6)
const getWeekDates = (startDate, includeSunday = true) => {
  const dates = [];
  const startOfWeek = new Date(startDate);
  const dayOfWeek = startOfWeek.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday start
  startOfWeek.setDate(diff);

  for (let i = 0; i < (includeSunday ? 7 : 6); i++) { // Loop 6 days for Mon-Sat, 7 for Mon-Sun
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    // Exclude Sunday if not included
    if (!includeSunday && date.getDay() === 0) { // If it's Sunday (0) and we don't want it, skip
      continue;
    }
    dates.push(date);
  }
  return dates;
};

// Helper to format date as YYYY-MM-DD (LOCAL TIME)
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get short day name (e.g., Mon, Tue)
const getDayName = (date) => {
  const options = { weekday: 'short' };
  return date.toLocaleDateString('en-US', options);
};

// Helper to convert hours decimal to "X hours Y minutes"
const formatHoursToMinutes = (decimalHours) => {
  if (typeof decimalHours !== 'number' || isNaN(decimalHours)) {
    return '0 hours 0 minutes';
  }
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours} hours ${minutes} minutes`;
};


// --- CORE COMPONENTS (DEFINED FIRST AS THEY ARE CHILDREN) ---

// Generic Confirmation Modal Component
function ConfirmationModal({ isOpen, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
        <p className="text-lg font-semibold mb-4">{message}</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-200 shadow-sm text-sm" // Lighter, smaller, less shadow
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-200 shadow-sm text-sm" // Lighter, smaller, less shadow
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Login Component (Regular User Login)
function Login({ onLogin, onGoToRegister, onGoToAdminLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    onLogin(username, password).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">Login to WorkLog (User)</h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="mb-5">
          <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">
            Username
          </label>
          <input
            type="text"
            id="username"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-transparent transition duration-200"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-transparent transition duration-200"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-col items-center justify-between gap-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-200 to-purple-300 hover:from-blue-300 hover:to-purple-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline shadow-sm transform hover:scale-105 transition duration-300 ease-in-out text-sm" // Lighter, smaller, smaller shadow, smaller font
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={onGoToRegister}
            className="w-full text-blue-400 hover:text-blue-600 text-xs font-semibold transition duration-300 ease-in-out" // Smaller font, slightly lighter hover
            disabled={isLoading}
          >
            Don't have an account? Register here.
          </button>
          <button
            type="button"
            onClick={onGoToAdminLogin}
            className="w-full text-purple-400 hover:text-purple-600 text-xs font-semibold mt-2 transition duration-300 ease-in-out" // Smaller font, slightly lighter hover
            disabled={isLoading}
          >
            Are you an Admin? Login here.
          </button>
        </div>
      </form>
    </div>
  );
}

// Admin Login Component (Separate UI for Admin Login)
function AdminLogin({ onLogin, onGoToRegularLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    // The onLogin function will handle checking for is_admin
    onLogin(username, password).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">Login to WorkLog (Admin)</h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="mb-5">
          <label htmlFor="adminUsername" className="block text-gray-700 text-sm font-bold mb-2">
            Admin Username
          </label>
          <input
            type="text"
            id="adminUsername"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-transparent transition duration-200" // Smaller padding, lighter ring
            placeholder="Enter admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-6">
          <label htmlFor="adminPassword" className="block text-gray-700 text-sm font-bold mb-2">
            Admin Password
          </label>
          <input
            type="password"
            id="adminPassword"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-transparent transition duration-200" // Smaller padding, lighter ring
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-col items-center justify-between gap-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-200 to-indigo-300 hover:from-purple-300 hover:to-indigo-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline shadow-sm transform hover:scale-105 transition duration-300 ease-in-out text-sm" // Lighter, smaller, smaller shadow, smaller font
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In as Admin'}
          </button>
          <button
            type="button"
            onClick={onGoToRegularLogin}
            className="w-full text-blue-400 hover:text-blue-600 text-xs font-semibold mt-2 transition duration-300 ease-in-out" // Smaller font, slightly lighter hover
            disabled={isLoading}
          >
            Not an Admin? Go back to User Login.
          </button>
        </div>
      </form>
    </div>
  );
}


// Register Component
function Register({ onRegisterSuccess, onGoToLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false); // NEW STATE: For admin checkbox
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    if (!username || !email || !password) {
      setMessage('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          is_staff: makeAdmin // NEW: Send is_staff flag to backend
        }),
      });

      if (response.ok) {
        onRegisterSuccess();
      } else {
        const errorData = await response.json();
        if (errorData.username) {
          setMessage(`Username: ${errorData.username[0]}`);
        } else if (errorData.email) {
          setMessage(`Email: ${errorData.email[0]}`);
        } else if (errorData.password) {
          setMessage(`Password: ${errorData.password[0]}`);
        } else {
          setMessage(errorData.detail || 'Registration failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage('An error occurred during registration. Please check your network.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">Register for WorkLog</h2>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-8 rounded-lg shadow-md border border-gray-200">
        {message && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{message}</span>
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="regUsername" className="block text-gray-700 text-sm font-bold mb-2">
            Username
          </label>
          <input
            type="text"
            id="regUsername"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200" // Smaller padding, lighter ring
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="regEmail" className="block text-gray-700 text-sm font-bold mb-2">
            Email
          </label>
          <input
            type="email"
            id="regEmail"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200" // Smaller padding, lighter ring
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="regPassword" className="block text-gray-700 text-sm font-bold mb-2">
            Password
          </label>
          <input
            type="password"
            id="regPassword"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200" // Smaller padding, lighter ring
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-bold mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200" // Smaller padding, lighter ring
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        {/* NEW ADMIN CHECKBOX */}
        <div className="mb-6 flex items-center">
          <input
            type="checkbox"
            id="makeAdmin"
            className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            checked={makeAdmin}
            onChange={(e) => setMakeAdmin(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor="makeAdmin" className="text-gray-700 text-sm font-bold">
            Register as Admin (for testing only, uncheck for regular users)
          </label>
        </div>
        {/* END NEW ADMIN CHECKBOX */}
        <div className="flex flex-col items-center justify-between gap-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-green-200 to-teal-300 hover:from-green-300 hover:to-teal-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline shadow-sm transform hover:scale-105 transition duration-300 ease-in-out text-sm" // Lighter, smaller, smaller shadow, smaller font
            disabled={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
          <button
            type="button"
            onClick={onGoToLogin}
            className="w-full text-blue-400 hover:text-blue-600 text-xs font-semibold transition duration-300 ease-in-out" // Smaller font, slightly lighter hover
            disabled={isLoading}
          >
            Already have an account? Login here.
          </button>
        </div>
      </form>
    </div>
  );
}

// Project and Task Management Component (Admin) - COMBINED
function ProjectAndTaskManagement({ userId, openConfirmModal }) {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]); // All users
  const [nonAdminUsers, setNonAdminUsers] = useState([]); // Only non-admin users for assignment
  const [adminUsers, setAdminUsers] = useState([]); // Only admin users for reporting manager
  const [tasks, setTasks] = useState([]); // All tasks

  const [newProjectName, setNewProjectName] = useState('');
  // REMOVED: newProjectDescription state
  const [editingProject, setEditingProject] = useState(null);

  const [selectedProjectForTask, setSelectedProjectForTask] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [assignedToUser, setAssignedToUser] = useState('');
  const [reportingManager, setReportingManager] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // NEW STATE for collapsible sections
  const [showExistingProjects, setShowExistingProjects] = useState(true);
  const [showExistingTasks, setShowExistingTasks] = useState(true);


  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectsResponse, usersResponse, tasksResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/projects/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/users/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/tasks/`, { method: 'GET' }),
      ]);

      if (projectsResponse.ok) {
        const data = await projectsResponse.json();
        setProjects(data);
        if (data.length > 0 && !selectedProjectForTask) setSelectedProjectForTask(data[0].id);
      } else {
        const errorData = await projectsResponse.json();
        setMessage(`Failed to fetch projects: ${errorData.detail || 'Unknown error'}`);
      }

      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsers(data);
        const regularUsers = data.filter(user => !user.is_staff);
        setNonAdminUsers(regularUsers);
        const staffUsers = data.filter(user => user.is_staff);
        setAdminUsers(staffUsers);
        if (regularUsers.length > 0 && !assignedToUser) setAssignedToUser(regularUsers[0].id);
        if (staffUsers.length > 0 && !reportingManager) setReportingManager(staffUsers[0].id);
      } else {
        const errorData = await usersResponse.json();
        setMessage(`Failed to fetch users: ${errorData.detail || 'Unknown error'}`);
      }

      if (tasksResponse.ok) {
        setTasks(await tasksResponse.json());
      } else {
        const errorData = await tasksResponse.json();
        setMessage(`Failed to fetch tasks: ${errorData.detail || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Error fetching initial data:', error);
      setMessage('Network error while fetching initial data.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [authenticatedFetch, selectedProjectForTask, assignedToUser, reportingManager]);

  useEffect(() => {
    if (userId) {
        fetchAllData();
    }
  }, [userId, fetchAllData]);

  // Project Handlers
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setMessage('Project name cannot be empty.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/projects/`, {
        method: 'POST',
        // REMOVED: description from payload
        body: JSON.stringify({ name: newProjectName }),
      });
      if (response.ok) {
        setMessage('Project added successfully!');
        setNewProjectName('');
        // REMOVED: setNewProjectDescription('');
        fetchAllData();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to add project: ${errorData.name || errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding project:', error);
      setMessage('Network error while adding project.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    // REMOVED: setNewProjectDescription(project.description);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setMessage('Project name cannot be empty.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/projects/${editingProject.id}/`, {
        method: 'PUT',
        // REMOVED: description from payload
        body: JSON.stringify({ name: newProjectName }),
      });
      if (response.ok) {
        setMessage('Project updated successfully!');
        setEditingProject(null);
        setNewProjectName('');
        // REMOVED: setNewProjectDescription('');
        fetchAllData();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to update project: ${errorData.name || errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating project:', error);
      setMessage('Network error while updating project.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteProject = (projectId) => {
    openConfirmModal('Are you sure you want to delete this project? This action cannot be undone. All associated tasks will also be deleted.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/projects/${projectId}/`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setMessage('Project deleted successfully!');
          fetchAllData();
        } else {
          const errorData = await response.json();
          setMessage(`Failed to delete project: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        setMessage('Network error while deleting project.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  // Task Handlers
  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedProjectForTask || !assignedToUser) {
      setMessage('Please fill all required task fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/`, {
        method: 'POST',
        body: JSON.stringify({
          project: selectedProjectForTask,
          name: newTaskName,
          description: newTaskDescription,
          assigned_to: assignedToUser,
          due_date: newTaskDueDate || null,
          parent_task: null, // Always null as parent task is removed
          reporting_manager: reportingManager || null,
        }),
      });
      if (response.ok) {
        setMessage('Task assigned successfully!');
        setNewTaskName('');
        setNewTaskDescription('');
        setNewTaskDueDate('');
        fetchAllData();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to assign task: ${errorData.name || errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      setMessage('Network error while assigning task.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setSelectedProjectForTask(task.project);
    setNewTaskName(task.name);
    setNewTaskDescription(task.description);
    setNewTaskDueDate(task.due_date || '');
    setAssignedToUser(task.assigned_to || '');
    setReportingManager(task.reporting_manager || '');
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedProjectForTask || !assignedToUser) {
      setMessage('Please fill all required task fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${editingTask.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          project: selectedProjectForTask,
          name: newTaskName,
          description: newTaskDescription,
          assigned_to: assignedToUser,
          due_date: newTaskDueDate || null,
          status: editingTask.status,
          progress: editingTask.progress,
          parent_task: null, // Always null as parent task is removed
          reporting_manager: reportingManager || null,
        }),
      });
      if (response.ok) {
        setMessage('Task updated successfully!');
        setEditingTask(null);
        setNewTaskName('');
        setNewTaskDescription('');
        setNewTaskDueDate('');
        setSelectedProjectForTask(projects.length > 0 ? projects[0].id : '');
        setAssignedToUser(nonAdminUsers.length > 0 ? nonAdminUsers[0].id : '');
        setReportingManager(adminUsers.length > 0 ? adminUsers[0].id : '');
        fetchAllData();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to update task: ${errorData.name || errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      setMessage('Network error while updating task.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteTask = (taskId) => {
    openConfirmModal('Are you sure you want to delete this task? This action cannot be undone. All associated tasks will also be deleted.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${taskId}/`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setMessage('Task deleted successfully!');
          fetchAllData();
        } else {
          const errorData = await response.json();
          setMessage(`Failed to delete task: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        setMessage('Network error while deleting task.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  const getProjectName = (projectId) => projects.find(p => p.id === projectId)?.name || 'N/A';
  const getUserName = (userId) => users.find(u => u.id === userId)?.username || 'N/A';

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Manage Projects & Tasks</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-blue-100 border border-blue-400 text-blue-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      {/* Combined Project and Task Management Section */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-xl border border-blue-200"> {/* Changed to-green-50 to to-blue-100 */}
        {/* Project Management Section */}
        <div className="mb-8 pb-8 border-b border-blue-200"> {/* Added border-b for visual separation */}
          <h4 className="text-xl font-medium text-gray-700 mb-4">{editingProject ? 'Edit Project' : 'Add New Project'}</h4>
          <form onSubmit={editingProject ? handleUpdateProject : handleAddProject}>
            <div className="mb-4">
              <label htmlFor="projectName" className="block text-gray-700 text-sm font-bold mb-2">Project Name</label>
              <input type="text" id="projectName" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g., Q3 Marketing Campaign" required disabled={isLoading} />
            </div>
            {/* REMOVED Project Description field */}
            <div className="flex space-x-4">
              <button type="submit" className="bg-blue-200 hover:bg-blue-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" disabled={isLoading}> {/* Lighter blue, smaller, less shadow */}
                {isLoading ? (editingProject ? 'Updating...' : 'Adding...') : (editingProject ? 'Update Project' : 'Add Project')}
              </button>
              {editingProject && (
                <button type="button" onClick={() => { setEditingProject(null); setNewProjectName(''); /* REMOVED: setNewProjectDescription(''); */ }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" disabled={isLoading}> {/* Lighter, smaller, less shadow */}
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          {/* Existing Projects - Collapsible Section */}
          <div className="mt-8">
            <button
              className="flex items-center justify-between w-full py-2.5 px-4 bg-blue-100 text-blue-800 font-semibold rounded-lg shadow-sm hover:bg-blue-200 transition duration-300 text-base border border-blue-200" // Slightly larger padding, added border
              onClick={() => setShowExistingProjects(!showExistingProjects)}
            >
              <h4 className="text-base">Existing Projects</h4> {/* Maintained size for consistency with button */}
              <svg className={`w-5 h-5 transform transition-transform ${showExistingProjects ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {showExistingProjects && (
              <div className="mt-4">
                {isLoading && projects.length === 0 ? (
                  <p className="text-gray-500">Loading projects...</p>
                ) : projects.length === 0 ? (
                  <p className="text-gray-500">No projects added yet. Add one above!</p>
                ) : (
                  <ul className="space-y-3"> {/* Slightly reduced spacing */}
                    {projects.map((project) => (
                      <li key={project.id} className="bg-blue-100 p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col sm:flex-row justify-between items-start sm:items-center"> {/* Changed background/border to blue */}
                        <div className="mb-1 sm:mb-0"> {/* Smaller margin */}
                          <p className="font-semibold text-sm text-blue-800">{project.name}</p> {/* Made project name smaller (text-sm) */}
                          {/* REMOVED project.description */}
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => handleEditProject(project)} className="px-3 py-1.5 bg-yellow-300 text-gray-800 rounded-lg hover:bg-yellow-400 transition duration-300 text-xs shadow-sm">Edit</button> {/* Lighter, smaller, smaller font, less shadow */}
                          <button onClick={() => handleDeleteProject(project.id)} className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 text-xs shadow-sm">Delete</button> {/* Lighter, smaller, smaller font, less shadow */}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task Assignment Section */}
        <div>
          <h4 className="text-xl font-medium text-gray-700 mb-4">{editingTask ? 'Edit Task' : 'Assign New Task'}</h4>
          <form onSubmit={editingTask ? handleUpdateTask : handleAssignTask}>
            <div className="mb-4">
              <label htmlFor="selectProjectForTask" className="block text-gray-700 text-sm font-bold mb-2">Select Project</label>
              <select id="selectProjectForTask" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={selectedProjectForTask} onChange={(e) => setSelectedProjectForTask(e.target.value)} required disabled={isLoading || projects.length === 0}> {/* Changed ring color to blue */}
                {projects.length === 0 ? (<option value="">No projects available</option>) : (projects.map((project) => (<option key={project.id} value={project.id}>{project.name}</option>)))}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="taskName" className="block text-gray-700 text-sm font-bold mb-2">Task Name</label>
              <input type="text" id="taskName" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="e.g., Design Landing Page" required disabled={isLoading} /> {/* Changed ring color to blue */}
            </div>
            <div className="mb-4">
              <label htmlFor="taskDescription" className="block text-gray-700 text-sm font-bold mb-2">Task Description</label>
              <textarea id="taskDescription" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Detailed description of the task" rows="3" disabled={isLoading}></textarea> {/* Changed ring color to blue */}
            </div>
            <div className="mb-4">
              <label htmlFor="taskDueDate" className="block text-gray-700 text-sm font-bold mb-2">Due Date</label>
              <input type="date" id="taskDueDate" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} disabled={isLoading} /> {/* Changed ring color to blue */}
            </div>
            <div className="mb-4">
              <label htmlFor="assignTo" className="block text-gray-700 text-sm font-bold mb-2">Assign To</label>
              <select id="assignTo" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={assignedToUser} onChange={(e) => setAssignedToUser(e.target.value)} required disabled={isLoading || nonAdminUsers.length === 0}> {/* Changed ring color to blue */}
                {nonAdminUsers.length === 0 ? (<option value="">No users available</option>) : (nonAdminUsers.map((user) => (<option key={user.id} value={user.id}>{user.username}</option>)))}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="reportingManager" className="block text-gray-700 text-sm font-bold mb-2">Reporting Manager</label> {/* SHORTENED LABEL */}
              <select id="reportingManager" className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200" value={reportingManager} onChange={(e) => setReportingManager(e.target.value)} disabled={isLoading || adminUsers.length === 0}> {/* Changed ring color to blue */}
                <option value="">None</option>
                {adminUsers.map((user) => (<option key={user.id} value={user.id}>{user.username}</option>))}
              </select>
              {adminUsers.length === 0 && <p className="text-sm text-gray-500 mt-1">No admin users available to be reporting managers.</p>}
            </div>
            <div className="flex space-x-4">
              <button type="submit" className="bg-blue-200 hover:bg-blue-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" disabled={isLoading || projects.length === 0 || nonAdminUsers.length === 0}> {/* Lighter blue, smaller, less shadow */}
                {isLoading ? (editingTask ? 'Updating...' : 'Assigning...') : (editingTask ? 'Update Task' : 'Assign Task')}
              </button>
              {editingTask && (
                <button type="button" onClick={() => { setEditingTask(null); setNewTaskName(''); setNewTaskDescription(''); setNewTaskDueDate(''); setSelectedProjectForTask(projects.length > 0 ? projects[0].id : ''); setAssignedToUser(nonAdminUsers.length > 0 ? nonAdminUsers[0].id : ''); setReportingManager(adminUsers.length > 0 ? adminUsers[0].id : ''); }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" disabled={isLoading}> {/* Lighter, smaller, less shadow */}
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          {/* Existing Tasks - Collapsible Section */}
          <div className="mt-8">
            <button
              className="flex items-center justify-between w-full py-2.5 px-4 bg-blue-100 text-blue-800 font-semibold rounded-lg shadow-sm hover:bg-blue-200 transition duration-300 text-base border border-blue-200" // Slightly larger padding, added border
              onClick={() => setShowExistingTasks(!showExistingTasks)}
            >
              <h4 className="text-base">Existing Tasks</h4> {/* Maintained size for consistency with button */}
              <svg className={`w-5 h-5 transform transition-transform ${showExistingTasks ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {showExistingTasks && (
              <div className="mt-4">
                {isLoading && tasks.length === 0 ? (
                  <p className="text-gray-500">Loading tasks...</p>
                ) : tasks.length === 0 ? (
                  <p className="text-gray-500">No tasks assigned yet. Assign one above!</p>
                ) : (
                  <ul className="space-y-3"> {/* Slightly reduced spacing */}
                    {tasks.map((task) => (
                      <li key={task.id} className="bg-blue-100 p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col sm:flex-row justify-between items-start sm:items-center"> {/* Changed background/border to blue */}
                        <div className="mb-1 sm:mb-0"> {/* Smaller margin */}
                          <p className="font-semibold text-sm text-blue-800">{task.name} (Project: {getProjectName(task.project)})</p> {/* Made task name smaller (text-sm), changed text color to blue */}
                          <p className="text-gray-600 text-xs">Assigned To: {getUserName(task.assigned_to)}</p> {/* Smaller font */}
                          <p className="text-gray-600 text-xs">Due Date: {task.due_date || 'N/A'}</p> {/* Smaller font */}
                          <p className="text-gray-600 text-xs">Reporting Manager: {getUserName(task.reporting_manager)}</p> {/* Smaller font */}
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => handleEditTask(task)} className="px-3 py-1.5 bg-yellow-300 text-gray-800 rounded-lg hover:bg-yellow-400 transition duration-300 text-xs shadow-sm">Edit</button> {/* Lighter, smaller, smaller font, less shadow */}
                          <button onClick={() => handleDeleteTask(task.id)} className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 text-xs shadow-sm">Delete</button> {/* Lighter, smaller, smaller font, less shadow */}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// User Management Component (Admin)
function UserManagement({ userId, openConfirmModal }) {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState(''); // Corrected: Declared newEmail
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [isNewUserStaff, setIsNewUserStaff] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/users/`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const errorData = await response.json();
        setMessage(`Failed to fetch users: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage('Network error while fetching users.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [authenticatedFetch]); // Added authenticatedFetch to dependencies

  useEffect(() => {
    if (userId) { // Only fetch if userId is available
        fetchUsers();
    }
  }, [userId, fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newPassword !== newConfirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setMessage('Please fill all required fields.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail, // Corrected: Use newEmail here
          password: newPassword,
          is_staff: isNewUserStaff
        }),
      });

      if (response.ok) {
        setMessage('User created successfully!');
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewConfirmPassword('');
        setIsNewUserStaff(false);
        fetchUsers();
      } else {
        const errorData = await response.json();
        if (errorData.username) {
          setMessage(`Error: Username - ${errorData.username[0]}`);
        } else if (errorData.email) {
          setMessage(`Error: Email - ${errorData.email[0]}`);
        } else if (errorData.password) {
          setMessage(`Error: Password - ${errorData.password[0]}`);
        } else {
          setMessage(`Failed to create user: ${errorData.detail || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage('Network error while creating user.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteUser = (userToDeleteId, usernameToDelete) => {
    // Prevent admin from deleting themselves
    if (userToDeleteId === userId) {
      setMessage("You cannot delete your own admin account.");
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    openConfirmModal(`Are you sure you want to delete user "${usernameToDelete}"? This action cannot be undone.`, async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/users/${userToDeleteId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage(`User "${usernameToDelete}" deleted successfully!`);
          fetchUsers(); // Re-fetch the user list
        } else {
          const errorData = await response.json();
          setMessage(`Failed to delete user: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setMessage('Network error while deleting user.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Manage Users</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-purple-100 border border-purple-400 text-purple-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      <form onSubmit={handleCreateUser} className="mb-8 bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">Create New User</h4>
        <div className="mb-4">
          <label htmlFor="newUsername" className="block text-gray-700 text-sm font-bold mb-2">
            Username
          </label>
          <input
            type="text"
            id="newUsername"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="newEmail" className="block text-gray-700 text-sm font-bold mb-2">
            Email
          </label>
          <input
            type="email"
            id="newEmail"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
            value={newEmail} // Corrected: Use newEmail
            onChange={(e) => setNewEmail(e.target.value)} // Corrected: Use setNewEmail
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="newPassword" className="block text-gray-700 text-sm font-bold mb-2">
            Password
          </label>
          <input
            type="password"
            id="newPassword"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="newConfirmPassword" className="block text-gray-700 text-sm font-bold mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="newConfirmPassword"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
            value={newConfirmPassword}
            onChange={(e) => setNewConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-6 flex items-center">
          <input
            type="checkbox"
            id="isNewUserStaff"
            className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            checked={isNewUserStaff}
            onChange={(e) => setIsNewUserStaff(e.target.checked)}
            disabled={isLoading}
          />
          <label htmlFor="isNewUserStaff" className="text-gray-700 text-sm font-bold">
            Make this user an Admin (Staff status)
          </label>
        </div>
        <button
          type="submit"
          className="bg-purple-300 hover:bg-purple-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Create User'}
        </button>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Existing Users</h4>
      {isLoading && users.length === 0 ? (
        <p className="text-gray-500">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-500">No users found. Create one above!</p>
      ) : (
        <ul className="space-y-3"> {/* Slightly reduced spacing */}
          {users.map((user) => (
            <li key={user.id} className="bg-purple-50 p-3 rounded-lg shadow-sm border border-purple-100 flex justify-between items-center"> {/* Smaller padding */}
              <div>
                <p className="font-semibold text-base text-purple-800">{user.username} {user.is_staff && <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-purple-200 text-purple-800">Admin</span>}</p> {/* Smaller font for username, smaller padding for admin tag */}
                <p className="text-gray-600 text-xs">{user.email}</p> {/* Smaller font */}
              </div>
              {/* Added Delete Button for Users */}
              <button
                onClick={() => handleDeleteUser(user.id, user.username)}
                className={`px-3 py-1.5 text-white rounded-lg transition duration-300 text-xs shadow-sm ${ // Lighter, smaller, smaller font, less shadow
                  user.id === userId // Disable if it's the currently logged-in user
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-red-300 hover:bg-red-400'
                }`}
                disabled={isLoading || user.id === userId} // Disable while loading or if it's self
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Leave Approval Component (Admin)
function LeaveApproval({ userId, openConfirmModal, onLeaveStatusChange }) { // Added onLeaveStatusChange prop
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLeaveRequests = useCallback(async () => {
    console.log('[LeaveApproval] fetchLeaveRequests: Starting fetch...');
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[LeaveApproval] fetchLeaveRequests: Raw data fetched successfully.', data);
        // Display ALL leave requests, not just pending ones for admin view
        setLeaveRequests(data);
      } else {
        // If response is not OK, log the raw text for debugging
        const errorText = await response.text();
        console.error('Failed to fetch leave requests. Response status:', response.status, 'Response text:', errorText);
        setMessage(`Failed to fetch leave requests: ${response.status} - ${errorText || 'Unknown error'}.`);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setMessage('Network error while fetching leave requests.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [authenticatedFetch]); // Added authenticatedFetch to dependencies

  useEffect(() => {
    if (userId) { // Only fetch if userId is available
        fetchLeaveRequests();
    }
  }, [userId, fetchLeaveRequests]);

  const handleUpdateLeaveRequest = async (requestId, newStatus, adminComments = '') => {
    console.log(`[LeaveApproval] handleUpdateLeaveRequest: Attempting to update request ${requestId} to status: ${newStatus}`);
    setIsLoading(true);
    setMessage(''); // Clear previous messages
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${requestId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, admin_comments: adminComments }),
      });

      if (response.ok) {
        console.log(`[LeaveApproval] handleUpdateLeaveRequest: Request ${requestId} updated successfully to ${newStatus}.`);
        setMessage(`Leave request ${newStatus} successfully!`);
        // Re-fetch the full list to ensure consistency and get any new pending requests
        fetchLeaveRequests();
        // Notify parent (App component) to trigger user's re-fetch
        onLeaveStatusChange();
        console.log('[LeaveApproval] onLeaveStatusChange() called.');
      } else {
        const errorData = await response.json();
        console.error(`[LeaveApproval] handleUpdateLeaveRequest: Failed to update request ${requestId}.`, response.status, errorData);
        setMessage(`Failed to update leave request: ${errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
        // If update fails, re-fetch to revert optimistic update
        fetchLeaveRequests();
      }
    } catch (error) {
      console.error('[LeaveApproval] handleUpdateLeaveRequest: Network error.', error);
      setMessage('Network error while updating leave request.');
      // If network error, re-fetch to revert optimistic update
      fetchLeaveRequests();
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteLeaveRequest = (requestId) => {
    openConfirmModal('Are you sure you want to delete this leave request? This action cannot be undone.', async () => {
      setIsLoading(true);
      setMessage(''); // Clear previous messages
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${requestId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          console.log(`[LeaveApproval] handleDeleteLeaveRequest: Request ${requestId} deleted successfully.`);
          setMessage('Leave request deleted successfully!');
          // Optimistically remove the deleted request from the displayed list
          setLeaveRequests(prevRequests =>
              prevRequests.filter(req => req.id !== requestId)
          );
          fetchLeaveRequests(); // Re-fetch for admin's view to update UI
          onLeaveStatusChange(); // Notify parent (App component)
          console.log('[LeaveApproval] onLeaveStatusChange() called.');
        } else {
          const errorData = await response.json();
          console.error(`[LeaveApproval] handleDeleteLeaveRequest: Failed to delete request ${requestId}.`, response.status, errorData);
          setMessage(`Failed to delete leave request: ${errorData.detail || 'Unknown error'}`);
          fetchLeaveRequests(); // Re-fetch if delete fails
        }
      } catch (error) {
        console.error('[LeaveApproval] handleDeleteLeaveRequest: Network error.', error);
        setMessage('Network error while deleting leave request.');
        fetchLeaveRequests(); // Re-fetch if network error
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Approve/Reject Leave Requests</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <p className="text-gray-600 mb-4 text-sm"> {/* Keep this text, it's informative */}
        You are viewing all leave requests (pending, approved, and rejected). Use the buttons to change status or delete requests.
      </p>

      {isLoading && leaveRequests.length === 0 ? (
        <p className="text-gray-500">Loading leave requests...</p>
      ) : leaveRequests.length === 0 ? (
        <p className="text-gray-500">No leave requests to review.</p>
      ) : (
        <ul className="space-y-3"> {/* Slightly reduced spacing */}
          {leaveRequests.map((request) => (
            <li key={request.id} className="bg-red-50 p-3 rounded-lg shadow-sm border border-red-100 flex flex-col sm:flex-row justify-between items-start sm:items-center"> {/* Smaller padding */}
              <div className="mb-1 sm:mb-0"> {/* Smaller margin */}
                <p className="font-semibold text-base text-red-800">{request.user_username} - {request.leave_type} {request.is_hourly && `(${request.start_time} - ${request.end_time})`}</p> {/* Smaller font */}
                <p className="text-gray-600 text-xs"> {/* Smaller font */}
                  {request.start_date} {request.is_hourly ? '' : `to ${request.end_date}`}
                </p>
                <p className="text-gray-600 text-xs italic">Reason: {request.reason}</p> {/* Smaller font */}
                <p className="text-gray-600 text-xs">Status: <span className={`font-semibold ${request.status === 'approved' ? 'text-green-600' : request.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>{request.status}</span></p> {/* Smaller font */}
                {request.admin_comments && <p className="text-gray-600 text-xs">Admin Comments: {request.admin_comments}</p>} {/* Smaller font */}
                {request.approved_by_username && <p className="text-gray-600 text-xs">Approved By: {request.approved_by_username}</p>} {/* Smaller font */}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                {request.status === 'pending' && ( // Only show buttons if status is 'pending'
                  <>
                    <button
                      onClick={() => handleUpdateLeaveRequest(request.id, 'approved')}
                      className="px-3 py-1.5 bg-green-300 text-gray-800 rounded-lg hover:bg-green-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                      disabled={isLoading}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateLeaveRequest(request.id, 'rejected')}
                      className="px-3 py-1.5 bg-yellow-300 text-gray-800 rounded-lg hover:bg-yellow-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                      disabled={isLoading}
                    >
                      Reject
                    </button>
                  </>
                )}
                {/* Always show delete button, regardless of status */}
                <button
                  onClick={() => handleDeleteLeaveRequest(request.id)}
                  className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// Leave Request Component (User)
function LeaveRequest({ userId, openConfirmModal, onLeaveStatusChange }) { // Added onLeaveStatusChange prop
  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isHourly, setIsHourly] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  const fetchLeaveRequests = useCallback(async () => {
    console.log('[LeaveRequest] fetchLeaveRequests: Starting fetch for user', userId);
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/?user=${userId}`, { // Ensure user-specific fetch
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[LeaveRequest] fetchLeaveRequests: Data fetched successfully.', data);
        setLeaveRequests(data);
      } else {
        const errorData = await response.json();
        console.error('[LeaveRequest] fetchLeaveRequests: Failed to fetch.', response.status, errorData);
        setMessage(`Failed to fetch leave requests: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[LeaveRequest] fetchLeaveRequests: Network error.', error);
      setMessage('Network error while fetching leave requests.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId, authenticatedFetch]); // Added authenticatedFetch to dependencies

  useEffect(() => {
    console.log('[LeaveRequest] useEffect triggered. userId:', userId, 'onLeaveStatusChange count:', onLeaveStatusChange);
    if (userId) { // Only fetch if userId is available
      fetchLeaveRequests();
    }
  }, [userId, fetchLeaveRequests, onLeaveStatusChange]); // Added onLeaveStatusChange to trigger re-fetch on status change from admin

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!startDate || !reason.trim()) {
      setMessage('Please fill all required fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (isHourly) {
      if (!startTime || !endTime) {
        setMessage('Please enter both start and end times for hourly leave.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      if (new Date(`2000/01/01 ${startTime}`) >= new Date(`2000/01/01 ${endTime}`)) {
        setMessage('End time must be after start time for hourly leave.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      if (startDate !== endDate && endDate) {
          setMessage('For hourly leave, start date and end date must be the same, or end date should be empty.');
          setTimeout(() => setMessage(''), 3000);
          return;
      }
    } else {
        if (!endDate) {
            setMessage('Please enter an end date for full-day leave.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            setMessage('End date cannot be before start date for full-day leave.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
    }

    console.log('[LeaveRequest] handleSubmitLeave: Submitting new leave request.');
    setIsLoading(true);
    try {
      const payload = {
        user: userId, // ADDED: User ID for the leave request
        leave_type: leaveType,
        start_date: startDate,
        end_date: isHourly ? null : endDate, // Set end_date to null if it's hourly leave
        reason: reason,
        is_hourly: isHourly,
        start_time: isHourly ? startTime : null,
        end_time: isHourly ? endTime : null,
      };

      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('[LeaveRequest] handleSubmitLeave: Request submitted successfully.');
        setMessage('Leave request submitted successfully! Awaiting approval.');
        setLeaveType('sick');
        setStartDate('');
        setEndDate('');
        setReason('');
        setIsHourly(false);
        setStartTime('');
        setEndTime('');
        fetchLeaveRequests();
      } else {
        const errorData = await response.json();
        console.error('[LeaveRequest] handleSubmitLeave: Failed to submit.', response.status, errorData);
        setMessage(`Failed to submit leave request: ${errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[LeaveRequest] handleSubmitLeave: Network error.', error);
      setMessage('An error occurred during submission. Please check your network.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleEditLeaveRequest = (request) => {
    console.log('[LeaveRequest] handleEditLeaveRequest: Editing request', request.id);
    setEditingRequest(request);
    setLeaveType(request.leave_type);
    setStartDate(request.start_date);
    setEndDate(request.end_date || '');
    setReason(request.reason);
    setIsHourly(request.is_hourly);
    setStartTime(request.start_time || '');
    setEndTime(request.end_time || '');
  };

  const handleUpdateLeaveRequest = async (e) => {
    e.preventDefault();
    if (!startDate || !reason.trim()) {
      setMessage('Please fill all required fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (isHourly) {
      if (!startTime || !endTime) {
        setMessage('Please enter both start and end times for hourly leave.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      if (new Date(`2000/01/01 ${startTime}`) >= new Date(`2000/01/01 ${endTime}`)) {
        setMessage('End time must be after start time for hourly leave.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      if (startDate !== endDate && endDate) {
          setMessage('For hourly leave, start date and end date must be the same, or end date should be empty.');
          setTimeout(() => setMessage(''), 3000);
          return;
      }
    } else {
        if (!endDate) {
            setMessage('Please enter an end date for full-day leave.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            setMessage('End date cannot be before start date for full-day leave.');
            setTimeout(() => setMessage(''), 3000);
            return;
            }
    }

    console.log('[LeaveRequest] handleUpdateLeaveRequest: Updating request', editingRequest.id);
    setIsLoading(true);
    try {
      const payload = {
        user: userId, // ADDED: User ID for the leave request
        leave_type: leaveType,
        start_date: startDate,
        end_date: isHourly ? null : endDate, // Set end_date to null if it's hourly leave
        reason: reason,
        is_hourly: isHourly,
        start_time: isHourly ? startTime : null,
        end_time: isHourly ? endTime : null,
      };

      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${editingRequest.id}/`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('[LeaveRequest] handleUpdateLeaveRequest: Request updated successfully.');
        setMessage('Leave request updated successfully!');
        setEditingRequest(null);
        setLeaveType('sick');
        setStartDate('');
        setEndDate('');
        setReason('');
        setIsHourly(false);
        setStartTime('');
        setEndTime('');
        fetchLeaveRequests();
      } else {
        const errorData = await response.json();
        console.error('[LeaveRequest] handleUpdateLeaveRequest: Failed to update.', response.status, errorData);
        setMessage(`Failed to update leave request: ${errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[LeaveRequest] handleUpdateLeaveRequest: Network error.', error);
      setMessage('Network error while updating leave request.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteLeaveRequest = (requestId) => {
    openConfirmModal('Are you sure you want to delete this leave request? This action cannot be undone.', async () => {
      console.log('[LeaveRequest] handleDeleteLeaveRequest: Deleting request', requestId);
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${requestId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          console.log('[LeaveRequest] handleDeleteLeaveRequest: Request deleted successfully.');
          setMessage('Leave request deleted successfully!');
          fetchLeaveRequests();
        } else {
          const errorData = await response.json();
          console.error('[LeaveRequest] handleDeleteLeaveRequest: Failed to delete.', response.status, errorData);
          setMessage(`Failed to delete leave request: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('[LeaveRequest] handleDeleteLeaveRequest: Network error.', error);
        setMessage('Network error while deleting leave request.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Request Time Off</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-pink-100 border border-pink-400 text-pink-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <form onSubmit={editingRequest ? handleUpdateLeaveRequest : handleSubmitLeave} className="mb-6 bg-pink-50 p-6 rounded-lg shadow-sm border border-pink-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">{editingRequest ? 'Edit Leave Request' : 'New Leave Request'}</h4>

        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="isHourly"
            className="mr-2 h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
            checked={isHourly}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsHourly(checked);
              if (!checked) {
                setStartTime('');
                setEndTime('');
                if (startDate && startDate === endDate) {
                    setEndDate('');
                }
              } else {
                if (startDate) {
                    setEndDate(startDate);
                }
                if (!startTime) setStartTime('09:00');
                if (!endTime) setEndTime('17:00');
              }
            }}
            disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
          />
          <label htmlFor="isHourly" className="text-gray-700 text-sm font-bold">
            Hourly Leave
          </label>
        </div>

        <div className="mb-4">
          <label htmlFor="leaveType" className="block text-gray-700 text-sm font-bold mb-2">
            Leave Type
          </label>
          <select
            id="leaveType"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200" // Smaller padding, lighter ring
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            required
            disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
          >
            <option value="sick">Sick Leave</option>
            <option value="vacation">Vacation</option>
            <option value="personal">Personal Leave</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="startDate" className="block text-gray-700 text-sm font-bold mb-2">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200" // Smaller padding, lighter ring
            value={startDate}
            onChange={(e) => {
                setStartDate(e.target.value);
                if (isHourly) {
                    setEndDate(e.target.value);
                }
            }}
            required
            disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
          />
        </div>

        {!isHourly && (
          <div className="mb-4">
            <label htmlFor="endDate" className="block text-gray-700 text-sm font-bold mb-2">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200" // Smaller padding, lighter ring
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required={!isHourly}
              disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
            />
          </div>
        )}

        {isHourly && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="startTime" className="block text-gray-700 text-sm font-bold mb-2">
                Start Time
              </label>
              <input
                type="time"
                id="startTime"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200" // Smaller padding, lighter ring
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required={isHourly}
                disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
              />
            </div>
            <div>
              <label htmlFor="endTime" className="block text-gray-700 text-sm font-bold mb-2">
                End Time
              </label>
              <input
                type="time"
                id="endTime"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200" // Smaller padding, lighter ring
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required={isHourly}
                disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="reason" className="block text-gray-700 text-sm font-bold mb-2">
            Reason
          </label>
          <textarea
            id="reason"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200" // Smaller padding, lighter ring
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief reason for your leave"
            rows="3"
            required
            disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
          ></textarea>
        </div>
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-pink-300 hover:bg-pink-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
            disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
          >
            {isLoading ? (editingRequest ? 'Updating...' : 'Submitting...') : (editingRequest ? 'Update Request' : 'Submit Request')}
          </button>
          {editingRequest && (
            <button
              type="button"
              onClick={() => { setEditingRequest(null); setLeaveType('sick'); setStartDate(''); setEndDate(''); setReason(''); setIsHourly(false); setStartTime(''); setEndTime(''); }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
              disabled={isLoading}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Your Leave Requests</h4>
      {isLoading && leaveRequests.length === 0 ? (
        <p className="text-gray-500">Loading your time entries...</p>
      ) : leaveRequests.length === 0 ? (
        <p className="text-gray-500">No leave requests submitted yet. Submit one above!</p>
      ) : (
        <ul className="space-y-3"> {/* Slightly reduced spacing */}
          {leaveRequests.map((request) => (
            <li key={request.id} className="bg-pink-50 p-3 rounded-lg shadow-sm border border-pink-100 flex flex-col sm:flex-row justify-between items-start sm:items-center"> {/* Smaller padding */}
              <div className="mb-1 sm:mb-0"> {/* Smaller margin */}
                <p className="font-semibold text-base text-pink-800">
                    {request.leave_type}
                    {request.is_hourly && ` (${request.start_time} - ${request.end_time})`}
                </p>
                <p className="text-gray-600 text-xs"> {/* Smaller font */}
                  {request.start_date} {request.is_hourly ? '' : `to ${request.end_date}`}
                </p>
                <p className="text-gray-600 text-xs italic">Reason: {request.reason}</p> {/* Smaller font */}
                <p className="text-gray-600 text-xs">Status:
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${ // Smaller padding for status tag
                      request.status === 'approved' ? 'bg-green-200 text-green-800' :
                      request.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-red-200 text-red-800'
                    }`}
                  >
                    {request.status}
                  </span>
                </p>
                {request.admin_comments && <p className="text-gray-600 text-xs">Admin Comments: {request.admin_comments}</p>} {/* Smaller font */}
                {request.approved_by_username && <p className="text-gray-600 text-xs">Approved By: {request.approved_by_username}</p>} {/* Smaller font */}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                {request.status === 'pending' && (
                  <button
                    onClick={() => handleEditLeaveRequest(request)}
                    className="px-3 py-1.5 bg-yellow-300 text-gray-800 rounded-lg hover:bg-yellow-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDeleteLeaveRequest(request.id)}
                  className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// NEW COMPONENT: UserTaskManagement
function UserTaskManagement({ userId, openConfirmModal, viewTaskDetails, onMyTasksViewed }) { // Added onMyTasksViewed prop
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]); // All users (to filter admins for reporting manager)
  const [adminUsers, setAdminUsers] = useState([]); // Only admin users for reporting manager
  const [userTasks, setUserTasks] = useState([]); // Tasks assigned to this user (for parent task dropdown)
  const [selectedProject, setSelectedProject] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [reportingManager, setReportingManager] = useState(''); // NEW STATE: Reporting Manager
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchUserProjectsAndTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all projects (user can create tasks under any project)
      const projectsResponse = await authenticatedFetch(`${API_BASE_URL}/projects/`, { method: 'GET' });
      if (projectsResponse.ok) {
        setProjects(await projectsResponse.json());
      } else {
        setMessage(`Failed to fetch projects: ${projectsResponse.statusText}`);
      }

      // Fetch all users to filter for admins
      const usersResponse = await authenticatedFetch(`${API_BASE_URL}/users/`, { method: 'GET' });
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsers(data); // Store all users
        const staffUsers = data.filter(user => user.is_staff); // Filter for admin users
        setAdminUsers(staffUsers);
        // Set first admin user as default reporting manager if available
        if (staffUsers.length > 0) setReportingManager(staffUsers[0].id);
      } else {
        setMessage(`Failed to fetch users: ${usersResponse.statusText}`);
      }

      // Fetch tasks assigned to the current user
      const tasksResponse = await authenticatedFetch(`${API_BASE_URL}/tasks/?assigned_to=${userId}`, { method: 'GET' });
      if (tasksResponse.ok) {
        setUserTasks(await tasksResponse.json());
        onMyTasksViewed(userId); // Mark tasks as viewed when this component loads
      } else {
        setMessage(`Failed to fetch user tasks: ${tasksResponse.statusText}`);
      }

    } catch (error) {
      console.error('Error fetching user projects and tasks:', error);
      setMessage('Network error while fetching data.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId, authenticatedFetch, onMyTasksViewed]); // Added onMyTasksViewed to dependencies

  useEffect(() => {
    if (userId) { // Only fetch if userId is available
      fetchUserProjectsAndTasks();
    }
  }, [userId, fetchUserProjectsAndTasks]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedProject) {
      setMessage('Please select a project and enter a task name.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const payload = {
        project: selectedProject,
        name: newTaskName,
        description: newTaskDescription,
        assigned_to: userId, // Automatically assign to the current user
        due_date: newTaskDueDate || null,
        parent_task: null, // Always null as parent task is removed
        status: 'pending', // Default status for user-created tasks
        progress: 0, // Default progress
        reporting_manager: reportingManager || null, // Include reporting manager
      };

      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setMessage('Task created successfully!');
        setNewTaskName('');
        setNewTaskDescription('');
        setNewTaskDueDate('');
        setSelectedProject(''); // Optionally reset project too
        setReportingManager(adminUsers.length > 0 ? adminUsers[0].id : ''); // Reset reporting manager
        fetchUserProjectsAndTasks(); // Re-fetch to update the task list
      } else {
        const errorData = await response.json();
        setMessage(`Failed to create task: ${errorData.name || errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setMessage('Network error while creating task.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const getUserName = (userId) => users.find(u => u.id === userId)?.username || 'N/A';

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">My Tasks</h3>
      <p className="text-gray-600 mb-4">
        Here you can create new tasks for yourself. Click on an existing task below to view its details and log hourly time.
      </p>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-indigo-100 border border-indigo-400 text-indigo-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <form onSubmit={handleCreateTask} className="mb-6 bg-indigo-50 p-6 rounded-lg shadow-sm border border-indigo-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">New Task Details</h4>

        <div className="mb-4">
          <label htmlFor="selectProjectUser" className="block text-gray-700 text-sm font-bold mb-2">
            Select Project
          </label>
          <select
            id="selectProjectUser"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-200" // Smaller padding, lighter ring
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
            }}
            required
            disabled={isLoading || projects.length === 0}
          >
            <option value="">Select a Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {projects.length === 0 && <p className="text-sm text-gray-500 mt-1">No projects available. Admin needs to create projects first.</p>}
        </div>

        <div className="mb-4">
          <label htmlFor="newTaskNameUser" className="block text-gray-700 text-sm font-bold mb-2">
            Task Name
          </label>
          <input
            type="text"
            id="newTaskNameUser"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-200" // Smaller padding, lighter ring
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="e.g., Develop user authentication"
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="newTaskDescriptionUser" className="block text-gray-700 text-sm font-bold mb-2">
            Description
          </label>
          <textarea
            id="newTaskDescriptionUser"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-200" // Smaller padding, lighter ring
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Detailed description of your task"
            rows="3"
            disabled={isLoading}
          ></textarea>
        </div>
        <div className="mb-4">
          <label htmlFor="newTaskDueDateUser" className="block text-gray-700 text-sm font-bold mb-2">
            Due Date (Optional)
          </label>
          <input
            type="date"
            id="newTaskDueDateUser"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-200" // Smaller padding, lighter ring
            value={newTaskDueDate}
            onChange={(e) => setNewTaskDueDate(e.target.value)}
            disabled={isLoading}
          />
        </div>
        {/* NEW FIELD: Reporting Manager - Now only shows admin users */}
        <div className="mb-4">
          <label htmlFor="reportingManagerUser" className="block text-gray-700 text-sm font-bold mb-2">
            Reporting Manager
          </label> {/* SHORTENED LABEL */}
          <select
            id="reportingManagerUser"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-200" // Smaller padding, lighter ring
            value={reportingManager}
            onChange={(e) => setReportingManager(e.target.value)}
            disabled={isLoading || adminUsers.length === 0}
          >
            <option value="">None</option>
            {adminUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
          {adminUsers.length === 0 && <p className="text-sm text-gray-500 mt-1">No admin users available to be reporting managers.</p>}
        </div>
        {/* END NEW FIELD */}
        <button
          type="submit"
          className="bg-indigo-300 hover:bg-indigo-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
          disabled={isLoading || !selectedProject || !newTaskName.trim()}
        >
          {isLoading ? 'Creating...' : 'Create My Task'}
        </button>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">My Assigned Tasks</h4>
      {isLoading && userTasks.length === 0 ? (
        <p className="text-gray-500">Loading tasks...</p>
      ) : userTasks.length === 0 ? (
        <p className="text-gray-500">No tasks assigned to you yet. Create one above or ask your admin to assign one!</p>
      ) : (
        <ul className="space-y-3"> {/* Slightly reduced spacing */}
          {userTasks.map(task => (
            <li
              key={task.id}
              className={`bg-indigo-100 p-3 rounded-lg shadow-sm border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-indigo-200`} // Smaller padding
              onClick={() => viewTaskDetails(task.id)} // Make task clickable
            >
              <div className="mb-1 sm:mb-0"> {/* Smaller margin */}
                <p className="font-semibold text-sm text-indigo-800"> {/* Made task name smaller */}
                  {task.name} (Project: {task.project_name})
                </p>
                {/* Removed task.description display from list item */}
                <p className="text-gray-600 text-xs">Due Date: {task.due_date || 'N/A'}</p> {/* Smaller font */}
                <p className="text-gray-600 text-xs">Reporting Manager: {getUserName(task.reporting_manager)}</p> {/* Smaller font */}
                <p className="text-gray-600 text-xs">Status: <span className={`font-semibold ${task.status === 'completed' ? 'text-green-600' : task.status === 'in_progress' ? 'text-blue-600' : 'text-yellow-600'}`}>{task.status}</span></p> {/* Smaller font */}
                <p className="text-gray-600 text-xs">Progress: {task.progress}%</p> {/* Smaller font */}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// NEW COMPONENT: UserHourlyTimeEntry (for User Dashboard)
function UserHourlyTimeEntry({ userId, openConfirmModal }) {
  const [tasks, setTasks] = useState([]); // Tasks assigned to this user
  const [timeEntries, setTimeEntries] = useState([]); // User's own time entries
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [selectedTask, setSelectedTask] = useState('');
  const [logDate, setLogDate] = useState(formatDate(new Date())); // Default to today
  const [startTime, setStartTime] = useState('09:00'); // New state for start time
  const [endTime, setEndTime] = useState('17:00');   // New state for end time
  const [description, setDescription] = useState('');

  const fetchUserTimeEntriesAndTasks = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const [tasksResponse, timeEntriesResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/tasks/?assigned_to=${userId}`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/task-time-entries/?user_id=${userId}`, { method: 'GET' }),
      ]);

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData);
        // Set default selected task if available and no task is already selected
        if (tasksData.length > 0 && !selectedTask) {
          setSelectedTask(tasksData[0].id);
        }
      } else {
        setMessage(`Failed to fetch tasks: ${tasksResponse.statusText}`);
      }

      if (timeEntriesResponse.ok) {
        setTimeEntries(await timeEntriesResponse.json());
      } else {
        setMessage(`Failed to fetch time entries: ${timeEntriesResponse.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching user hourly data:', error);
      setMessage('Network error while fetching hourly data.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId, selectedTask, authenticatedFetch]); // Added authenticatedFetch to dependencies

  useEffect(() => {
    if (userId) {
      fetchUserTimeEntriesAndTasks();
    }
  }, [userId, fetchUserTimeEntriesAndTasks]);

  const handleTimeEntrySubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!selectedTask || !logDate || !startTime || !endTime || !description.trim()) {
      setMessage('Please fill all required fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validate that end time is after start time for the same day
    const startDateTime = moment(`${logDate} ${startTime}`);
    const endDateTime = moment(`${logDate} ${endTime}`);

    if (endDateTime.isSameOrBefore(startDateTime)) {
        setMessage('End time must be after start time.');
        setTimeout(() => setMessage(''), 5000);
        return;
    }

    // Calculate duration in hours for frontend validation
    const duration = moment.duration(endDateTime.diff(startDateTime));
    const hours = duration.asHours();

    if (hours > 12) {
        setMessage('Logged time cannot exceed 12 hours.');
        setTimeout(() => setMessage(''), 5000);
        return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/task-time-entries/`, {
        method: 'POST',
        body: JSON.stringify({
          task: selectedTask,
          start_time: startDateTime.toISOString(), // Use ISO string for backend
          end_time: endDateTime.toISOString(),     // Use ISO string for backend
          description: description,
          user: userId, // Ensure user is explicitly sent, though backend sets it
        }),
      });

      if (response.ok) {
        setMessage('Hourly time entry added successfully!');
        // Clear form, but keep selectedTask and logDate for convenience
        setStartTime('09:00'); // Reset to default for next entry
        setEndTime('17:00');   // Reset to default for next entry
        setDescription('');
        fetchUserTimeEntriesAndTasks(); // Re-fetch to update the list
      } else {
        const errorData = await response.json();
        setMessage(`Failed to add time entry: ${errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding time entry:', error);
      setMessage('Network error while adding time entry.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteTimeEntry = (entryId) => {
    openConfirmModal('Are you sure you want to delete this hourly time entry? This action cannot be undone.', async () => {
      setIsLoading(true);
      setMessage('');
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/task-time-entries/${entryId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage('Time entry deleted successfully!');
          fetchUserTimeEntriesAndTasks(); // Re-fetch
        } else {
          const errorData = await response.json();
          setMessage(`Failed to delete entry: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting time entry:', error);
        setMessage('Network error while deleting time entry.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Log Hourly Time</h3>
      <p className="text-gray-600 mb-4">
        Log your time in hours against specific tasks. You can log a maximum of 12 hours per entry.
      </p>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-purple-100 border border-purple-400 text-purple-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      <form onSubmit={handleTimeEntrySubmit} className="mb-6 bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">New Hourly Entry</h4>
        <div className="mb-4">
          <label htmlFor="selectTaskHourly" className="block text-gray-700 text-sm font-bold mb-2">
            Select Task
          </label>
          <select
            id="selectTaskHourly"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            required
            disabled={isLoading || tasks.length === 0}
          >
            {tasks.length === 0 ? (
              <option value="">No tasks assigned to you</option>
            ) : (
              tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} (Project: {task.project_name})
                </option>
              ))
            )}
          </select>
          {tasks.length === 0 && <p className="text-sm text-gray-500 mt-1">You don't have any tasks assigned. Please create one in "My Tasks" or ask your admin to assign one.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4"> {/* Changed to 3 columns */}
          <div>
            <label htmlFor="logDate" className="block text-gray-700 text-sm font-bold mb-2">
              Date
            </label>
            <input
              type="date"
              id="logDate"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="logStartTime" className="block text-gray-700 text-sm font-bold mb-2">
                Start Time
            </label>
            <input
                type="time"
                id="logStartTime"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="logEndTime" className="block text-gray-700 text-sm font-bold mb-2">
                End Time
            </label>
            <input
                type="time"
                id="logEndTime"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={isLoading}
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="hourlyDescription" className="block text-gray-700 text-sm font-bold mb-2">
            Description of Work
          </label>
          <textarea
            id="hourlyDescription"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200" // Smaller padding, lighter ring
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Coded login functionality, Reviewed PR, Attended meeting"
            rows="3"
            required
            disabled={isLoading}
          ></textarea>
        </div>
        <button
          type="submit"
          className="bg-purple-300 hover:bg-purple-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
          disabled={isLoading || tasks.length === 0}
        >
          {isLoading ? 'Adding...' : 'Add Time Entry'}
        </button>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Your Hourly Time Entries</h4>
      {isLoading && timeEntries.length === 0 ? (
        <p className="text-gray-500">Loading your time entries...</p>
      ) : timeEntries.length === 0 ? (
        <p className="text-gray-500">No hourly time entries logged yet. Log one above!</p>
      ) : (
        <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
          <table className="w-full text-sm text-left text-gray-500 light-table-style">
            <thead className="text-xs text-gray-700 uppercase bg-gray-200 light-table-header">
              <tr>
                <th scope="col" className="py-2 px-4">Task</th> {/* Smaller padding */}
                <th scope="col" className="py-2 px-4">Date</th> {/* Smaller padding */}
                <th scope="col" className="py-2 px-4">Start Time</th> {/* Smaller padding */}
                <th scope="col" className="py-2 px-4">End Time</th> {/* Smaller padding */}
                <th scope="col" className="py-2 px-4">Duration</th> {/* Smaller padding */}
                <th scope="col" className="py-2 px-4">Description</th> {/* Smaller padding */}
                <th scope="col" className="py-2 px-4">Actions</th> {/* Smaller padding */}
              </tr>
            </thead>
            <tbody>
              {timeEntries.sort((a, b) => moment(b.start_time).valueOf() - moment(a.start_time).valueOf()).map(entry => (
                <tr key={entry.id} className="bg-white border-b hover:bg-gray-50 light-table-row">
                  <td className="py-3 px-4">{entry.task_name}</td> {/* Smaller padding */}
                  <td className="py-3 px-4">{moment(entry.start_time).format('YYYY-MM-DD')}</td> {/* Smaller padding */}
                  <td className="py-3 px-4">{moment(entry.start_time).format('HH:mm')}</td> {/* Smaller padding */}
                  <td className="py-3 px-4">{moment(entry.end_time).format('HH:mm')}</td> {/* Smaller padding */}
                  <td className="py-3 px-4 font-bold">{formatHoursToMinutes(entry.duration_hours)}</td> {/* Smaller padding */}
                  <td className="py-3 px-4">{entry.description}</td> {/* Smaller padding */}
                  <td className="py-3 px-4"> {/* Smaller padding */}
                    <button
                      onClick={() => handleDeleteTimeEntry(entry.id)}
                      className="px-2.5 py-1 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                      disabled={isLoading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// NEW COMPONENT: HourlyUpdatesReport (for Admin Dashboard) - Now only shows current day
function HourlyUpdatesReport({ userId }) {
  const [timeEntries, setTimeEntries] = useState([]);
  const [users, setUsers] = useState([]); // All users
  const [nonAdminUsers, setNonAdminUsers] = useState([]); // Only non-admin users for filter
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Default date filter to TODAY's date, not changeable by user in this view
  const fixedDateFilter = formatDate(new Date());

  // Filter states for user, project, task (these are kept)
  const [selectedUserFilter, setSelectedUserFilter] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState('');


  const fetchHourlyUpdates = useCallback(async () => {
    setIsLoading(true);
    setMessage('');

    try {
      let url = `${API_BASE_URL}/task-time-entries/`;
      const queryParams = [];

      // Always apply the fixed date filter for today
      queryParams.push(`start_time__gte=${fixedDateFilter}T00:00:00`);
      queryParams.push(`end_time__lte=${fixedDateFilter}T23:59:59`);

      // Apply other filters if selected
      if (selectedUserFilter) queryParams.push(`user_id=${selectedUserFilter}`);
      if (selectedProjectFilter) queryParams.push(`project_id=${selectedProjectFilter}`);
      if (selectedTaskFilter) queryParams.push(`task_id=${selectedTaskFilter}`);
      
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const [timeEntriesResponse, usersResponse, tasksResponse, projectsResponse] = await Promise.all([
        authenticatedFetch(url, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/users/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/tasks/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/projects/`, { method: 'GET' }),
      ]);

      if (timeEntriesResponse.ok) {
        setTimeEntries(await timeEntriesResponse.json());
      } else {
        setMessage(`Failed to fetch hourly updates: ${timeEntriesResponse.statusText}`);
      }
      if (usersResponse.ok) {
        const fetchedUsers = await usersResponse.json();
        setUsers(fetchedUsers);
        setNonAdminUsers(fetchedUsers.filter(user => !user.is_staff));
      } else {
        setMessage(`Failed to fetch users: ${usersResponse.statusText}`);
      }
      if (tasksResponse.ok) {
        setTasks(await tasksResponse.json());
      } else {
        setMessage(`Failed to fetch tasks: ${tasksResponse.statusText}`);
      }
      if (projectsResponse.ok) {
        setProjects(await projectsResponse.json());
      } else {
        setMessage(`Failed to fetch projects: ${projectsResponse.statusText}`);
      }

    } catch (error) {
      console.error('Error fetching hourly updates:', error);
      setMessage('Network error while fetching hourly updates.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [fixedDateFilter, selectedUserFilter, selectedProjectFilter, selectedTaskFilter, authenticatedFetch]);


  useEffect(() => {
    if (userId) {
        fetchHourlyUpdates();
    }
  }, [userId, fetchHourlyUpdates]);

  const getTaskName = (taskId) => tasks.find(t => t.id === taskId)?.name || `Task ${taskId}`;
  const getUserName = (userId) => users.find(u => u.id === userId)?.username || `User ${userId}`;
  const getProjectName = (projectId) => projects.find(p => p.id === projectId)?.name || `Project ${projectId}`;

  const filteredTasksForDropdown = useCallback(() => {
    if (!selectedProjectFilter) {
      return tasks;
    }
    return tasks.filter(task => task.project === parseInt(selectedProjectFilter));
  }, [tasks, selectedProjectFilter]);

  // Group time entries by user
  const groupedTimeEntries = timeEntries.reduce((acc, entry) => {
    const userId = entry.user;
    if (!acc[userId]) {
      acc[userId] = {
        user_id: userId,
        user_username: getUserName(userId),
        entries: [],
        total_hours: 0,
      };
    }
    acc[userId].entries.push(entry);
    acc[userId].total_hours += entry.duration_hours;
    return acc;
  }, {});

  const sortedUsers = Object.values(groupedTimeEntries).sort((a, b) =>
    a.user_username.localeCompare(b.user_username)
  );


  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Daily Hourly Updates (Admin View)</h3>
      <p className="text-gray-600 mb-4">
        Viewing hourly time entries logged by users for today: <span className="font-bold">{moment(fixedDateFilter).format('MMM DD, YYYY')}</span>
      </p>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      {/* Filter Section - Restored and updated */}
      <div className="mb-6 bg-teal-50 p-6 rounded-lg shadow-xl border border-teal-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="userFilter" className="block text-gray-700 text-sm font-bold mb-2">Filter by User:</label>
          <select
            id="userFilter"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white text-gray-800" // Smaller padding, lighter ring
            value={selectedUserFilter}
            onChange={(e) => setSelectedUserFilter(e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Users</option>
            {nonAdminUsers.map(user => ( // Filtered to show only non-admin users
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="projectFilter" className="block text-gray-700 text-sm font-bold mb-2">Filter by Project:</label>
          <select
            id="projectFilter"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white text-gray-800" // Smaller padding, lighter ring
            value={selectedProjectFilter}
            onChange={(e) => {
                setSelectedProjectFilter(e.target.value);
                setSelectedTaskFilter(''); // Reset task filter when project changes
            }}
            disabled={isLoading}
          >
            <option value="">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="taskFilter" className="block text-gray-700 text-sm font-bold mb-2">Filter by Task:</label>
          <select
            id="taskFilter"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white text-gray-800" // Smaller padding, lighter ring
            value={selectedTaskFilter}
            onChange={(e) => setSelectedTaskFilter(e.target.value)}
            disabled={isLoading || filteredTasksForDropdown().length === 0}
          >
            <option value="">All Tasks</option>
            {filteredTasksForDropdown().map(task => (
              <option key={task.id} value={task.id}>{task.name}</option>
            ))}
          </select>
        </div>
        {/* The date input is intentionally removed as per your request to only show current day */}
        <div className="md:col-span-2 lg:col-span-1 flex items-end justify-end">
          <button
            onClick={() => {
              setSelectedUserFilter('');
              setSelectedProjectFilter('');
              setSelectedTaskFilter('');
              // fixedDateFilter remains unchanged
            }}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-300 shadow-sm w-full text-sm" // Lighter, smaller, less shadow
            disabled={isLoading}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {isLoading && timeEntries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Loading today's hourly updates...</p>
      ) : sortedUsers.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No hourly time entries found for today ({moment(fixedDateFilter).format('MMM DD, YYYY')}).</p>
      ) : (
        <div className="space-y-8"> {/* Container for separate tables */}
          {sortedUsers.map(userGroup => (
            <div key={userGroup.user_id} className="bg-gradient-to-br from-teal-50 to-amber-50 rounded-xl shadow-2xl border border-teal-200 p-6 transform hover:scale-[1.01] transition duration-300 ease-in-out">
              <h4 className="text-2xl font-extrabold text-amber-800 mb-4 flex items-center">
                <svg className="w-7 h-7 mr-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                {userGroup.user_username}
                <span className="ml-auto px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-sm"> {/* Smaller padding, smaller font, less shadow */}
                  Total Logged: {formatHoursToMinutes(userGroup.total_hours)}
                </span>
              </h4>
              <div className="overflow-x-auto rounded-lg border border-amber-300">
                <table className="w-full text-sm text-left text-gray-700">
                  <thead className="text-xs text-amber-700 uppercase bg-amber-200">
                    <tr>
                      <th scope="col" className="py-2 px-4">Project</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Task</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Start Time</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">End Time</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Duration</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Description</th> {/* Smaller padding */}
                    </tr>
                  </thead>
                  <tbody>
                    {userGroup.entries.sort((a, b) => moment(b.start_time).valueOf() - moment(a.start_time).valueOf()).map(entry => (
                      <tr key={entry.id} className="bg-white border-b border-amber-100 hover:bg-amber-50 transition duration-150">
                        <td className="py-3 px-4 font-medium text-amber-800">{getProjectName(tasks.find(t => t.id === entry.task)?.project)}</td> {/* Smaller padding */}
                        <td className="py-3 px-4">{getTaskName(entry.task)}</td> {/* Smaller padding */}
                        {/* Removed date column as it's implied by the "Today" view */}
                        <td className="py-3 px-4">{moment(entry.start_time).format('HH:mm')}</td> {/* Smaller padding */}
                        <td className="py-3 px-4">{moment(entry.end_time).format('HH:mm')}</td> {/* Smaller padding */}
                        <td className="py-3 px-4 font-bold text-teal-600">{formatHoursToMinutes(entry.duration_hours)}</td> {/* Smaller padding */}
                        <td className="py-3 px-4 text-gray-600">{entry.description}</td> {/* Smaller padding */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// NEW COMPONENT: WorkdayTimesheetView (for Admin Dashboard)
function WorkdayTimesheetView({ userId }) {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date())); // Default to today
  const [timeEntries, setTimeEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchTimesheetsForDate = useCallback(async (dateToFetch) => {
    setIsLoading(true);
    setMessage('');
    try {
      // Construct URL to filter strictly by the selected date
      const url = `${API_BASE_URL}/task-time-entries/?start_time__gte=${dateToFetch}T00:00:00&end_time__lte=${dateToFetch}T23:59:59`;
      console.log(`[WorkdayTimesheetView] Fetching URL: ${url}`); // Debugging: Log the URL

      const [timeEntriesResponse, usersResponse, tasksResponse, projectsResponse] = await Promise.all([
        authenticatedFetch(url, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/users/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/tasks/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/projects/`, { method: 'GET' }),
      ]);

      if (timeEntriesResponse.ok) {
        const data = await timeEntriesResponse.json();
        console.log(`[WorkdayTimesheetView] Fetched time entries for ${dateToFetch}:`, data); // Debugging: Log fetched data
        setTimeEntries(data);
      } else {
        setMessage(`Failed to fetch time entries: ${timeEntriesResponse.statusText}`);
      }
      if (usersResponse.ok) {
        setUsers(await usersResponse.json());
      } else {
        setMessage(`Failed to fetch users: ${usersResponse.statusText}`);
      }
      if (tasksResponse.ok) {
        setTasks(await tasksResponse.json());
      } else {
        setMessage(`Failed to fetch tasks: ${tasksResponse.statusText}`);
      }
      if (projectsResponse.ok) {
        setProjects(await projectsResponse.json());
      } else {
        setMessage(`Failed to fetch projects: ${projectsResponse.statusText}`);
      }

    } catch (error) {
      console.error('Error fetching timesheets for date:', error);
      setMessage('Network error while fetching timesheets.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [authenticatedFetch]); // Added authenticatedFetch to dependencies

  useEffect(() => {
    if (userId && selectedDate) {
      fetchTimesheetsForDate(selectedDate);
    }
  }, [userId, selectedDate, fetchTimesheetsForDate]);

  const getTaskName = (taskId) => tasks.find(t => t.id === taskId)?.name || `Task ${taskId}`;
  const getUserName = (userId) => users.find(u => u.id === userId)?.username || `User ${userId}`;
  const getProjectName = (projectId) => projects.find(p => p.id === projectId)?.name || `Project ${projectId}`;

  const workdays = getWeekDates(new Date(), false); // Get Mon-Sat for current week

  // Group time entries by user
  const groupedTimeEntries = timeEntries.reduce((acc, entry) => {
    const userId = entry.user;
    if (!acc[userId]) {
      acc[userId] = {
        user_id: userId,
        user_username: getUserName(userId),
        entries: [],
        total_hours: 0,
      };
    }
    acc[userId].entries.push(entry);
    acc[userId].total_hours += entry.duration_hours;
    return acc;
  }, {});

  const sortedUsers = Object.values(groupedTimeEntries).sort((a, b) =>
    a.user_username.localeCompare(b.user_username)
  );

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Workday Timesheets (Admin View)</h3>
      <p className="text-gray-600 mb-4">Select a workday to view all users' hourly timesheets for that day.</p>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-blue-100 border border-blue-400 text-blue-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      <div className="mb-6 bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-100">
        <h4 className="text-xl font-medium text-gray-700 mb-3">Select Workday:</h4>
        <div className="flex flex-wrap gap-3">
          {workdays.map((day) => (
            <button
              key={formatDate(day)}
              onClick={() => setSelectedDate(formatDate(day))}
              className={`px-4 py-2 rounded-lg font-semibold transition duration-300 shadow-sm text-sm ${ // Smaller, less shadow
                formatDate(day) === selectedDate
                  ? 'bg-blue-400 text-white transform scale-105' // Slightly lighter active
                  : 'bg-blue-200 text-blue-800 hover:bg-blue-300' // Lighter, lighter hover
              }`}
              disabled={isLoading}
            >
              {getDayName(day)}, {moment(day).format('MMM DD')}
            </button>
          ))}
        </div>
        {/* REMOVED THE LINE THAT WAS CAUSING CONFUSION */}
        {/* <p className="mt-4 text-gray-600 text-sm">Viewing timesheets for: <span className="font-bold">{moment(selectedDate).format('dddd, MMMM DD, YYYY')}</span></p> */}
      </div>

      {isLoading && timeEntries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Loading timesheets for {moment(selectedDate).format('MMM DD, YYYY')}...</p>
      ) : sortedUsers.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No hourly time entries found for {moment(selectedDate).format('MMM DD, YYYY')}.</p>
      ) : (
        <div className="space-y-8">
          {sortedUsers.map(userGroup => (
            <div key={userGroup.user_id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-2xl border border-blue-200 p-6 transform hover:scale-[1.01] transition duration-300 ease-in-out">
              <h4 className="text-2xl font-extrabold text-indigo-800 mb-4 flex items-center">
                <svg className="w-7 h-7 mr-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                {userGroup.user_username}
                <span className="ml-auto px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded-full shadow-sm"> {/* Smaller padding, smaller font, less shadow */}
                  Total Logged: {formatHoursToMinutes(userGroup.total_hours)}
                </span>
              </h4>
              <div className="overflow-x-auto rounded-lg border border-indigo-300">
                <table className="w-full text-sm text-left text-gray-700">
                  <thead className="text-xs text-indigo-700 uppercase bg-indigo-200">
                    <tr>
                      <th scope="col" className="py-2 px-4">Project</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Task</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Date</th> {/* Added Date column, smaller padding */}
                      <th scope="col" className="py-2 px-4">Start Time</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">End Time</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Duration</th> {/* Smaller padding */}
                      <th scope="col" className="py-2 px-4">Description</th> {/* Smaller padding */}
                    </tr>
                  </thead>
                  <tbody>
                    {userGroup.entries.sort((a, b) => moment(a.start_time).valueOf() - moment(b.start_time).valueOf()).map(entry => (
                      <tr key={entry.id} className="bg-white border-b border-indigo-100 hover:bg-indigo-50 transition duration-150">
                        <td className="py-3 px-4 font-medium text-indigo-800">{getProjectName(tasks.find(t => t.id === entry.task)?.project)}</td> {/* Smaller padding */}
                        <td className="py-3 px-4">{getTaskName(entry.task)}</td> {/* Smaller padding */}
                        <td className="py-3 px-4">{moment(entry.start_time).format('YYYY-MM-DD')}</td> {/* Display Date, smaller padding */}
                        <td className="py-3 px-4">{moment(entry.start_time).format('HH:mm')}</td> {/* Smaller padding */}
                        <td className="py-3 px-4">{moment(entry.end_time).format('HH:mm')}</td> {/* Smaller padding */}
                        <td className="py-3 px-4 font-bold text-blue-600">{formatHoursToMinutes(entry.duration_hours)}</td> {/* Smaller padding */}
                        <td className="py-3 px-4 text-gray-600">{entry.description}</td> {/* Smaller padding */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// CalendarView Component - Reverted to previous state with task/leave highlighting
function CalendarView({ userId, userRole, viewTaskDetails }) {
  const [date, setDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCalendarData = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    try {
      let tasksUrl = `${API_BASE_URL}/tasks/`;
      let leaveUrl = `${API_BASE_URL}/leave-requests/`;

      // If user role is 'user', filter tasks and leave requests by their ID
      if (userRole === 'user') {
        tasksUrl += `?assigned_to=${userId}`;
        leaveUrl += `?user=${userId}`;
      }

      const [tasksResponse, leaveResponse] = await Promise.all([
        authenticatedFetch(tasksUrl, { method: 'GET' }),
        authenticatedFetch(leaveUrl, { method: 'GET' }),
      ]);

      if (tasksResponse.ok) {
        setTasks(await tasksResponse.json());
      } else {
        setMessage(`Failed to fetch tasks for calendar: ${tasksResponse.statusText}`);
      }

      if (leaveResponse.ok) {
        setLeaveRequests(await leaveResponse.json());
      } else {
        setMessage(`Failed to fetch leave requests for calendar: ${leaveResponse.statusText}`);
      }

    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setMessage('Network error while fetching calendar data.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId, userRole, authenticatedFetch]); // Added authenticatedFetch to dependencies

  useEffect(() => {
    if (userId) {
      fetchCalendarData();
    }
  }, [userId, fetchCalendarData]);

  // Function to mark dates with events
  const tileClassName = ({ date: calendarDate, view }) => {
    if (view === 'month') {
      const formattedCalendarDate = moment(calendarDate).format('YYYY-MM-DD');

      const hasTask = tasks.some(task =>
        task.due_date === formattedCalendarDate
      );

      const hasLeave = leaveRequests.some(request =>
        moment(formattedCalendarDate).isBetween(request.start_date, request.end_date, 'day', '[]') ||
        (request.is_hourly && request.start_date === formattedCalendarDate)
      );

      let classes = [];
      if (hasTask) {
        classes.push('has-task');
      }
      if (hasLeave) {
        classes.push('has-leave');
      }
      return classes.join(' ');
    }
    return null;
  };

  // Function to display details for selected date
  const renderDateContents = (selectedDate) => {
    const formattedSelectedDate = moment(selectedDate).format('YYYY-MM-DD');

    const tasksForDate = tasks.filter(task =>
      task.due_date === formattedSelectedDate
    );

    const leaveForDate = leaveRequests.filter(request =>
      moment(formattedSelectedDate).isBetween(request.start_date, request.end_date, 'day', '[]') ||
      (request.is_hourly && request.start_date === formattedSelectedDate) // Corrected: use formattedSelectedDate
    );

    return (
      <div className="mt-6">
        <h4 className="text-xl font-semibold text-gray-700 mb-3">Events on {moment(selectedDate).format('ddd MMM DD YYYY')}</h4> {/* Changed format to match screenshot */}
        {isLoading ? (
          <p className="text-gray-500">Loading events...</p>
        ) : (
          <>
            {tasksForDate.length > 0 && (
              <div className="mb-4">
                <h5 className="font-medium text-blue-700 mb-2">Tasks Due:</h5>
                <ul className="list-disc list-inside space-y-1">
                  {tasksForDate.map(task => (
                    <li key={task.id} className="text-gray-800 cursor-pointer hover:text-blue-500" onClick={() => viewTaskDetails(task.id)}>
                      {task.name} (Project: {task.project_name})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {leaveForDate.length > 0 && (
              <div className="mb-4">
                <h5 className="font-medium text-pink-700 mb-2">Leave Requests:</h5>
                <ul className="list-disc list-inside space-y-1">
                  {leaveForDate.map(request => (
                    <li key={request.id} className="text-gray-800">
                      {request.user_username} - {request.leave_type} ({request.is_hourly ? `${request.start_time}-${request.end_time}` : `${request.start_date} to ${request.end_date}`}) - Status: {request.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tasksForDate.length === 0 && leaveForDate.length === 0 && (
              <p className="text-gray-500">No events on this date.</p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Calendar View</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 bg-red-100 border border-red-400 text-red-700`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/2">
          <Calendar
            onChange={setDate}
            value={date}
            className="react-calendar-custom shadow-md rounded-lg p-4 bg-gray-50 border border-gray-200"
            tileClassName={tileClassName}
          />
          <style>
            {`
              .react-calendar-custom {
                width: 100%;
                max-width: 100%;
                background: white;
                border: 1px solid #a0a096;
                font-family: Arial, Helvetica, sans-serif;
                line-height: 1.125em;
                border-radius: 0.5rem;
              }
              .react-calendar__navigation button {
                min-width: 44px;
                background: none;
                font-size: 1.2em;
                margin-top: 8px;
                border-radius: 0.25rem;
              }
              .react-calendar__navigation button:enabled:hover,
              .react-calendar__navigation button:enabled:focus {
                background-color: #e6e6e6;
              }
              .react-calendar__navigation button[disabled] {
                background-color: #f0f0f0;
              }
              .react-calendar__month-view__weekdays {
                text-align: center;
                text-transform: uppercase;
                font-weight: bold;
                font-size: 0.75em;
              }
              .react-calendar__month-view__weekdays__weekday {
                padding: 0.5em;
              }
              .react-calendar__month-view__days__day {
                color: #333;
              }
              .react-calendar__tile {
                max-width: 100%;
                padding: 10px 6.6667px;
                background: none;
                text-align: center;
                line-height: 14px;
                border-radius: 0.25rem;
              }
              .react-calendar__tile:enabled:hover,
              .react-calendar__tile:enabled:focus {
                background-color: #e6e6e6;
              }
              .react-calendar__tile--now {
                background: #e0e0e0;
                border-radius: 0.25rem;
              }
              .react-calendar__tile--now:enabled:hover,
              .react-calendar__tile--now:enabled:focus {
                background: #c0c0c0;
              }
              .react-calendar__tile--active {
                background: #006edc;
                color: white;
                border-radius: 0.25rem;
              }
              .react-calendar__tile--active:enabled:hover,
              .react-calendar__tile--active:enabled:focus {
                background: #004d99;
              }
              .has-task {
                background-color: #a7f3d0; /* green-200 */
                border-radius: 0.25rem;
              }
              .has-leave {
                background-color: #fbcfe8; /* pink-200 */
                border-radius: 0.25rem;
              }
              .has-task.has-leave {
                background: linear-gradient(to bottom right, #a7f3d0 50%, #fbcfe8 50%);
              }
            `}
          </style>
        </div>
        <div className="md:w-1/2 p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
          {renderDateContents(date)}
        </div>
      </div>
    </div>
  );
}

// NEW COMPONENT: NoticeManagement (Admin Dashboard)
function NoticeManagement({ userId, openConfirmModal }) {
  const [notices, setNotices] = useState([]);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);

  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/notices/`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        // Sort notices by creation date, newest first
        setNotices(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } else {
        // If response is not OK, log the raw text for debugging
        const errorText = await response.text();
        console.error('Failed to fetch notices. Response status:', response.status, 'Response text:', errorText);
        setMessage(`Failed to fetch notices: ${response.status} - ${errorText || 'Unknown error'}.`);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
      setMessage('Network error while fetching notices.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000); // Keep message longer for backend errors
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    if (userId) {
      fetchNotices();
    }
  }, [userId, fetchNotices]);

  const handleAddNotice = async (e) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) {
      setMessage('Notice title and content cannot be empty.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/notices/`, {
        method: 'POST',
        body: JSON.stringify({ title: newNoticeTitle, content: newNoticeContent, created_by: userId }),
      });

      if (response.ok) {
        setMessage('Notice added successfully!');
        setNewNoticeTitle('');
        setNewNoticeContent('');
        fetchNotices();
      } else {
        const errorText = await response.text();
        console.error('Failed to add notice. Response status:', response.status, 'Response text:', errorText);
        setMessage(`Failed to add notice: ${response.status} - ${errorText || 'Unknown error'}.`);
      }
    } catch (error) {
      console.error('Error adding notice:', error);
      setMessage('Network error while adding notice.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleEditNotice = (notice) => {
    setEditingNotice(notice);
    setNewNoticeTitle(notice.title);
    setNewNoticeContent(notice.content);
  };

  const handleUpdateNotice = async (e) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) {
      setMessage('Notice title and content cannot be empty.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/notices/${editingNotice.id}/`, {
        method: 'PUT',
        body: JSON.stringify({ title: newNoticeTitle, content: newNoticeContent, created_by: userId }),
      });

      if (response.ok) {
        setMessage('Notice updated successfully!');
        setEditingNotice(null);
        setNewNoticeTitle('');
        setNewNoticeContent('');
        fetchNotices();
      } else {
        const errorText = await response.text();
        console.error('Failed to update notice. Response status:', response.status, 'Response text:', errorText);
        setMessage(`Failed to update notice: ${response.status} - ${errorText || 'Unknown error'}.`);
      }
    } catch (error) {
      console.error('Error updating notice:', error);
      setMessage('Network error while updating notice.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteNotice = (noticeId) => {
    openConfirmModal('Are you sure you want to delete this notice? This action cannot be undone.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/notices/${noticeId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage('Notice deleted successfully!');
          fetchNotices();
        } else {
          const errorText = await response.text();
          console.error('Failed to delete notice. Response status:', response.status, 'Response text:', errorText);
          setMessage(`Failed to delete notice: ${response.status} - ${errorText || 'Unknown error'}.`);
        }
      } catch (error) {
        console.error('Error deleting notice:', error);
        setMessage('Network error while deleting notice.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Manage Notices for Users</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-orange-100 border border-orange-400 text-orange-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      {/* Removed the backend implementation note */}

      <form onSubmit={editingNotice ? handleUpdateNotice : handleAddNotice} className="mb-8 bg-orange-50 p-6 rounded-lg shadow-sm border border-orange-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">{editingNotice ? 'Edit Notice' : 'Create New Notice'}</h4>
        <div className="mb-4">
          <label htmlFor="noticeTitle" className="block text-gray-700 text-sm font-bold mb-2">
            Notice Title
          </label>
          <input
            type="text"
            id="noticeTitle"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-200" // Smaller padding, lighter ring
            value={newNoticeTitle}
            onChange={(e) => setNewNoticeTitle(e.target.value)}
            placeholder="e.g., Important Meeting Reminder"
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="noticeContent" className="block text-gray-700 text-sm font-bold mb-2">
            Notice Content
          </label>
          <textarea
            id="noticeContent"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-200" // Smaller padding, lighter ring
            value={newNoticeContent}
            onChange={(e) => setNewNoticeContent(e.target.value)}
            placeholder="e.g., Please fill in your timesheets by EOD. Mandatory meeting at 10 AM in Conference Room A."
            rows="5"
            required
            disabled={isLoading}
          ></textarea>
        </div>
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-orange-300 hover:bg-orange-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
            disabled={isLoading}
          >
            {isLoading ? (editingNotice ? 'Updating...' : 'Creating...') : (editingNotice ? 'Update Notice' : 'Create Notice')}
          </button>
          {editingNotice && (
            <button
              type="button"
              onClick={() => { setEditingNotice(null); setNewNoticeTitle(''); setNewNoticeContent(''); }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300 ease-in-out transform hover:scale-105 text-sm" // Lighter, smaller, less shadow
              disabled={isLoading}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Existing Notices</h4>
      {isLoading && notices.length === 0 ? (
        <p className="text-gray-500">Loading notices...</p>
      ) : notices.length === 0 ? (
        <p className="text-gray-500">No notices created yet. Create one above!</p>
      ) : (
        <ul className="space-y-3"> {/* Slightly reduced spacing */}
          {notices.map((notice) => (
            <li key={notice.id} className="bg-orange-100 p-3 rounded-lg shadow-sm border border-orange-200"> {/* Smaller padding */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-base text-orange-800">{notice.title}</p> {/* Smaller font */}
                  <p className="text-gray-600 text-xs">Created by: {notice.created_by_username || 'Admin'} on {moment(notice.created_at).format('MMM DD, YYYY HH:mm')}</p> {/* Smaller font */}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditNotice(notice)}
                    className="px-3 py-1.5 bg-yellow-300 text-gray-800 rounded-lg hover:bg-yellow-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteNotice(notice.id)}
                    className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 text-xs shadow-sm" // Lighter, smaller, less shadow
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-gray-700 text-sm">{notice.content}</p> {/* Smaller font */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// NEW COMPONENT: UserNotices (User Dashboard)
function UserNotices({ userId }) {
  const [notices, setNotices] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/notices/`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        // Sort notices by creation date, newest first
        setNotices(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } else {
        // If response is not OK, log the raw text for debugging
        const errorText = await response.text();
        console.error('Failed to fetch notices. Response status:', response.status, 'Response text:', errorText);
        setMessage(`Failed to fetch notices: ${response.status} - ${errorText || 'Unknown error'}.`);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
      setMessage('Network error while fetching notices.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000); // Keep message longer for backend errors
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    if (userId) {
      fetchNotices();
    }
  }, [userId, fetchNotices]);

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Important Notices & Reminders</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-blue-100 border border-blue-400 text-blue-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      {/* Removed the backend implementation note */}

      {isLoading && notices.length === 0 ? (
        <p className="text-gray-500">Loading notices...</p>
      ) : notices.length === 0 ? (
        <p className="text-gray-500">No notices available at this time.</p>
      ) : (
        <ul className="space-y-3"> {/* Slightly reduced spacing */}
          {notices.map((notice) => (
            <li key={notice.id} className="bg-blue-50 p-3 rounded-lg shadow-md border border-blue-100"> {/* Smaller padding */}
              <p className="font-semibold text-base text-blue-800 mb-1">{notice.title}</p> {/* Smaller font */}
              <p className="text-gray-700 text-sm mb-2">{notice.content}</p> {/* Smaller font */}
              <p className="text-gray-500 text-xs"> {/* Smaller font */}
                Posted by: {notice.created_by_username || 'Admin'} on {moment(notice.created_at).format('MMM DD, YYYY HH:mm')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


// Admin Dashboard Component
function AdminDashboard({ userId, openConfirmModal, viewTaskDetails, onLeaveStatusChange }) { // Added onLeaveStatusChange prop
  const [activeTab, setActiveTab] = useState('projects-tasks'); // Default tab, changed

  return (
    <div className="p-6">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">Admin Dashboard</h2>
      <div className="flex flex-wrap border-b border-gray-200 mb-6">
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'projects-tasks' // Combined tab
              ? 'bg-blue-200 text-blue-800 border-b-4 border-blue-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('projects-tasks')}
        >
          Projects & Tasks
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'users'
              ? 'bg-purple-200 text-purple-800 border-b-4 border-purple-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'leave-approval'
              ? 'bg-red-200 text-red-800 border-b-4 border-red-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('leave-approval')}
        >
          Leave Approval
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'hourly-updates'
              ? 'bg-teal-200 text-teal-800 border-b-4 border-teal-400' // Using teal for admin hourly updates, lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('hourly-updates')}
        >
          Daily Hourly Updates
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'workday-timesheets' // NEW TAB
              ? 'bg-indigo-200 text-indigo-800 border-b-4 border-indigo-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('workday-timesheets')} // NEW TAB
        >
          Workday Timesheets
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'notices' // NEW TAB for Admin
              ? 'bg-orange-200 text-orange-800 border-b-4 border-orange-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('notices')} // NEW TAB
        >
          Notice Management
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'calendar'
              ? 'bg-yellow-200 text-yellow-800 border-b-4 border-yellow-400' // Changed color for calendar, lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar View
        </button>
      </div>

      {activeTab === 'projects-tasks' ? ( // Render combined component
        <ProjectAndTaskManagement userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'users' ? (
        <UserManagement userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'leave-approval' ? (
        <LeaveApproval userId={userId} openConfirmModal={openConfirmModal} onLeaveStatusChange={onLeaveStatusChange} />
      ) : activeTab === 'hourly-updates' ? (
        <HourlyUpdatesReport userId={userId} />
      ) : activeTab === 'workday-timesheets' ? (
        <WorkdayTimesheetView userId={userId} />
      ) : activeTab === 'notices' ? ( // Render new Notice Management
        <NoticeManagement userId={userId} openConfirmModal={openConfirmModal} />
      ) : (
        <CalendarView userId={userId} userRole="admin" viewTaskDetails={viewTaskDetails} />
      )}
    </div>
  );
}

// User Dashboard Component
function UserDashboard({ userId, openConfirmModal, viewTaskDetails, onLeaveStatusChange, newNoticesAvailable, onViewNoticesTab, newTasksAvailable, onMyTasksViewed }) { // NEW PROPS: newTasksAvailable, onMyTasksViewed
  const [activeTab, setActiveTab] = useState('my-tasks'); // Default tab

  return (
    <div className="p-6">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">User Dashboard</h2>
      <div className="flex flex-wrap border-b border-gray-200 mb-6">
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 relative ${ // Smaller padding, smaller font, added relative for dot
            activeTab === 'my-tasks'
              ? 'bg-indigo-200 text-indigo-800 border-b-4 border-indigo-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => {
            setActiveTab('my-tasks');
            onMyTasksViewed(userId); // Mark tasks as viewed when this tab is opened
          }}
        >
          My Tasks
          {newTasksAvailable && ( // Conditional dot for new tasks
            <span className="absolute top-1 right-1 inline-flex items-center justify-center w-2.5 h-2.5 text-xs font-bold text-white bg-red-500 rounded-full"></span>
          )}
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'hourly-time-entry'
              ? 'bg-purple-200 text-purple-800 border-b-4 border-purple-400' // Lighter purple for visibility, lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('hourly-time-entry')}
        >
          Hourly Time Entry
        </button>
        {/* Removed Timesheet Week View as per user request */}
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'leave-request'
              ? 'bg-pink-200 text-pink-800 border-b-4 border-pink-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('leave-request')}
        >
          Leave Request
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 relative ${ // Smaller padding, smaller font, added relative for dot
            activeTab === 'notices' // NEW TAB for User
              ? 'bg-blue-200 text-blue-800 border-b-4 border-blue-400' // Lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => {
            setActiveTab('notices');
            onViewNoticesTab(userId); // Mark notices as viewed when this tab is opened
          }}
        >
          Notices
          {newNoticesAvailable && ( // Conditional dot for new notices
            <span className="absolute top-1 right-1 inline-flex items-center justify-center w-2.5 h-2.5 text-xs font-bold text-white bg-red-500 rounded-full"></span>
          )}
        </button>
        <button
          className={`py-2.5 px-5 text-base font-medium rounded-t-lg transition duration-300 ${ // Smaller padding, smaller font
            activeTab === 'calendar'
              ? 'bg-orange-200 text-orange-800 border-b-4 border-orange-400' // Changed color for calendar, lighter border
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar View
        </button>
      </div>

      {activeTab === 'my-tasks' ? (
        <UserTaskManagement userId={userId} openConfirmModal={openConfirmModal} viewTaskDetails={viewTaskDetails} onMyTasksViewed={onMyTasksViewed} />
      ) : activeTab === 'hourly-time-entry' ? (
        <UserHourlyTimeEntry userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'leave-request' ? (
        <LeaveRequest userId={userId} openConfirmModal={openConfirmModal} onLeaveStatusChange={onLeaveStatusChange} />
      ) : activeTab === 'notices' ? ( // Render new User Notices
        <UserNotices userId={userId} />
      ) : (
        <CalendarView userId={userId} userRole="user" viewTaskDetails={viewTaskDetails} />
      )}
    </div>
  );
}


// Main App Component - Defined last as per best practice for clarity and bundling
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState('login'); // 'login', 'register', 'admin-login', 'admin', 'user', 'task-detail'
  const [message, setMessage] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true); // NEW: Add loading state for authentication

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);

  // --- State Variables for Task Time Entries (for TaskDetailView) ---
  const [selectedTaskId, setSelectedTaskId] = useState(null); // Stores the ID of the task currently being viewed
  const [selectedTask, setSelectedTask] = useState(null); // Stores the full object of the selected task
  const [taskTimeEntries, setTaskTimeEntries] = useState([]); // Stores time entries for the selected task

  // State to trigger re-fetch of leave requests in user dashboard
  // This state is incremented by admin's LeaveApproval component
  // and used as a dependency in the user's LeaveRequest component to trigger re-fetch.
  const [leaveRequestsUpdated, setLeaveRequestsUpdated] = useState(0);

  // NEW STATE: For new notices dot
  const [newNoticesAvailable, setNewNoticesAvailable] = useState(false);

  // NEW STATE: For new tasks dot
  const [newTasksAvailable, setNewTasksAvailable] = useState(false);


  const openConfirmModal = (msg, onConfirm) => {
    setModalMessage(msg);
    setModalConfirmAction(() => onConfirm);
    setIsModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (modalConfirmAction) {
      modalConfirmAction();
    }
    setIsModalOpen(false);
    setModalConfirmAction(null);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setModalConfirmAction(null);
  };

  // Callback to trigger re-fetch of leave requests in user dashboard
  const handleLeaveStatusChange = useCallback(() => {
    console.log('[App] handleLeaveStatusChange triggered. Incrementing leaveRequestsUpdated.');
    setLeaveRequestsUpdated(prev => prev + 1);
  }, []);

  // NEW FUNCTION: Check for new notices
  const checkNewNotices = useCallback(async (currentUserId) => {
    if (!currentUserId) {
        setNewNoticesAvailable(false);
        return;
    }
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/notices/`, { method: 'GET' });
        if (response.ok) {
            const notices = await response.json();
            const lastViewedTimestamp = localStorage.getItem(`last_viewed_notices_${currentUserId}`);
            const hasUnread = notices.some(notice => {
                if (!lastViewedTimestamp) return true; // If never viewed, all are new
                return new Date(notice.created_at).getTime() > new Date(lastViewedTimestamp).getTime();
            });
            setNewNoticesAvailable(hasUnread);
        } else {
            console.error('Failed to check for new notices:', response.status);
            setNewNoticesAvailable(false); // Assume no new if fetch fails
        }
    } catch (error) {
        console.error('Network error checking for new notices:', error);
        setNewNoticesAvailable(false);
    }
  }, [authenticatedFetch]);

  // NEW FUNCTION: Mark notices as viewed
  const markNoticesAsViewed = useCallback((currentUserId) => {
      localStorage.setItem(`last_viewed_notices_${currentUserId}`, new Date().toISOString());
      setNewNoticesAvailable(false);
  }, []);

  // NEW FUNCTION: Check for new tasks
  const checkNewTasks = useCallback(async (currentUserId) => {
    if (!currentUserId) {
        setNewTasksAvailable(false);
        return;
    }
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/tasks/?assigned_to=${currentUserId}`, { method: 'GET' });
        if (response.ok) {
            const tasks = await response.json();
            const lastViewedTimestamp = localStorage.getItem(`last_viewed_tasks_${currentUserId}`);
            const hasUnread = tasks.some(task => {
                if (!lastViewedTimestamp) return true; // If never viewed, all are new
                return new Date(task.created_at).getTime() > new Date(lastViewedTimestamp).getTime();
            });
            setNewTasksAvailable(hasUnread);
        } else {
            console.error('Failed to check for new tasks:', response.status);
            setNewTasksAvailable(false); // Assume no new if fetch fails
        }
    } catch (error) {
        console.error('Network error checking for new tasks:', error);
        setNewTasksAvailable(false);
    }
  }, [authenticatedFetch]);

  // NEW FUNCTION: Mark tasks as viewed
  const markTasksAsViewed = useCallback((currentUserId) => {
      localStorage.setItem(`last_viewed_tasks_${currentUserId}`, new Date().toISOString());
      setNewTasksAvailable(false);
  }, []);


  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const storedUserRole = localStorage.getItem('user_role');
    const storedUserId = localStorage.getItem('user_id');

    if (accessToken && storedUserRole && storedUserId) {
      const parsedUserId = parseInt(storedUserId);
      setIsAuthenticated(true);
      setUserRole(storedUserRole);
      setUserId(parsedUserId);
      setCurrentPage(storedUserRole === 'admin' ? 'admin' : 'user');
      // Call checkNewNotices and checkNewTasks only if it's a regular user
      if (storedUserRole === 'user') {
        checkNewNotices(parsedUserId);
        checkNewTasks(parsedUserId);
      }
    } else {
      setIsAuthenticated(false);
      setUserRole(null);
      setUserId(null);
      setCurrentPage('login');
    }
    setLoadingAuth(false); // Set loading to false after auth check
  }, [checkNewNotices, checkNewTasks]); // Added checkNewNotices and checkNewTasks to dependencies

  const handleLogin = async (username, password) => {
    setMessage('');
    console.log("Attempting login for:", username);
    try {
      const response = await fetch(`${API_BASE_URL}/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      console.log("Login API Response status:", response.status);
      console.log("Login API Response OK:", response.ok);

      if (response.ok) {
        let data;
        try {
          data = await response.json();
          console.log("Login successful! Backend response data:", data);
        } catch (jsonError) {
          console.error("Error parsing JSON response from backend:", jsonError);
          setMessage('Login failed: Invalid response from server.');
          return; // Stop execution if JSON parsing fails
        }

        // Ensure data has expected properties before using them
        const userRoleFromBackend = data.is_admin ? 'admin' : 'user';
        const userIdFromBackend = data.user_id;

        if (userIdFromBackend === undefined || userIdFromBackend === null) {
            console.error("Backend response missing user_id:", data);
            setMessage('Login failed: User ID missing from server response.');
            return;
        }

        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('user_role', userRoleFromBackend);
        localStorage.setItem('user_id', userIdFromBackend);

        setIsAuthenticated(true);
        setUserRole(userRoleFromBackend);
        setUserId(userIdFromBackend);
        setCurrentPage(userRoleFromBackend === 'admin' ? 'admin' : 'user');
        setMessage('Login successful!');

        // After successful login, check for new notices and tasks if it's a regular user
        if (userRoleFromBackend === 'user') {
            checkNewNotices(userIdFromBackend);
            checkNewTasks(userIdFromBackend);
        }

      } else {
        let errorData;
        try {
          errorData = await response.json();
          console.error("Login failed. Backend error response:", errorData);
          setMessage(errorData.detail || errorData.message || 'Login failed. Please check your credentials.');
        } catch (jsonError) {
          console.error("Error parsing error JSON response from backend:", jsonError);
          setMessage(`Login failed with status ${response.status}. Server sent unreadable error.`);
        }
      }
    } catch (error) {
      console.error('Login network error:', error);
      setMessage('An unexpected error occurred during login. Please check your network connection.');
    } finally {
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleLogout = async () => {
    setMessage('');
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      // Note: If you don't have a backend /logout/ endpoint that blacklists tokens,
      // this fetch will likely fail with a 404 or 405.
      // For stateless JWTs, clearing local storage is often sufficient for logout.
      const response = await authenticatedFetch(`${API_BASE_URL}/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok || response.status === 404 || response.status === 405) { // Treat 404/405 as successful logout if no explicit endpoint
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        setIsAuthenticated(false);
        setUserRole(null);
        setUserId(null);
        setCurrentPage('login');
        setMessage('Logout successful!');
        // --- NEW: Clear task-specific state on logout ---
        setSelectedTaskId(null);
        setSelectedTask(null);
        setTaskTimeEntries([]);
        setNewNoticesAvailable(false); // Clear new notices state on logout
        setNewTasksAvailable(false); // Clear new tasks state on logout
        // --- END NEW ---
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Logout failed.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      setMessage('Network error during logout.');
    } finally {
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleRegisterSuccess = () => {
    setMessage('Registration successful! Please log in.');
    setCurrentPage('login');
    setTimeout(() => setMessage(''), 5000);
  };

  // --- NEW Functions for Task Time Entries (within main App component) ---

  // Function to navigate to a specific task's detail view
  const viewTaskDetails = useCallback((taskId) => {
      setSelectedTaskId(taskId);
      setCurrentPage('task-detail'); // Set a new page state for task detail view
  }, []);

  // Function to fetch details of a specific task
  const fetchTaskDetails = useCallback(async (taskId) => {
      const token = localStorage.getItem('access_token');
      if (!token || !taskId) return;
      try {
          const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${taskId}/`, {
              headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
              const data = await response.json();
              setSelectedTask(data);
          } else {
              console.error(`Failed to fetch task ${taskId} details:`, response.status, response.statusText);
              setSelectedTask(null);
              setMessage(`Failed to load task details: ${response.statusText}`);
          }
      } catch (error) {
          console.error(`Error fetching task ${taskId} details:`, error);
          setSelectedTask(null);
              setMessage(`Network error fetching task details.`);
      } finally {
          setTimeout(() => setMessage(''), 5000);
      }
  }, [authenticatedFetch]);

  // Function to fetch time entries for a specific task
  const fetchTaskTimeEntries = useCallback(async (taskId) => {
      const token = localStorage.getItem('access_token');
      if (!token || !taskId) return;
      try {
          const response = await authenticatedFetch(`${API_BASE_URL}/task-time-entries/?task_id=${taskId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
              const data = await response.json();
              setTaskTimeEntries(data);
          } else {
              console.error(`Failed to fetch time entries for task ${taskId}:`, response.status, response.statusText);
              setTaskTimeEntries([]);
              setMessage(`Failed to load time entries: ${response.statusText}`);
          }
      } catch (error) {
          console.error(`Error fetching time entries for task ${taskId}:`, error);
          setTaskTimeEntries([]);
          setMessage(`Network error fetching time entries.`);
      } finally {
          setTimeout(() => setMessage(''), 5000);
      }
  }, [authenticatedFetch]);


  // Effect to fetch task details and time entries when selectedTaskId changes
  useEffect(() => {
      if (selectedTaskId) {
          fetchTaskDetails(selectedTaskId);
          fetchTaskTimeEntries(selectedTaskId);
      }
  }, [selectedTaskId, fetchTaskDetails, fetchTaskTimeEntries]);


  const renderContent = () => {
    if (loadingAuth) { // NEW: Show loading while authentication status is being determined
      return (
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-gray-600">Loading application...</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (currentPage === 'register') {
        return <Register onRegisterSuccess={handleRegisterSuccess} onGoToLogin={() => setCurrentPage('login')} />;
      } else if (currentPage === 'admin-login') {
        return <AdminLogin onLogin={handleLogin} onGoToRegularLogin={() => setCurrentPage('login')} />;
      } else { // currentPage === 'login'
        return <Login onLogin={handleLogin} onGoToRegister={() => setCurrentPage('register')} onGoToAdminLogin={() => setCurrentPage('admin-login')} />;
      }
    } else if (currentPage === 'task-detail') { // NEW: Render TaskDetailView if a task is selected
        return (
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-3xl mx-auto text-white">
                <button onClick={() => setSelectedTaskId(null) || setCurrentPage(userRole === 'admin' ? 'admin' : 'user')}
                        className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition duration-300 mb-6 text-sm shadow-sm"> {/* Smaller, less shadow */}
                    &larr; Back to Dashboard
                </button>

                {selectedTask ? (
                    <>
                        <h2 className="text-3xl font-bold mb-4 text-blue-400">{selectedTask.name}</h2>
                        <p className="text-gray-300 mb-4">{selectedTask.description}</p>
                        <p className="text-gray-400 text-sm mb-6">
                            Due: {selectedTask.due_date || 'N/A'} | Status: {selectedTask.status} | Progress: {selectedTask.progress}%
                        </p>
                        <p className="text-gray-400 text-sm mb-6">
                            Assigned To: {selectedTask.assigned_to_username || 'N/A'} | Project: {selectedTask.project_name || 'N/A'}
                            {selectedTask.parent_task_name && ` | Parent: ${selectedTask.parent_task_name}`}
                            {selectedTask.reporting_manager_username && ` | Reporting Manager: ${selectedTask.reporting_manager_username}`}
                        </p>

                        <hr className="border-gray-700 my-6" />

                        <h3 className="text-2xl font-bold mb-4 text-blue-300">Logged Time for This Task</h3>
                        {taskTimeEntries.length > 0 ? (
                            <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                                <table className="w-full text-sm text-left text-gray-400 light-table-style">
                                    <thead className="text-xs text-gray-300 uppercase bg-gray-700 light-table-header">
                                        <tr>
                                            <th scope="col" className="py-2 px-4">Date</th> {/* Smaller padding */}
                                            <th scope="col" className="py-2 px-4">Start Time</th> {/* Smaller padding */}
                                            <th scope="col" className="py-2 px-4">End Time</th> {/* Smaller padding */}
                                            <th scope="col" className="py-2 px-4">Duration</th> {/* Smaller padding */}
                                            <th scope="col" className="py-2 px-4">Description</th> {/* Smaller padding */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taskTimeEntries.sort((a, b) => moment(b.start_time).valueOf() - moment(a.start_time).valueOf()).map(entry => (
                                            <tr key={entry.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700">
                                                <td className="py-3 px-4">{moment(entry.start_time).format('YYYY-MM-DD')}</td> {/* Smaller padding */}
                                                <td className="py-3 px-4">{moment(entry.start_time).format('HH:mm')}</td> {/* Smaller padding */}
                                                <td className="py-3 px-4">{moment(entry.end_time).format('HH:mm')}</td> {/* Smaller padding */}
                                                <td className="py-3 px-4 font-bold text-blue-200">{formatHoursToMinutes(entry.duration_hours)}</td> {/* Smaller padding */}
                                                <td className="py-3 px-4">{entry.description}</td> {/* Smaller padding */}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-4">No time entries logged for this task yet.</p>
                        )}
                    </>
                ) : (
                    <p className="text-center text-gray-400">Loading task details...</p>
                )}
            </div>
        );
    } else if (userRole === 'admin') {
      return <AdminDashboard userId={userId} openConfirmModal={openConfirmModal} viewTaskDetails={viewTaskDetails} onLeaveStatusChange={handleLeaveStatusChange} />;
    } else { // userRole === 'user'
      return <UserDashboard
                userId={userId}
                openConfirmModal={openConfirmModal}
                viewTaskDetails={viewTaskDetails}
                onLeaveStatusChange={handleLeaveStatusChange}
                newNoticesAvailable={newNoticesAvailable} // Pass newNoticesAvailable
                onViewNoticesTab={markNoticesAsViewed} // Pass markNoticesAsViewed
                newTasksAvailable={newTasksAvailable} // Pass newTasksAvailable
                onMyTasksViewed={markTasksAsViewed} // Pass markTasksAsViewed
             />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">WorkLog</h1>
        {isAuthenticated && (
          <nav className="flex items-center space-x-4">
            <span className="text-gray-700 font-medium">Logged in as: {userRole === 'admin' ? 'Admin' : 'User'}</span> {/* Removed ID */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-300 text-white rounded-lg hover:bg-red-400 transition duration-300 shadow-sm text-sm" // Lighter, smaller, less shadow
            >
              Logout
            </button>
          </nav>
        )}
      </header>
      <main className="container mx-auto p-4 py-8">
        {message && (
          <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-green-100 border border-green-400 text-green-700' : message.includes('overwork') || message.includes('exceed') ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
            <span className="block sm:inline">{message}</span>
          </div>
        )}
        {renderContent()}
      </main>
      <ConfirmationModal
        isOpen={isModalOpen}
        message={modalMessage}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </div>
  );
}

export default App;
