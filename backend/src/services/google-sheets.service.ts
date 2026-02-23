import { google } from 'googleapis';
import { config } from '../config';

const sheets = google.sheets('v4');
const drive = google.drive('v3');

interface GoogleSheetConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  spreadsheetId?: string;
}

class GoogleSheetsService {
  private auth: any;
  private spreadsheetId: string | undefined;

  constructor(googleConfig: GoogleSheetConfig) {
    this.auth = new google.auth.OAuth2(googleConfig.clientId, googleConfig.clientSecret, googleConfig.redirectUri);
    this.spreadsheetId = googleConfig.spreadsheetId;
  }

  /**
   * Set up OAuth2 authentication with refresh token
   */
  setCredentials(tokens: any) {
    this.auth.setCredentials(tokens);
  }

  /**
   * Create a new Google Sheet for a society
   */
  async createSocietySheet(societyName: string): Promise<string> {
    try {
      const response = await sheets.spreadsheets.create(
        {
          auth: this.auth,
          requestBody: {
            properties: {
              title: `SocietyFlow - ${societyName}`,
              locale: 'en_IN',
              timeZone: 'Asia/Kolkata',
            },
            sheets: [
              {
                properties: {
                  sheetId: 0,
                  title: 'Members',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 7,
                  },
                },
              },
              {
                properties: {
                  sheetId: 1,
                  title: 'Maintenance',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 7,
                  },
                },
              },
              {
                properties: {
                  sheetId: 2,
                  title: 'Payments',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 6,
                  },
                },
              },
              {
                properties: {
                  sheetId: 3,
                  title: 'Activity Logs',
                  gridProperties: {
                    rowCount: 5000,
                    columnCount: 5,
                  },
                },
              },
            ],
          },
        },
        {}
      );

      const sheetId = response.data.spreadsheetId;

      if (!sheetId) throw new Error('Failed to create spreadsheet');

      // Initialize headers
      await this.initializeHeaders(sheetId);

      return sheetId;
    } catch (error) {
      console.error('Error creating Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Initialize sheet headers
   */
  private async initializeHeaders(spreadsheetId: string) {
    const memberHeaders = [['Name', 'Unit No', 'Email', 'Phone', 'Status', 'Created At', 'Variables']];
    const maintenanceHeaders = [['Member', 'Unit', 'Amount', 'Tax', 'Total', 'Due Date', 'Status']];
    const paymentHeaders = [['Date', 'Member Name', 'Amount', 'Reference', 'Method', 'Status']];
    const auditHeaders = [['DateTime', 'User', 'Action', 'Entity', 'Details']];

    const requests = [
      {
        range: 'Members!A1:G1',
        values: memberHeaders,
      },
      {
        range: 'Maintenance!A1:G1',
        values: maintenanceHeaders,
      },
      {
        range: 'Payments!A1:F1',
        values: paymentHeaders,
      },
      {
        range: 'Activity Logs!A1:E1',
        values: auditHeaders,
      },
    ];

    try {
      await sheets.spreadsheets.values.batchUpdate(
        {
          auth: this.auth,
          spreadsheetId,
          requestBody: {
            data: requests,
            valueInputOption: 'RAW',
          },
        },
        {}
      );
    } catch (error) {
      console.error('Error initializing headers:', error);
    }
  }

  /**
   * Add member to Google Sheet
   */
  async addMember(
    spreadsheetId: string,
    memberData: {
      name: string;
      unitNo: string;
      email: string;
      phone?: string;
      status: string;
      variables?: string;
    }
  ) {
    try {
      const values = [
        [
          memberData.name,
          memberData.unitNo,
          memberData.email,
          memberData.phone || '',
          memberData.status,
          new Date().toISOString(),
          memberData.variables || '{}',
        ],
      ];

      const response = await sheets.spreadsheets.values.append(
        {
          auth: this.auth,
          spreadsheetId,
          range: 'Members!A:G',
          valueInputOption: 'RAW',
          requestBody: {
            values,
          },
        },
        {}
      );

      return response.data;
    } catch (error) {
      console.error('Error adding member to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Add activity log to Google Sheet
   */
  async addAuditLog(
    spreadsheetId: string,
    logData: {
      action: string;
      userId: string;
      entityType: string;
      entityId?: string;
      details?: string;
    }
  ) {
    try {
      const values = [
        [new Date().toISOString(), logData.userId, logData.action, logData.entityType, logData.details || ''],
      ];

      await sheets.spreadsheets.values.append(
        {
          auth: this.auth,
          spreadsheetId,
          range: 'Activity Logs!A:E',
          valueInputOption: 'RAW',
          requestBody: {
            values,
          },
        },
        {}
      );
    } catch (error) {
      console.error('Error adding audit log to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Add payment to Google Sheet
   */
  async addPayment(
    spreadsheetId: string,
    paymentData: {
      date: string;
      memberName: string;
      amount: number;
      reference: string;
      method: string;
    }
  ) {
    try {
      const values = [
        [paymentData.date, paymentData.memberName, paymentData.amount, paymentData.reference, paymentData.method, 'Received'],
      ];

      await sheets.spreadsheets.values.append(
        {
          auth: this.auth,
          spreadsheetId,
          range: 'Payments!A:F',
          valueInputOption: 'RAW',
          requestBody: {
            values,
          },
        },
        {}
      );
    } catch (error) {
      console.error('Error adding payment to Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Share sheet with user (only add their email to limit access)
   */
  async shareSheet(spreadsheetId: string, userEmail: string) {
    try {
      await drive.permissions.create(
        {
          auth: this.auth,
          fileId: spreadsheetId,
          requestBody: {
            role: 'owner',
            type: 'user',
            emailAddress: userEmail,
          },
        },
        {}
      );

      return true;
    } catch (error) {
      console.error('Error sharing sheet:', error);
      throw error;
    }
  }

  /**
   * Get sheet URL
   */
  getSheetUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }
}

export default GoogleSheetsService;
