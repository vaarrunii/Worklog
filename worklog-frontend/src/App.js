import React, { useState, useEffect, useCallback, useRef } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

// Define your Django API base URL
// IMPORTANT: Adjust this port to match the port your Django backend is running on (e.g., 8000 or 8001)
const API_BASE_URL = 'http://127.0.0.1:8001/api'; 

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

// Helper to get dates for a week starting from a given date (Monday is day 0)
const getWeekDates = (startDate) => {
  const dates = [];
  const startOfWeek = new Date(startDate);
  const dayOfWeek = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday start
  startOfWeek.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => date.toISOString().split('T')[0];

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
            className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-200"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition duration-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition duration-200"
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
            className="w-full bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline shadow-md transform hover:scale-105 transition duration-300 ease-in-out"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={onGoToRegister}
            className="w-full text-blue-600 hover:text-blue-800 text-sm font-semibold transition duration-300 ease-in-out"
            disabled={isLoading}
          >
            Don't have an account? Register here.
          </button>
          <button
            type="button"
            onClick={onGoToAdminLogin}
            className="w-full text-purple-600 hover:text-purple-800 text-sm font-semibold mt-2 transition duration-300 ease-in-out"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition duration-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition duration-200"
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
            className="w-full bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline shadow-md transform hover:scale-105 transition duration-300 ease-in-out"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In as Admin'}
          </button>
          <button
            type="button"
            onClick={onGoToRegularLogin}
            className="w-full text-blue-600 hover:text-blue-800 text-sm font-semibold mt-2 transition duration-300 ease-in-out"
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
        body: JSON.stringify({ username, email, password }),
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-300"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-300"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-300"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-300"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-col items-center justify-between gap-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-green-400 to-teal-500 hover:from-green-500 hover:to-teal-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline shadow-md transform hover:scale-105 transition duration-300 ease-in-out"
            disabled={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
          <button
            type="button"
            onClick={onGoToLogin}
            className="w-full text-blue-600 hover:text-blue-800 text-sm font-semibold transition duration-300 ease-in-out"
            disabled={isLoading}
          >
            Already have an account? Login here.
          </button>
        </div>
      </form>
    </div>
  );
}

