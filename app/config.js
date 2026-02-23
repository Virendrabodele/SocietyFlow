/**
 * SocietyFlow Frontend Configuration
 * Centralized configuration for the frontend application
 */

const CONFIG = {
  // API Configuration
  api: {
    baseURL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/v1'
      : 'https://api.societyflow.com/api/v1', // Update with production URL
    timeout: 30000,
  },

  // App Configuration
  app: {
    name: 'SocietyFlow',
    version: '1.0.0',
  },

  // Feature Flags
  features: {
    googleSheets: true,
    notifications: true,
    paymentGateway: false,
  },

  // Storage Keys (Legacy - for backward compatibility during migration)
  storage: {
    // Old localStorage keys - will be deprecated
    legacy: {
      currentUser: 'currentUser',
      societyUsers: 'societyUsers',
      allSocieties: 'allSocieties',
      currentSociety: 'currentSociety',
      societyMembers: 'societyMembers',
      societySettings: 'societySettings',
      activityLog: 'societyActivityLog',
      googleSheetUrl: 'googleSpreadsheetUrl',
      googleWebhookUrl: 'googleSheetsWebhookUrl',
    },
    // New token-based keys
    tokens: {
      accessToken: 'sf_access_token',
      refreshToken: 'sf_refresh_token',
      userProfile: 'sf_user_profile',
      currentSociety: 'sf_current_society',
    },
  },

  // UI Configuration
  ui: {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    currency: '₹',
    itemsPerPage: 10,
  },
};

// Make config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
