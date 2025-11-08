import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Request interceptor to add JWT token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expired or invalid - clear localStorage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      // Only redirect if we're in the browser (not in extension)
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const login = async (username, password) => {
  try {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const signup = async (username, password) => {
  try {
    const response = await api.post('/auth/signup', { username, password });
    return response.data;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  } catch (error) {
    console.error('Error logging out:', error);
    // Clear localStorage anyway
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
};

// Thought API calls
export const saveThought = async (thoughtData) => {
  try {
    const response = await api.post('/saveThought', thoughtData);
    return response.data;
  } catch (error) {
    console.error('Error saving thought:', error);
    throw error;
  }
};

export const getThoughts = async () => {
  try {
    const response = await api.get('/thoughts');
    return response.data;
  } catch (error) {
    console.error('Error fetching thoughts:', error);
    throw error;
  }
};

export const deleteThought = async (thoughtId) => {
  try {
    const response = await api.delete(`/thoughts/${thoughtId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting thought:', error);
    throw error;
  }
};

export const searchThoughts = async (query, filters = {}, limit = 20) => {
  try {
    const params = {
      q: query || '',
      limit,
      ...filters
    };
    // Only include non-null/undefined/empty values in params
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '' || params[key] === 'all') {
        delete params[key];
      }
    });
    const response = await api.get('/search', { params });
    return response.data;
  } catch (error) {
    console.error('Error searching thoughts:', error);
    throw error;
  }
};

export const uploadFile = async (file, data) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', data.title || file.name);
    formData.append('type', data.type);
    formData.append('reason', data.reason || '');
    formData.append('topicUser', JSON.stringify(data.topicUser || []));
    formData.append('topicAuto', data.topicAuto || 'general');
    if (data.description) {
      formData.append('description', data.description);
    }
    // Include pageText for PDFs and documents (extracted text)
    if (data.pageText) {
      formData.append('pageText', data.pageText);
    }

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Unified reason options (matching server)
export const REASON_OPTIONS = [
  'to view later',
  'to read later',
  'to buy later',
  'to watch later',
  'to research later',
  'important reference',
  'personal note'
];

export const DEFAULT_REASON = 'to view later';