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

// Demo accounts used as a fallback when the backend API is unreachable.
// These credentials mirror those shown publicly on the landing page (index.html)
// and are intentionally not secret — they exist solely to demo the UI on static hosting.
const DEMO_ACCOUNTS = [
  {
    email: 'demo@society.com',
    password: 'Demo@123',
    user: {
      id: 'demo-admin-001',
      name: 'Demo Admin',
      email: 'demo@society.com',
      role: 'SOCIETY_ADMIN',
      isActive: true,
    },
  },
  {
    email: 'resident@society.com',
    password: 'Demo@123',
    user: {
      id: 'demo-resident-001',
      name: 'Demo Resident',
      email: 'resident@society.com',
      role: 'RESIDENT',
      isActive: true,
    },
  },
];

const DEMO_TOKEN_PREFIX = 'demo-offline-';

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
   * Check if running in demo mode (backend unavailable, using local demo credentials)
   */
  isDemoMode() {
    const token = this.getAccessToken();
    return !!(token && token.startsWith(DEMO_TOKEN_PREFIX));
  }

  /**
   * Redirect to login if not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/app/login.html';
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
      window.location.href = '/app/login.html';
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

  // ==================== AUTH ENDPOINTS ====================

  /**
   * User registration
   */
  async register(userData) {
    const response = await this.post('/auth/register', userData, { includeAuth: false });
    return response.data;
  }

  /**
   * User login
   */
  async login(email, password) {
    try {
      const response = await this.post('/auth/login', { email, password }, { includeAuth: false });

      // Store tokens and user profile
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      this.setUserProfile(response.data.user);

      return response.data;
    } catch (error) {
      // When the backend API is unreachable (network error), fall back to demo credentials
      if (error.status === 0 || error.status === undefined) {
        const demoAccount = DEMO_ACCOUNTS.find(
          (acc) => acc.email === email && acc.password === password
        );
        if (demoAccount) {
          // Use a cryptographically random value when available so the token is
          // not guessable, even though it is only used locally for UI demo purposes.
          const randomSuffix =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : Date.now().toString(36) + Math.random().toString(36).slice(2);
          const demoToken = DEMO_TOKEN_PREFIX + randomSuffix;
          this.setTokens(demoToken, demoToken);
          this.setUserProfile(demoAccount.user);
          return { user: demoAccount.user, accessToken: demoToken };
        }
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
      window.location.href = '/app/login.html';
    }
  }

  // ==================== SOCIETY ENDPOINTS ====================

  /**
   * Get all societies for current user
   */
  async getSocieties() {
    // In demo mode the backend is unreachable, so return an empty list.
    // The dashboard handles this gracefully by showing the "Add Society" prompt.
    if (this.isDemoMode()) {
      return [];
    }
    const response = await this.get('/societies');
    return response.data;
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
    const response = await this.post('/societies', societyData);
    return response.data;
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
    const response = await this.delete(`/societies/${societyId}`);
    return response.data;
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
