/**
 * Authentication service for Ba_db Business Management System
 */
import api from './api';

const AUTH_BASE = '/auth';

const authService = {
  /**
   * Login with username and password
   * Returns { access, refresh, user: { id, username, email, role } }
   */
  login: async (username, password) => {
    const response = await api.post(`${AUTH_BASE}/login/`, { username, password });
    return response.data;
  },

  /**
   * Revoke refresh token on logout.
   */
  logout: async (refreshToken) => {
    if (!refreshToken) return null;
    const response = await api.post(`${AUTH_BASE}/logout/`, { refresh: refreshToken }, { skipAuth: true });
    return response.data;
  },

  /**
   * Register new user
   */
  register: async ({ username, email, password, confirm_password, role }) => {
    const response = await api.post(`${AUTH_BASE}/register/`, {
      username,
      email,
      password,
      confirm_password,
      role,
    });
    return response.data;
  },

  /**
   * Get current user profile
   */
  getProfile: async () => {
    const response = await api.get(`${AUTH_BASE}/profile/`);
    return response.data;
  },

  /**
   * Update current user profile
   */
  updateProfile: async (data) => {
    const response = await api.patch(`${AUTH_BASE}/profile/update/`, data);
    return response.data;
  },

  /**
   * Change password
   */
  changePassword: async ({ old_password, new_password, confirm_new_password }) => {
    const response = await api.post(`${AUTH_BASE}/change-password/`, {
      old_password,
      new_password,
      confirm_new_password,
    });
    return response.data;
  },

  /**
   * Admin: Get all users
   */
  getUsers: async () => {
    const response = await api.get(`${AUTH_BASE}/users/`);
    return response.data;
  },

  /**
   * Admin: Update user
   */
  updateUser: async (id, data) => {
    const response = await api.patch(`${AUTH_BASE}/users/${id}/`, data);
    return response.data;
  },

  /**
   * Admin: Delete user
   */
  deleteUser: async (id) => {
    const response = await api.delete(`${AUTH_BASE}/users/${id}/`);
    return response.data;
  },
};

export default authService;
