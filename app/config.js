/**
 * SocietyFlow Frontend Configuration
 */

const CONFIG = {
  api: {
    // ─── UPDATE 'your-app-name' with your actual Render service name ───
    // Find it in Render dashboard → your service → the .onrender.com URL
    baseURL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000/api/v1'
      : 'https://societyflow-api.onrender.com', // ← REPLACE with your Render URL
    timeout: 30000,
  },

  app: {
    name: 'SocietyFlow',
    version: '1.0.0',
  },

  features: {
    googleSheets: true,
    notifications: true,
    paymentGateway: false,
  },

  storage: {
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
    tokens: {
      accessToken: 'sf_access_token',
      refreshToken: 'sf_refresh_token',
      userProfile: 'sf_user_profile',
      currentSociety: 'sf_current_society',
    },
  },

  ui: {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    currency: '₹',
    itemsPerPage: 10,
  },
};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
