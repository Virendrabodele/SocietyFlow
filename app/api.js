/**
 * SocietyFlow API Client
 * Centralized API helper for communicating with the backend
 */

// ─── FIX 1: Use config.js baseURL instead of hardcoded localhost ───
// CONFIG is loaded by config.js which is included before api.js in every HTML page
const API_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.api && CONFIG.api.baseURL)
  ? CONFIG.api.baseURL
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/v1'
      : 'https://societyflow-api.onrender.com'); // ← UPDATE with your Render URL

const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Demo accounts used as a fallback when the backend API is unreachable.
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
  // ─── FIX 2: Add master admin to demo accounts so the bypass in login.html works ───
  {
    email: 'admin@societyflow.com',
    password: 'Admin@123',
    user: {
      id: 'master-admin-001',
      name: 'Master Admin',
      email: 'admin@societyflow.com',
      role: 'MASTER_ADMIN',
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

  getAccessToken() {
    return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
  }

  getRefreshToken() {
    return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
  }

  setTokens(accessToken, refreshToken) {
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
    }
  }

  setUserProfile(user) {
    localStorage.setItem(TOKEN_KEYS.USER_PROFILE, JSON.stringify(user));
  }

  getUserProfile() {
    const profile = localStorage.getItem(TOKEN_KEYS.USER_PROFILE);
    return profile ? JSON.parse(profile) : null;
  }

  getCurrentSociety() {
    return localStorage.getItem(TOKEN_KEYS.CURRENT_SOCIETY);
  }

  setCurrentSociety(societyId) {
    localStorage.setItem(TOKEN_KEYS.CURRENT_SOCIETY, societyId);
  }

  clearAuth() {
    localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(TOKEN_KEYS.USER_PROFILE);
    localStorage.removeItem(TOKEN_KEYS.CURRENT_SOCIETY);
    // ─── FIX 3: Also clear legacy key used by master admin bypass ───
    localStorage.removeItem('societyflow_user');
  }

  isAuthenticated() {
    return !!this.getAccessToken();
  }

  isDemoMode() {
    const token = this.getAccessToken();
    return !!(token && token.startsWith(DEMO_TOKEN_PREFIX));
  }

  // ─── FIX 4: Use relative path for redirect so it works on GitHub Pages ───
  requireAuth() {
    if (!this.isAuthenticated()) {
      // Use relative path - works on GitHub Pages and localhost
      const loginPath = window.location.pathname.includes('/SocietyFlow/')
        ? '/SocietyFlow/app/login.html'
        : './login.html';
      window.location.href = loginPath;
      return false;
    }
    return true;
  }

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

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const loginPath = window.location.pathname.includes('/SocietyFlow/')
        ? '/SocietyFlow/app/login.html'
        : './login.html';
      window.location.href = loginPath;
      throw error;
    }
  }

  onAccessTokenRefreshed(accessToken) {
    this.refreshSubscribers.forEach((callback) => callback(accessToken));
    this.refreshSubscribers = [];
  }

  addRefreshSubscriber(callback) {
    this.refreshSubscribers.push(callback);
  }

  async request(endpoint, options = {}) {
    const { method = 'GET', body = null, includeAuth = true, retry = 0 } = options;

    const url = `${this.baseURL}${endpoint}`;
    const headers = this.getHeaders(includeAuth);
    const requestOptions = { method, headers };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);

      if (response.status === 401 && includeAuth && retry === 0) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const newAccessToken = await this.refreshAccessToken();
            this.isRefreshing = false;
            this.onAccessTokenRefreshed(newAccessToken);
            return this.request(endpoint, { ...options, retry: retry + 1 });
          } catch (refreshError) {
            this.isRefreshing = false;
            throw refreshError;
          }
        } else {
          return new Promise((resolve, reject) => {
            this.addRefreshSubscriber(() => {
              this.request(endpoint, { ...options, retry: retry + 1 })
                .then(resolve)
                .catch(reject);
            });
          });
        }
      }

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

  async register(userData) {
    const response = await this.post('/auth/register', userData, { includeAuth: false });
    return response.data;
  }

  async login(email, password) {
  try {
    const response = await this.post('/auth/login', { email, password }, { includeAuth: false });
    this.setTokens(response.data.accessToken, response.data.refreshToken);
    this.setUserProfile(response.data.user);
    return response.data;
  } catch (error) {
    // Fall back to demo accounts when backend unreachable
    if (error.status === 0 || error.status === undefined) {
      const demoAccount = DEMO_ACCOUNTS.find(
        (acc) => acc.email === email && acc.password === password
      );
      if (demoAccount) {
        // ✅ Generate BOTH access token AND refresh token for demo mode
        const demoAccessToken = DEMO_TOKEN_PREFIX + (
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2)
        );
        const demoRefreshToken = DEMO_TOKEN_PREFIX + (
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2)
        );
        
        // ✅ Store both tokens
        this.setTokens(demoAccessToken, demoRefreshToken);
        this.setUserProfile(demoAccount.user);
        
        return { 
          user: demoAccount.user, 
          accessToken: demoAccessToken, 
          refreshToken: demoRefreshToken,  // ✅ Include refresh token in response
          isDemoMode: true 
        };
      }
    }
    throw error;
  }
}
  
  async logout() {
    try {
      if (!this.isDemoMode()) {
        await this.post('/auth/logout', {});
      }
    } catch (e) {
      // Ignore logout errors
    } finally {
      this.clearAuth();
    }
  }

  // ==================== SOCIETY ENDPOINTS ====================

  async getSocieties() {
    return this.get('/societies');
  }

  async createSociety(data) {
    return this.post('/societies', data);
  }

  // ==================== MEMBER ENDPOINTS ====================

  async getMembers(societyId) {
    return this.get(`/societies/${societyId}/members`);
  }

  async createMember(societyId, data) {
    return this.post(`/societies/${societyId}/members`, data);
  }

  // ==================== INVOICE ENDPOINTS ====================

  async getInvoices(societyId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/societies/${societyId}/invoices${query ? '?' + query : ''}`);
  }
}

// Create global instance
const api = new APIClient();

// Log current mode for debugging
console.log('API Client initialized. Base URL:', api.baseURL);
console.log('Demo mode available. Demo accounts: demo@society.com / Demo@123');
