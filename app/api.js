/**
 * SocietyFlow API Client
 * Centralized API helper for communicating with the backend
 */

// API Configuration
const API_CONFIG = {
  BASE_URL: 'http://localhost:3000/api/v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Token storage keys
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'sf_access_token',
  REFRESH_TOKEN: 'sf_refresh_token',
  USER_PROFILE: 'sf_user_profile',
  CURRENT_SOCIETY: 'sf_current_society',
};

/**
 * API Helper Class
 */
class APIClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.isRefreshing = false;
    this.refreshSubscribers = [];
  }

  /**
   * Get access token from storage
   */
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get refresh token from storage
   */
  getRefreshToken() {
    return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
  }

  /**
   * Store tokens in localStorage
   */
  setTokens(accessToken, refreshToken) {
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
    }
  }

  /**
   * Store user profile
   */
  setUserProfile(user) {
    localStorage.setItem(TOKEN_KEYS.USER_PROFILE, JSON.stringify(user));
  }

  /**
   * Get user profile
   */
  getUserProfile() {
    const profile = localStorage.getItem(TOKEN_KEYS.USER_PROFILE);
    return profile ? JSON.parse(profile) : null;
  }

  /**
   * Get current society ID
   */
  getCurrentSociety() {
    return localStorage.getItem(TOKEN_KEYS.CURRENT_SOCIETY);
  }

  /**
   * Set current society ID
   */
  setCurrentSociety(societyId) {
    localStorage.setItem(TOKEN_KEYS.CURRENT_SOCIETY, societyId);
  }

  /**
   * Clear all authentication data
   */
  clearAuth() {
    localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_KEYS.USER_PROFILE);
    localStorage.removeItem(TOKEN_KEYS.CURRENT_SOCIETY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getAccessToken();
  }

  /**
   * Get the correct path to the login page (works on GitHub Pages and locally)
   */
  _getLoginPath() {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/SocietyFlow/')) {
      return '/SocietyFlow/app/login.html';
    }
    return '/app/login.html';
  }

  /**
   * Redirect to login if not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = this._getLoginPath();
      return false;
    }
    return true;
  }

  /**
   * Build request headers
   */
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Handle token refresh
   */
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.setTokens(data.data.accessToken, data.data.refreshToken);
      return data.data.accessToken;
    } catch (error) {
      this.clearAuth();
      window.location.href = this._getLoginPath();
      throw error;
    }
  }

  /**
   * Handle refresh token queue
   */
  onAccessTokenRefreshed(accessToken) {
    this.refreshSubscribers.forEach((callback) => callback(accessToken));
    this.refreshSubscribers = [];
  }

  /**
   * Add subscriber to token refresh queue
   */
  addRefreshSubscriber(callback) {
    this.refreshSubscribers.push(callback);
  }

  /**
   * Make API request with automatic retry and token refresh
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      includeAuth = true,
      retry = 0,
    } = options;

    const url = `${this.baseURL}${endpoint}`;
    const headers = this.getHeaders(includeAuth);

    const requestOptions = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);

      // Handle 401 Unauthorized - token expired
      if (response.status === 401 && includeAuth && retry === 0) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const newAccessToken = await this.refreshAccessToken();
            this.isRefreshing = false;
            this.onAccessTokenRefreshed(newAccessToken);
            // Retry the original request with new token
            return this.request(endpoint, { ...options, retry: retry + 1 });
          } catch (refreshError) {
            this.isRefreshing = false;
            throw refreshError;
          }
        } else {
          // Wait for token refresh to complete
          return new Promise((resolve, reject) => {
            this.addRefreshSubscriber(() => {
              this.request(endpoint, { ...options, retry: retry + 1 })
                .then(resolve)
                .catch(reject);
            });
          });
        }
      }

      // Parse response
      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'Request failed',
          errors: data.errors || [],
        };
      }

      return data;
    } catch (error) {
      // Network error or other issues
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw {
          status: 0,
          message: 'Network error. Please check your connection.',
          errors: [],
        };
      }
      throw error;
    }
  }

  /**
   * Convenience methods for HTTP verbs
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // ==================== LOCAL STORAGE FALLBACK (offline/demo mode) ====================

  /**
   * Check if an error is a network connectivity error (backend unreachable)
   */
  _isNetworkError(error) {
    return error && error.status === 0;
  }

  /**
   * Get all locally stored users
   */
  _getLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem('sf_local_users') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Save users to local storage
   */
  _saveLocalUsers(users) {
    localStorage.setItem('sf_local_users', JSON.stringify(users));
  }

  /**
   * Generate a simple local session token
   */
  _generateLocalToken(userId) {
    const payload = { userId, t: Date.now() };
    return 'local_' + btoa(JSON.stringify(payload));
  }

  /**
   * Register a user locally (fallback when API is unavailable).
   * NOTE: Passwords are stored in localStorage for offline/demo mode only.
   * This is NOT suitable for production - use the backend API for real deployments.
   */
  _localRegister(userData) {
    const users = this._getLocalUsers();
    if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw { status: 409, message: 'Email already registered', errors: [] };
    }
    const newUser = {
      id: 'local_' + Date.now(),
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role || 'RESIDENT',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    this._saveLocalUsers(users);
    return { user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } };
  }

  /**
   * Authenticate a user locally (fallback when API is unavailable).
   * NOTE: Password comparison uses plain text stored in localStorage (offline/demo mode only).
   * This is NOT suitable for production - use the backend API for real deployments.
   */
  _localLogin(email, password) {
    const users = this._getLocalUsers();
    const user = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) {
      throw { status: 401, message: 'Invalid email or password', errors: [] };
    }
    const token = this._generateLocalToken(user.id);
    return {
      accessToken: token,
      refreshToken: token + '_r',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  /**
   * Get societies for the current user from local storage
   */
  _getLocalSocieties(userId) {
    try {
      const all = JSON.parse(localStorage.getItem('sf_local_societies') || '[]');
      return all.filter(s => s.userId === userId);
    } catch (e) {
      return [];
    }
  }

  /**
   * Save a new society to local storage
   */
  _saveLocalSociety(society, userId) {
    try {
      const all = JSON.parse(localStorage.getItem('sf_local_societies') || '[]');
      all.push({ ...society, userId });
      localStorage.setItem('sf_local_societies', JSON.stringify(all));
    } catch (e) {}
  }

  /**
   * Delete a society from local storage
   */
  _deleteLocalSociety(societyId, userId) {
    try {
      const all = JSON.parse(localStorage.getItem('sf_local_societies') || '[]');
      const updated = all.filter(s => !(s.id === societyId && s.userId === userId));
      localStorage.setItem('sf_local_societies', JSON.stringify(updated));
    } catch (e) {}
  }

  // ==================== AUTH ENDPOINTS ====================

  /**
   * User registration
   */
  async register(userData) {
    try {
      const response = await this.post('/auth/register', userData, { includeAuth: false });
      return response.data;
    } catch (error) {
      if (this._isNetworkError(error)) {
        return this._localRegister(userData);
      }
      throw error;
    }
  }

  /**
   * User login
   */
  async login(email, password) {
    try {
      const response = await this.post('/auth/login', { email, password }, { includeAuth: false });
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      this.setUserProfile(response.data.user);
      return response.data;
    } catch (error) {
      if (this._isNetworkError(error)) {
        const data = this._localLogin(email, password);
        this.setTokens(data.accessToken, data.refreshToken);
        this.setUserProfile(data.user);
        return data;
      }
      throw error;
    }
  }

  /**
   * User logout
   */
  async logout() {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await this.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
      window.location.href = this._getLoginPath();
    }
  }

  // ==================== SOCIETY ENDPOINTS ====================

  /**
   * Get all societies for current user
   */
  async getSocieties() {
    try {
      const response = await this.get('/societies');
      return response.data;
    } catch (error) {
      if (this._isNetworkError(error)) {
        const user = this.getUserProfile();
        return user ? this._getLocalSocieties(user.id) : [];
      }
      throw error;
    }
  }

  /**
   * Get specific society by ID
   */
  async getSociety(societyId) {
    const response = await this.get(`/societies/${societyId}`);
    return response.data;
  }

  /**
   * Create new society
   */
  async createSociety(societyData) {
    try {
      const response = await this.post('/societies', societyData);
      return response.data;
    } catch (error) {
      if (this._isNetworkError(error)) {
        const user = this.getUserProfile();
        const addressParts = (societyData.address || '').split(',');
        const newSociety = {
          id: 'local_' + Date.now(),
          name: societyData.name,
          address: societyData.address || '',
          city: addressParts[0] ? addressParts[0].trim() : '',
          state: addressParts[1] ? addressParts[1].trim() : '',
          totalUnits: societyData.totalUnits || 0,
          units: societyData.totalUnits || 0,
          contactEmail: societyData.contactEmail || '',
          contactPhone: societyData.contactPhone || '',
          _count: { members: 0 },
          createdAt: new Date().toISOString(),
        };
        if (user) {
          this._saveLocalSociety(newSociety, user.id);
        }
        return newSociety;
      }
      throw error;
    }
  }

  /**
   * Update society
   */
  async updateSociety(societyId, societyData) {
    const response = await this.put(`/societies/${societyId}`, societyData);
    return response.data;
  }

  /**
   * Delete society
   */
  async deleteSociety(societyId) {
    try {
      const response = await this.delete(`/societies/${societyId}`);
      return response.data;
    } catch (error) {
      if (this._isNetworkError(error)) {
        const user = this.getUserProfile();
        if (user) {
          this._deleteLocalSociety(societyId, user.id);
        }
        return {};
      }
      throw error;
    }
  }

  // ==================== MEMBER ENDPOINTS ====================

  /**
   * Get all members for a society
   */
  async getMembers(societyId) {
    const response = await this.get(`/societies/${societyId}/members`);
    return response.data;
  }

  /**
   * Get specific member
   */
  async getMember(societyId, memberId) {
    const response = await this.get(`/societies/${societyId}/members/${memberId}`);
    return response.data;
  }

  /**
   * Create new member
   */
  async createMember(societyId, memberData) {
    const response = await this.post(`/societies/${societyId}/members`, memberData);
    return response.data;
  }

  /**
   * Update member
   */
  async updateMember(societyId, memberId, memberData) {
    const response = await this.put(`/societies/${societyId}/members/${memberId}`, memberData);
    return response.data;
  }

  /**
   * Delete member
   */
  async deleteMember(societyId, memberId) {
    const response = await this.delete(`/societies/${societyId}/members/${memberId}`);
    return response.data;
  }

  // ==================== BILLING ENDPOINTS ====================

  /**
   * Get billing configuration
   */
  async getBillingConfig(societyId) {
    const response = await this.get(`/societies/${societyId}/billing`);
    return response.data;
  }

  /**
   * Create billing head
   */
  async createBillingHead(societyId, billingData) {
    const response = await this.post(`/societies/${societyId}/billing`, billingData);
    return response.data;
  }

  /**
   * Update billing head
   */
  async updateBillingHead(societyId, billingHeadId, billingData) {
    const response = await this.put(`/societies/${societyId}/billing/${billingHeadId}`, billingData);
    return response.data;
  }

  /**
   * Delete billing head
   */
  async deleteBillingHead(societyId, billingHeadId) {
    const response = await this.delete(`/societies/${societyId}/billing/${billingHeadId}`);
    return response.data;
  }

  // ==================== INVOICE ENDPOINTS ====================

  /**
   * Get all invoices for a society
   */
  async getInvoices(societyId, filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = `/societies/${societyId}/invoices${queryParams ? `?${queryParams}` : ''}`;
    const response = await this.get(endpoint);
    return response.data;
  }

  /**
   * Get specific invoice
   */
  async getInvoice(societyId, invoiceId) {
    const response = await this.get(`/societies/${societyId}/invoices/${invoiceId}`);
    return response.data;
  }

  /**
   * Generate invoices for a period
   */
  async generateInvoices(societyId, invoiceData) {
    const response = await this.post(`/societies/${societyId}/invoices/generate`, invoiceData);
    return response.data;
  }

  /**
   * Record payment for invoice
   */
  async recordPayment(societyId, invoiceId, paymentData) {
    const response = await this.post(`/societies/${societyId}/invoices/${invoiceId}/payments`, paymentData);
    return response.data;
  }

  // ==================== NOTIFICATION ENDPOINTS ====================

  /**
   * Send notification
   */
  async sendNotification(societyId, notificationData) {
    const response = await this.post(`/societies/${societyId}/notifications`, notificationData);
    return response.data;
  }

  /**
   * Get notification history
   */
  async getNotifications(societyId, filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = `/societies/${societyId}/notifications${queryParams ? `?${queryParams}` : ''}`;
    const response = await this.get(endpoint);
    return response.data;
  }
}

// Create and export singleton instance
const api = new APIClient();

// Export for use in HTML pages
if (typeof window !== 'undefined') {
  window.api = api;
  window.API_CONFIG = API_CONFIG;
  window.TOKEN_KEYS = TOKEN_KEYS;
}

// Also export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, APIClient, API_CONFIG, TOKEN_KEYS };
}