// Project Management Component (Admin)
function ProjectManagement({ userId, openConfirmModal }) {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/projects/`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      } else {
        const errorData = await response.json();
        setMessage(`Failed to fetch projects: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setMessage('Network error while fetching projects.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
        body: JSON.stringify({ name: newProjectName, description: newProjectDescription }),
      });

      if (response.ok) {
        setMessage('Project added successfully!');
        setNewProjectName('');
        setNewProjectDescription('');
        fetchProjects();
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
    setNewProjectDescription(project.description);
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
        body: JSON.stringify({ name: newProjectName, description: newProjectDescription }),
      });

      if (response.ok) {
        setMessage('Project updated successfully!');
        setEditingProject(null);
        setNewProjectName('');
        setNewProjectDescription('');
        fetchProjects();
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
    openConfirmModal('Are you sure you want to delete this project? This action cannot be undone.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/projects/${projectId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage('Project deleted successfully!');
          fetchProjects();
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

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Manage Projects</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-blue-100 border border-blue-400 text-blue-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <form onSubmit={editingProject ? handleUpdateProject : handleAddProject} className="mb-6 bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">{editingProject ? 'Edit Project' : 'Add New Project'}</h4>
        <div className="mb-4">
          <label htmlFor="projectName" className="block text-gray-700 text-sm font-bold mb-2">
            Project Name
          </label>
          <input
            type="text"
            id="projectName"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="e.g., Q3 Marketing Campaign"
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="projectDescription" className="block text-gray-700 text-sm font-bold mb-2">
            Description
          </label>
          <textarea
            id="projectDescription"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            placeholder="Brief description of the project"
            rows="3"
            disabled={isLoading}
          ></textarea>
        </div>
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            disabled={isLoading}
          >
            {isLoading ? (editingProject ? 'Updating...' : 'Adding...') : (editingProject ? 'Update Project' : 'Add Project')}
          </button>
          {editingProject && (
            <button
              type="button"
              onClick={() => { setEditingProject(null); setNewProjectName(''); setNewProjectDescription(''); }}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              disabled={isLoading}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Existing Projects</h4>
      {isLoading && projects.length === 0 ? (
        <p className="text-gray-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">No projects added yet. Add one above!</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => (
            <li key={project.id} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-2 sm:mb-0">
                <p className="font-semibold text-lg text-blue-800">{project.name}</p>
                <p className="text-gray-600 text-sm">{project.description}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditProject(project)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 text-sm"
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

// Task Assignment Component (Admin)
function TaskAssignment({ userId, openConfirmModal }) {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [assignedToUser, setAssignedToUser] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const fetchInitialData = useCallback(async () => {
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
        if (data.length > 0) setSelectedProject(data[0].id);
      } else {
        const errorData = await projectsResponse.json();
        setMessage(`Failed to fetch projects: ${errorData.detail || 'Unknown error'}`);
      }

      if (usersResponse.ok) {
        const data = await usersResponse.json();
        const regularUsers = data.filter(user => !user.is_staff);
        setUsers(regularUsers);
        if (regularUsers.length > 0) setAssignedToUser(regularUsers[0].id);
      } else {
        const errorData = await usersResponse.json();
        setMessage(`Failed to fetch users: ${errorData.detail || 'Unknown error'}`);
      }

      if (tasksResponse.ok) {
        const data = await tasksResponse.json();
        setTasks(data);
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
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedProject || !assignedToUser) {
      setMessage('Please fill all required fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/`, {
        method: 'POST',
        body: JSON.stringify({
          project: selectedProject,
          name: newTaskName,
          description: newTaskDescription,
          assigned_to: assignedToUser,
          due_date: newTaskDueDate || null,
        }),
      });

      if (response.ok) {
        setMessage('Task assigned successfully!');
        setNewTaskName('');
        setNewTaskDescription('');
        setNewTaskDueDate('');
        fetchInitialData();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to assign task: ${errorData.name || errorData.detail || 'Unknown error'}`);
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
    setSelectedProject(task.project);
    setNewTaskName(task.name);
    setNewTaskDescription(task.description);
    setNewTaskDueDate(task.due_date || '');
    setAssignedToUser(task.assigned_to || '');
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedProject || !assignedToUser) {
      setMessage('Please fill all required fields.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${editingTask.id}/`, {
        method: 'PUT',
        body: JSON.stringify({
          project: selectedProject,
          name: newTaskName,
          description: newTaskDescription,
          assigned_to: assignedToUser,
          due_date: newTaskDueDate || null,
          status: editingTask.status,
          progress: editingTask.progress,
        }),
      });

      if (response.ok) {
        setMessage('Task updated successfully!');
        setEditingTask(null);
        setNewTaskName('');
        setNewTaskDescription('');
        setNewTaskDueDate('');
        setAssignedToUser(users.length > 0 ? users[0].id : '');
        fetchInitialData();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to update task: ${errorData.name || errorData.detail || 'Unknown error'}`);
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
    openConfirmModal('Are you sure you want to delete this task? This action cannot be undone.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/tasks/${taskId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage('Task deleted successfully!');
          fetchInitialData();
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

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Assign Tasks</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <form onSubmit={editingTask ? handleUpdateTask : handleAssignTask} className="mb-6 bg-green-50 p-6 rounded-lg shadow-sm border border-green-100">
        <h4 className="text-xl font-medium text-gray-700 mb-4">{editingTask ? 'Edit Task' : 'Create New Task'}</h4>
        <div className="mb-4">
          <label htmlFor="selectProject" className="block text-gray-700 text-sm font-bold mb-2">
            Select Project
          </label>
          <select
            id="selectProject"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            required
            disabled={isLoading || projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="taskName" className="block text-gray-700 text-sm font-bold mb-2">
            Task Name
          </label>
          <input
            type="text"
            id="taskName"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="e.g., Design Landing Page"
            required
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="taskDescription" className="block text-gray-700 text-sm font-bold mb-2">
            Task Description
          </label>
          <textarea
            id="taskDescription"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            placeholder="Detailed description of the task"
            rows="3"
            disabled={isLoading}
          ></textarea>
        </div>
        <div className="mb-4">
          <label htmlFor="taskDueDate" className="block text-gray-700 text-sm font-bold mb-2">
            Due Date
          </label>
          <input
            type="date"
            id="taskDueDate"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200"
            value={newTaskDueDate}
            onChange={(e) => setNewTaskDueDate(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="assignTo" className="block text-gray-700 text-sm font-bold mb-2">
            Assign To
          </label>
          <select
            id="assignTo"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-200"
            value={assignedToUser}
            onChange={(e) => setAssignedToUser(e.target.value)}
            required
            disabled={isLoading || users.length === 0}
          >
            {users.length === 0 ? (
              <option value="">No users available</option>
            ) : (
              users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            disabled={isLoading || projects.length === 0 || users.length === 0}
          >
            {isLoading ? (editingTask ? 'Updating...' : 'Assigning...') : (editingTask ? 'Update Task' : 'Assign Task')}
          </button>
          {editingTask && (
            <button
              type="button"
              onClick={() => { setEditingTask(null); setNewTaskName(''); setNewTaskDescription(''); setNewTaskDueDate(''); setAssignedToUser(users.length > 0 ? users[0].id : ''); }}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              disabled={isLoading}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Existing Tasks</h4>
      {isLoading && tasks.length === 0 ? (
        <p className="text-gray-500">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500">No tasks assigned yet. Assign one above!</p>
      ) : (
        <ul className="space-y-4">
          {tasks.map((task) => (
            <li key={task.id} className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-2 sm:mb-0">
                <p className="font-semibold text-lg text-green-800">{task.name} (Project: {task.project_name})</p>
                <p className="text-gray-600 text-sm">Assigned To: {task.assigned_to_username || 'N/A'}</p>
                <p className="text-gray-600 text-sm">Due Date: {task.due_date || 'N/A'}</p>
                <p className="text-gray-600 text-sm">Status: <span className={`font-semibold ${task.status === 'completed' ? 'text-green-600' : task.status === 'in_progress' ? 'text-blue-600' : 'text-yellow-600'}`}>{task.status}</span></p>
                <p className="text-gray-600 text-sm">Progress: {task.progress}%</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditTask(task)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 text-sm"
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

// User Management Component (Admin)
function UserManagement({ userId, openConfirmModal }) {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
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
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
        body: JSON.stringify({ username: newUsername, email: newEmail, password: newPassword, is_staff: isNewUserStaff }),
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


  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Manage Users</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-purple-100 border border-purple-400 text-purple-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-200"
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
          className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
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
        <ul className="space-y-4">
          {users.map((user) => (
            <li key={user.id} className="bg-purple-50 p-4 rounded-lg shadow-sm border border-purple-100 flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg text-purple-800">{user.username} {user.is_staff && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-200 text-purple-800">Admin</span>}</p>
                <p className="text-gray-600 text-sm">{user.email}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Leave Approval Component (Admin)
function LeaveApproval({ userId, openConfirmModal }) {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLeaveRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data);
      } else {
        const errorData = await response.json();
        setMessage(`Failed to fetch leave requests: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setMessage('Network error while fetching leave requests.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  const handleUpdateLeaveRequest = async (requestId, newStatus, adminComments = '') => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${requestId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, admin_comments: adminComments }),
      });

      if (response.ok) {
        setMessage(`Leave request ${newStatus} successfully!`);
        fetchLeaveRequests();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to update leave request: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating leave request:', error);
      setMessage('Network error while updating leave request.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteLeaveRequest = (requestId) => {
    openConfirmModal('Are you sure you want to delete this leave request? This action cannot be undone.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${requestId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage('Leave request deleted successfully!');
          fetchLeaveRequests();
        } else {
          const errorData = await response.json();
          setMessage(`Failed to delete leave request: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting leave request:', error);
        setMessage('Network error while deleting leave request.');
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
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-red-100 border border-red-400 text-red-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      {isLoading && leaveRequests.length === 0 ? (
        <p className="text-gray-500">Loading leave requests...</p>
      ) : leaveRequests.length === 0 ? (
        <p className="text-gray-500">No leave requests to review.</p>
      ) : (
        <ul className="space-y-4">
          {leaveRequests.map((request) => (
            <li key={request.id} className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-2 sm:mb-0">
                <p className="font-semibold text-lg text-red-800">{request.user_username} - {request.leave_type} {request.is_hourly && `(${request.start_time} - ${request.end_time})`}</p>
                <p className="text-gray-600 text-sm">
                  {request.start_date} {request.is_hourly ? '' : `to ${request.end_date}`}
                </p>
                <p className="text-gray-600 text-sm italic">Reason: {request.reason}</p>
                <p className="text-gray-600 text-sm">Status: <span className={`font-semibold ${request.status === 'approved' ? 'text-green-600' : request.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}`}>{request.status}</span></p>
                {request.admin_comments && <p className="text-gray-600 text-sm">Admin Comments: {request.admin_comments}</p>}
                {request.approved_by_username && <p className="text-gray-600 text-sm">Approved By: {request.approved_by_username}</p>}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                {request.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleUpdateLeaveRequest(request.id, 'approved')}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-300 text-sm"
                      disabled={isLoading}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateLeaveRequest(request.id, 'rejected')}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300 text-sm"
                      disabled={isLoading}
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteLeaveRequest(request.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 text-sm"
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

// Reporting Component (Admin)
function Reporting({ userId }) {
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [reportData, setReportData] = useState({});

  const fetchReportingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [timesheetResponse, usersResponse, projectsResponse] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/timesheets/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/users/`, { method: 'GET' }),
        authenticatedFetch(`${API_BASE_URL}/projects/`, { method: 'GET' }),
      ]);

      if (timesheetResponse.ok) {
        setTimesheetEntries(await timesheetResponse.json());
      } else {
        setMessage(`Failed to fetch timesheet data: ${timesheetResponse.statusText}`);
      }
      if (usersResponse.ok) {
        setUsers(await usersResponse.json());
      } else {
        setMessage(`Failed to fetch users data: ${usersResponse.statusText}`);
      }
      if (projectsResponse.ok) {
        setProjects(await projectsResponse.json());
      } else {
        setMessage(`Failed to fetch projects data: ${projectsResponse.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching reporting data:', error);
      setMessage('Network error while fetching reporting data.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, []);

  useEffect(() => {
    fetchReportingData();
  }, [fetchReportingData]);

  const generateReport = useCallback(() => {
    let filteredEntries = timesheetEntries;

    if (selectedUser) {
      filteredEntries = filteredEntries.filter(entry => entry.user === parseInt(selectedUser));
    }
    if (selectedProject) {
      filteredEntries = filteredEntries.filter(entry => entry.task.project === parseInt(selectedProject));
    }

    const totalHoursByUser = {};
    const totalHoursByProject = {};

    filteredEntries.forEach(entry => {
      const userName = users.find(u => u.id === entry.user)?.username || `User ${entry.user}`;
      const projectName = projects.find(p => p.id === entry.task.project)?.name || `Project ${entry.task.project}`;

      totalHoursByUser[userName] = (totalHoursByUser[userName] || 0) + parseFloat(entry.hours);
      totalHoursByProject[projectName] = (totalHoursByProject[projectName] || 0) + parseFloat(entry.hours);
    });

    setReportData({
      totalHoursByUser,
      totalHoursByProject,
    });
  }, [timesheetEntries, selectedUser, selectedProject, users, projects]);

  useEffect(() => {
    generateReport();
  }, [timesheetEntries, selectedUser, selectedProject, users, projects, generateReport]);

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Reporting</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-teal-100 border border-teal-400 text-teal-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      <div className="mb-6 bg-teal-50 p-6 rounded-lg shadow-sm border border-teal-100 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="reportUserSelect" className="block text-gray-700 text-sm font-bold mb-2">
            Filter by User
          </label>
          <select
            id="reportUserSelect"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-200"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="reportProjectSelect" className="block text-gray-700 text-sm font-bold mb-2">
            Filter by Project
          </label>
          <select
            id="reportProjectSelect"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-teal-200"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Generating report...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-teal-50 p-6 rounded-lg shadow-sm border border-teal-100">
            <h4 className="text-xl font-medium text-gray-700 mb-3">Total Hours by User</h4>
            {Object.keys(reportData.totalHoursByUser || {}).length === 0 ? (
              <p className="text-gray-500">No data for selected filters.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(reportData.totalHoursByUser).map(([user, hours]) => (
                  <li key={user} className="flex justify-between items-center text-gray-700">
                    <span>{user}:</span>
                    <span className="font-semibold">{hours.toFixed(2)} hours</span>
                  </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="bg-teal-50 p-6 rounded-lg shadow-sm border border-teal-100">
            <h4 className="text-xl font-medium text-gray-700 mb-3">Total Hours by Project</h4>
            {Object.keys(reportData.totalHoursByProject || {}).length === 0 ? (
              <p className="text-gray-500">No data for selected filters.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(reportData.totalHoursByProject).map(([project, hours]) => (
                  <li key={project} className="flex justify-between items-center text-gray-700">
                    <span>{project}:</span>
                    <span className="font-semibold">{hours.toFixed(2)} hours</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Calendar View Component
function CalendarView({ userId, userRole }) {
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCalendarEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      let tasksUrl = `${API_BASE_URL}/tasks/`;
      let leaveUrl = `${API_BASE_URL}/leave-requests/`;

      if (userRole === 'user') {
        tasksUrl += `?assigned_to=${userId}`;
        leaveUrl += `?user=${userId}`;
      }

      const [tasksResponse, leaveResponse] = await Promise.all([
        authenticatedFetch(tasksUrl, { method: 'GET' }),
        authenticatedFetch(leaveUrl, { method: 'GET' }),
      ]);

      let fetchedEvents = [];

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        tasksData.forEach(task => {
          if (task.due_date) {
            fetchedEvents.push({
              id: `task-${task.id}`,
              type: 'task',
              title: task.name,
              date: new Date(task.due_date),
              status: task.status,
              description: task.description,
              project_name: task.project_name,
              assigned_to_username: task.assigned_to_username,
            });
          }
        });
      } else {
        setMessage(`Failed to fetch tasks for calendar: ${tasksResponse.statusText}`);
      }

      if (leaveResponse.ok) {
        const leaveData = await leaveResponse.json();
        leaveData.forEach(request => {
          if (request.is_hourly) {
            fetchedEvents.push({
              id: `leave-${request.id}-${request.start_date}`,
              type: 'leave',
              title: `${request.user_username || 'Your'} Leave (${request.leave_type})`,
              date: new Date(request.start_date),
              status: request.status,
              reason: request.reason,
              is_hourly: true,
              start_time: request.start_time,
              end_time: request.end_time,
            });
          } else {
            let currentDate = new Date(request.start_date);
            const endDate = new Date(request.end_date);
            while (currentDate <= endDate) {
              fetchedEvents.push({
                id: `leave-${request.id}-${currentDate.toISOString().split('T')[0]}`,
                type: 'leave',
                title: `${request.user_username || 'Your'} Leave (${request.leave_type})`,
                date: new Date(currentDate),
                status: request.status,
                reason: request.reason,
                is_hourly: false,
              });
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
      } else {
        setMessage(`Failed to fetch leave requests for calendar: ${leaveResponse.statusText}`);
      }

      setEvents(fetchedEvents);

    } catch (error) {
      console.error('Error fetching calendar events:', error);
      setMessage('Network error while fetching calendar events.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (userId) {
      fetchCalendarEvents();
    }
  }, [userId, fetchCalendarEvents]);

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dayEvents = events.filter(event =>
        event.date.toDateString() === date.toDateString()
      );

      return (
        <div className="flex flex-col items-center justify-center text-xs">
          {dayEvents.map(event => (
            <div
              key={event.id}
              className={`w-full text-center rounded-sm mt-0.5 px-0.5 py-0.5
                ${event.type === 'task' ?
                  (event.status === 'completed' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800') :
                  (event.status === 'approved' ? 'bg-pink-200 text-pink-800' : event.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800')
                }`}
              title={`${event.title} (${event.type === 'task' ? `Status: ${event.status}` :
                (event.is_hourly ? `Status: ${event.status}, ${event.start_time}-${event.end_time}, Reason: ${event.reason}` : `Status: ${event.status}, Reason: ${event.reason}`)
              }`}
            >
              {event.title.split(' ')[0]}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Calendar View</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-orange-100 border border-orange-400 text-orange-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
      <div className="flex justify-center mb-6">
        <Calendar
          onChange={setDate}
          value={date}
          tileContent={tileContent}
          className="rounded-lg shadow-md border border-gray-200 p-4 w-full max-w-xl"
        />
      </div>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Events for {date.toDateString()}</h4>
      {isLoading ? (
        <p className="text-gray-500">Loading events...</p>
      ) : (
        <ul className="space-y-3">
          {events.filter(event => event.date.toDateString() === date.toDateString()).length === 0 ? (
            <p className="text-gray-500">No events on this date.</p>
          ) : (
            events.filter(event => event.date.toDateString() === date.toDateString()).map(event => (
              <li key={event.id} className={`p-3 rounded-lg shadow-sm border
                ${event.type === 'task' ? 'bg-blue-50 border-blue-100' : 'bg-pink-50 border-pink-100'}`}>
                <p className="font-semibold text-lg">
                  {event.title}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
                    ${event.type === 'task' ?
                      (event.status === 'completed' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800') :
                      (event.status === 'approved' ? 'bg-green-200 text-green-800' : event.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800')
                    }`}
                  >
                    {event.status}
                  </span>
                </p>
                {event.type === 'task' && (
                  <>
                    <p className="text-gray-600 text-sm">Project: {event.project_name}</p>
                    <p className="text-gray-600 text-sm">Assigned To: {event.assigned_to_username}</p>
                    <p className="text-gray-600 text-sm">Description: {event.description}</p>
                  </>
                )}
                {event.type === 'leave' && (
                  <>
                    {event.is_hourly && (
                      <p className="text-gray-600 text-sm">Time: {event.start_time} - {event.end_time}</p>
                    )}
                    <p className="text-gray-600 text-sm">Reason: {event.reason}</p>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// Timesheet Entry Component (User) - Week View
function TimesheetEntry({ userId, openConfirmModal }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const [weekDates, setWeekDates] = useState([]);
  const [timesheetEntriesMap, setTimesheetEntriesMap] = useState({});
  const [userTasks, setUserTasks] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const saveTimeoutRef = useRef(null);

  const fetchWeeklyTimesheets = useCallback(async (weekStartDate) => {
    setIsLoading(true);
    setMessage('');
    const dates = getWeekDates(weekStartDate);
    setWeekDates(dates);

    const startDateStr = formatDate(dates[0]);
    const endDateStr = formatDate(dates[6]);

    try {
      const tasksResponse = await authenticatedFetch(`${API_BASE_URL}/tasks/?assigned_to=${userId}`, {
        method: 'GET',
      });
      let fetchedTasks = [];
      if (tasksResponse.ok) {
        fetchedTasks = await tasksResponse.json();
        setUserTasks(fetchedTasks);
      } else {
        const errorData = await tasksResponse.json();
        setMessage(`Failed to fetch tasks: ${errorData.detail || 'Unknown error'}`);
      }

      const entriesResponse = await authenticatedFetch(`${API_BASE_URL}/timesheets/?user=${userId}&start_date=${startDateStr}&end_date=${endDateStr}`, {
        method: 'GET',
      });
      let fetchedEntries = [];
      if (entriesResponse.ok) {
        fetchedEntries = await entriesResponse.json();
      } else {
        const errorData = await entriesResponse.json();
        setMessage(`Failed to fetch timesheet entries: ${errorData.detail || 'Unknown error'}`);
      }

      const newEntriesMap = {};
      fetchedEntries.forEach(entry => {
        if (!newEntriesMap[entry.task]) {
          newEntriesMap[entry.task] = {};
        }
        newEntriesMap[entry.task][entry.date] = entry;
      });
      setTimesheetEntriesMap(newEntriesMap);

    } catch (error) {
      console.error('Error fetching weekly timesheet data:', error);
      setMessage('Network error while fetching timesheet data.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchWeeklyTimesheets(currentWeekStart);
    }
  }, [userId, currentWeekStart, fetchWeeklyTimesheets]);

  const handleHoursChange = (taskId, dateString, hoursInput) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const newHours = parseFloat(hoursInput) || 0;
    setTimesheetEntriesMap(prevMap => {
      const newMap = { ...prevMap };
      if (!newMap[taskId]) {
        newMap[taskId] = {};
      }
      newMap[taskId][dateString] = {
        ...newMap[taskId][dateString],
        task: taskId,
        date: dateString,
        hours: newHours,
        user: userId,
      };
      return newMap;
    });

    saveTimeoutRef.current = setTimeout(async () => {
      const entryToSave = timesheetEntriesMap[taskId]?.[dateString] || {
        task: taskId,
        date: dateString,
        hours: newHours,
        user: userId,
      };

      if (entryToSave.hours <= 0 && entryToSave.id) {
        openConfirmModal('Hours are 0. Do you want to delete this timesheet entry?', async () => {
          try {
            const response = await authenticatedFetch(`${API_BASE_URL}/timesheets/${entryToSave.id}/`, {
              method: 'DELETE',
            });
            if (response.ok) {
              setMessage('Entry deleted successfully.');
              fetchWeeklyTimesheets(currentWeekStart);
            } else {
              const errorData = await response.json();
              setMessage(`Failed to delete entry: ${errorData.detail || 'Unknown error'}`);
            }
          } catch (error) {
            setMessage('Network error deleting entry.');
          }
        });
        return;
      } else if (entryToSave.hours <= 0 && !entryToSave.id) {
        return;
      }

      setIsLoading(true);
      try {
        let response;
        if (entryToSave.id) {
          response = await authenticatedFetch(`${API_BASE_URL}/timesheets/${entryToSave.id}/`, {
            method: 'PUT',
            body: JSON.stringify(entryToSave),
          });
        } else {
          response = await authenticatedFetch(`${API_BASE_URL}/timesheets/`, {
            method: 'POST',
            body: JSON.stringify(entryToSave),
          });
        }

        if (response.ok) {
          const savedEntry = await response.json();
          setMessage('Timesheet entry saved!');
          setTimesheetEntriesMap(prevMap => {
            const newMap = { ...prevMap };
            if (!newMap[taskId]) {
              newMap[taskId] = {};
            }
            newMap[taskId][dateString] = savedEntry;
            return newMap;
          });
        } else {
          const errorData = await response.json();
          setMessage(`Failed to save entry: ${errorData.non_field_errors || errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error saving timesheet entry:', error);
        setMessage('Network error while saving timesheet entry.');
      } finally {
        setIsLoading(false);
        setTimeout(() => setMessage(''), 5000);
      }
    }, 1000);
  };

  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const getWeekRangeString = () => {
    if (weekDates.length === 0) return 'Loading Week...';
    const start = weekDates[0];
    const end = weekDates[6];
    const options = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  };

  const getDayName = (date) => {
    const options = { weekday: 'short' };
    return date.toLocaleDateString('en-US', options);
  };

  const getDailyTotal = (dateString) => {
    let total = 0;
    userTasks.forEach(task => {
      const entry = timesheetEntriesMap[task.id]?.[dateString];
      if (entry && entry.hours) {
        total += parseFloat(entry.hours);
      }
    });
    return total.toFixed(2);
  };

  const getTaskRowTotal = (taskId) => {
    let total = 0;
    weekDates.forEach(date => {
      const dateString = formatDate(date);
      const entry = timesheetEntriesMap[taskId]?.[dateString];
      if (entry && entry.hours) {
        total += parseFloat(entry.hours);
      }
    });
    return total.toFixed(2);
  };

  const getGrandTotal = () => {
    let grandTotal = 0;
    userTasks.forEach(task => {
      grandTotal += parseFloat(getTaskRowTotal(task.id));
    });
    return grandTotal.toFixed(2);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <h3 className="text-2xl font-medium text-gray-700 mb-4">Timesheet Week View</h3>
      {message && (
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') || message.includes('saved') ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
        <button
          onClick={handlePreviousWeek}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300"
          disabled={isLoading}
        >
          &larr; Previous Week
        </button>
        <h4 className="text-xl font-semibold text-gray-800">{getWeekRangeString()}</h4>
        <button
          onClick={handleNextWeek}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300"
          disabled={isLoading}
        >
          Next Week &rarr;
        </button>
      </div>

      {isLoading && userTasks.length === 0 && Object.keys(timesheetEntriesMap).length === 0 ? (
        <p className="text-gray-500 text-center py-8">Loading timesheet data...</p>
      ) : userTasks.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No tasks assigned to you for this week. Please check your assigned tasks or try a different week.</p>
      ) : (
        <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th scope="col" className="py-3 px-6 min-w-[200px]">Task / Project</th>
                <th scope="col" className="py-3 px-6 text-center">Status</th>
                {weekDates.map((date, index) => (
                  <th key={index} scope="col" className="py-3 px-6 text-center">
                    {getDayName(date)}<br/>{date.getDate()}
                  </th>
                ))}
                <th scope="col" className="py-3 px-6 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {userTasks.map(task => (
                <tr key={task.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <th scope="row" className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    <p className="font-semibold text-base">{task.name}</p>
                    <p className="text-xs text-gray-500">{task.project_name}</p>
                  </th>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      task.status === 'completed' ? 'bg-green-200 text-green-800' :
                      task.status === 'in_progress' ? 'bg-blue-200 text-blue-800' :
                      'bg-yellow-200 text-yellow-800'
                    }`}>
                      {task.status === 'completed' ? 'Approved' : task.status.replace('_', ' ')}
                    </span>
                  </td>
                  {weekDates.map((date, index) => {
                    const dateString = formatDate(date);
                    const entry = timesheetEntriesMap[task.id]?.[dateString];
                    return (
                      <td key={index} className="py-4 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={entry?.hours || ''}
                          onChange={(e) => handleHoursChange(task.id, dateString, e.target.value)}
                          className="w-20 p-2 border rounded-md text-center focus:ring-blue-300 focus:border-blue-300 transition duration-150"
                          disabled={isLoading}
                        />
                      </td>
                    );
                  })}
                  <td className="py-4 px-6 text-center font-bold text-gray-900 dark:text-white">
                    {getTaskRowTotal(task.id)}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-200 dark:bg-gray-700 text-gray-700 uppercase font-bold">
                <td className="py-3 px-6">Total</td>
                <td className="py-3 px-6 text-center"></td>
                {weekDates.map((date, index) => (
                  <td key={index} className="py-3 px-6 text-center">
                    {getDailyTotal(formatDate(date))}
                  </td>
                ))}
                <td className="py-3 px-6 text-center">{getGrandTotal()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Leave Request Component (User)
function LeaveRequest({ userId, openConfirmModal }) {
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
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/?user=${userId}`, {
        method: 'GET',
      });
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data);
      } else {
        const errorData = await response.json();
        setMessage(`Failed to fetch leave requests: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      setMessage('Network error while fetching leave requests.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchLeaveRequests();
    }
  }, [userId, fetchLeaveRequests]);

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

    setIsLoading(true);
    try {
      const payload = {
        leave_type: leaveType,
        start_date: startDate,
        end_date: isHourly ? startDate : endDate,
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
        setMessage(`Failed to submit leave request: ${errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      setMessage('Network error while submitting leave request.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleEditLeaveRequest = (request) => {
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

    setIsLoading(true);
    try {
      const payload = {
        leave_type: leaveType,
        start_date: startDate,
        end_date: isHourly ? startDate : endDate,
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
        setMessage(`Failed to update leave request: ${errorData.detail || JSON.stringify(errorData) || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating leave request:', error);
      setMessage('Network error while updating leave request.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleDeleteLeaveRequest = (requestId) => {
    openConfirmModal('Are you sure you want to delete this leave request? This action cannot be undone.', async () => {
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/leave-requests/${requestId}/`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage('Leave request deleted successfully!');
          fetchLeaveRequests();
        } else {
          const errorData = await response.json();
          setMessage(`Failed to delete leave request: ${errorData.detail || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting leave request:', error);
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
        <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successfully') ? 'bg-pink-100 border border-pink-400 text-pink-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200"
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
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200"
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
                className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200"
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
                className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200"
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
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-pink-200"
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
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            disabled={isLoading || (editingRequest && editingRequest.status !== 'pending')}
          >
            {isLoading ? (editingRequest ? 'Updating...' : 'Submitting...') : (editingRequest ? 'Update Request' : 'Submit Request')}
          </button>
          {editingRequest && (
            <button
              type="button"
              onClick={() => { setEditingRequest(null); setLeaveType('sick'); setStartDate(''); setEndDate(''); setReason(''); setIsHourly(false); setStartTime(''); setEndTime(''); }}
              className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              disabled={isLoading}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <h4 className="text-xl font-medium text-gray-700 mb-3">Your Leave Requests</h4>
      {isLoading && leaveRequests.length === 0 ? (
        <p className="text-gray-500">Loading leave requests...</p>
      ) : leaveRequests.length === 0 ? (
        <p className="text-gray-500">No leave requests submitted yet. Submit one above!</p>
      ) : (
        <ul className="space-y-4">
          {leaveRequests.map((request) => (
            <li key={request.id} className="bg-pink-50 p-4 rounded-lg shadow-sm border border-pink-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-2 sm:mb-0">
                <p className="font-semibold text-lg text-pink-800">
                    {request.leave_type}
                    {request.is_hourly && ` (${request.start_time} - ${request.end_time})`}
                </p>
                <p className="text-gray-600 text-sm">
                  {request.start_date} {request.is_hourly ? '' : `to ${request.end_date}`}
                </p>
                <p className="text-gray-600 text-sm italic">Reason: {request.reason}</p>
                <p className="text-gray-600 text-sm">Status:
                  <span
                    className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold ${
                      request.status === 'approved' ? 'bg-green-200 text-green-800' :
                      request.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-red-200 text-red-800'
                    }`}
                  >
                    {request.status}
                  </span>
                </p>
                {request.admin_comments && <p className="text-gray-600 text-sm">Admin Comments: {request.admin_comments}</p>}
                {request.approved_by_username && <p className="text-gray-600 text-sm">Approved By: {request.approved_by_username}</p>}
              </div>
              <div className="flex space-x-2 mt-2 sm:mt-0">
                {request.status === 'pending' && (
                  <button
                    onClick={() => handleEditLeaveRequest(request)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300 text-sm"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDeleteLeaveRequest(request.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 text-sm"
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

// --- DASHBOARD COMPONENTS (DEFINED AFTER THEIR CHILDREN) ---

// User Dashboard Component
function UserDashboard({ userId, openConfirmModal }) {
  const [activeTab, setActiveTab] = useState('timesheets');

  return (
    <div className="p-6">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">User Dashboard</h2>
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'timesheets'
              ? 'bg-yellow-200 text-yellow-800 border-b-4 border-yellow-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('timesheets')}
        >
          Timesheets
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'leave'
              ? 'bg-pink-200 text-pink-800 border-b-4 border-pink-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('leave')}
        >
          Leave Requests
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'calendar'
              ? 'bg-orange-200 text-orange-800 border-b-4 border-orange-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar View
        </button>
      </div>

      {activeTab === 'timesheets' ? (
        <TimesheetEntry userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'leave' ? (
        <LeaveRequest userId={userId} openConfirmModal={openConfirmModal} />
      ) : (
        <CalendarView userId={userId} userRole="user" />
      )}
    </div>
  );
}


// Admin Dashboard Component
function AdminDashboard({ userId, openConfirmModal }) {
  const [activeTab, setActiveTab] = useState('projects');

  return (
    <div className="p-6">
      <h2 className="text-3xl font-semibold text-gray-700 mb-6">Admin Dashboard</h2>
      <div className="flex flex-wrap border-b border-gray-200 mb-6">
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'projects'
              ? 'bg-blue-200 text-blue-800 border-b-4 border-blue-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('projects')}
        >
          Project Management
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'tasks'
              ? 'bg-green-200 text-green-800 border-b-4 border-green-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('tasks')}
        >
          Task Assignment
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'users'
              ? 'bg-purple-200 text-purple-800 border-b-4 border-purple-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'leave-approval'
              ? 'bg-red-200 text-red-800 border-b-4 border-red-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('leave-approval')}
        >
          Leave Approval
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'reporting'
              ? 'bg-teal-200 text-teal-800 border-b-4 border-teal-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('reporting')}
        >
          Reporting
        </button>
        <button
          className={`py-3 px-6 text-lg font-medium rounded-t-lg transition duration-300 ${
            activeTab === 'calendar'
              ? 'bg-orange-200 text-orange-800 border-b-4 border-orange-500'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar View
        </button>
      </div>

      {activeTab === 'projects' ? (
        <ProjectManagement userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'tasks' ? (
        <TaskAssignment userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'users' ? (
        <UserManagement userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'leave-approval' ? (
        <LeaveApproval userId={userId} openConfirmModal={openConfirmModal} />
      ) : activeTab === 'reporting' ? (
        <Reporting userId={userId} />
      ) : (
        <CalendarView userId={userId} userRole="admin" />
      )}
    </div>
  );
}


// --- MAIN APP COMPONENT (DEFINED LAST) ---

// Main App Component - Defined last as per best practice for clarity and bundling
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState('login'); // 'login', 'register', 'admin-login', 'admin', 'user'
  const [message, setMessage] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalConfirmAction, setModalConfirmAction] = useState(null);

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


  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const storedUserRole = localStorage.getItem('user_role');
    const storedUserId = localStorage.getItem('user_id');

    if (accessToken && storedUserRole && storedUserId) {
      setIsAuthenticated(true);
      setUserRole(storedUserRole);
      setUserId(parseInt(storedUserId));
      setCurrentPage(storedUserRole === 'admin' ? 'admin' : 'user');
    } else {
      setIsAuthenticated(false);
      setUserRole(null);
      setUserId(null);
      setCurrentPage('login');
    }
  }, []);

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
      const response = await authenticatedFetch(`${API_BASE_URL}/logout/`, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        setIsAuthenticated(false);
        setUserRole(null);
        setUserId(null);
        setCurrentPage('login');
        setMessage('Logout successful!');
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

  const renderContent = () => {
    if (!isAuthenticated) {
      if (currentPage === 'register') {
        return <Register onRegisterSuccess={handleRegisterSuccess} onGoToLogin={() => setCurrentPage('login')} />;
      } else if (currentPage === 'admin-login') {
        return <AdminLogin onLogin={handleLogin} onGoToRegularLogin={() => setCurrentPage('login')} />;
      } else { // currentPage === 'login'
        return <Login onLogin={handleLogin} onGoToRegister={() => setCurrentPage('register')} onGoToAdminLogin={() => setCurrentPage('admin-login')} />;
      }
    } else if (userRole === 'admin') {
      return <AdminDashboard userId={userId} openConfirmModal={openConfirmModal} />;
    } else {
      return <UserDashboard userId={userId} openConfirmModal={openConfirmModal} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">WorkLog</h1>
        {isAuthenticated && (
          <nav className="flex items-center space-x-4">
            <span className="text-gray-700 font-medium">Logged in as: {userRole === 'admin' ? 'Admin' : 'User'} (ID: {userId})</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 shadow-md"
            >
              Logout
            </button>
          </nav>
        )}
      </header>
      <main className="container mx-auto p-4 py-8">
        {message && (
          <div className={`px-4 py-3 rounded relative mb-4 ${message.includes('successful') ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`} role="alert">
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
