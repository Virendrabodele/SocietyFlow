# SocietyFlow - Google Sheets Integration Guide

## 🔵 Overview

SocietyFlow now supports **Google Sheets Integration** for:
- ✅ Real-time data backup
- ✅ Multi-user collaboration
- ✅ Automatic data sync
- ✅ Easy data export/import
- ✅ Cloud storage

---

## 👤 User Management & Multi-Society

### Login System
**File:** `login.html`

**Features:**
- User registration with email
- Password-protected accounts
- Demo account (demo@society.com / Demo@123)
- Password strength validation
- Google OAuth ready (framework)

**User Data Structure:**
```javascript
{
  id: 1,
  name: "User Name",
  email: "user@example.com",
  society: "Main Society",
  state: "maharashtra",
  password: "hashed_password", // Should be hashed in production
  createdAt: "2024-02-19T10:00:00Z",
  googleSheetId: "sheet_id_from_google",
  isVerified: true
}
```

### Dashboard
**File:** `dashboard.html`

**Features:**
- View all user's societies
- Create new societies
- Manage multiple societies
- Google Sheets connection status
- Statistics overview

**Society Data Structure:**
```javascript
{
  id: "1708345678901",
  userId: 1,
  name: "Green Park Apartments",
  units: 50,
  city: "Mumbai",
  state: "maharashtra",
  createdAt: "2024-02-19T10:00:00Z",
  googleSheetId: "Google_Sheet_ID",
  dataLastSynced: "2024-02-19T11:30:00Z"
}
```

---

## 📊 Google Sheets Integration Steps

### Step 1: Create Google Cloud Project

```
1. Go to Google Cloud Console
   https://console.cloud.google.com

2. Create new project
   - Click "Select Project" dropdown
   - Click "New Project"
   - Name: "SocietyFlow"
   - Click Create

3. Enable Google Sheets API
   - Search for "Google Sheets API"
   - Click Enable
   - Search for "Google Drive API"
   - Click Enable
```

### Step 2: Create OAuth 2.0 Credentials

```
1. Go to Credentials page
   https://console.cloud.google.com/apis/credentials

2. Create OAuth 2.0 Client ID
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized JavaScript origins:
     * http://localhost:8000
     * http://localhost:3000
     * https://yourdomain.com
   
   - Add authorized redirect URIs:
     * http://localhost:8000/callback.html
     * https://yourdomain.com/callback.html
   
   - Click Create
   - Copy Client ID

3. Copy your Client ID
   - You'll need this in the next step
```

### Step 3: Add Google Libraries to HTML

Add this to `login.html`, `dashboard.html`, and other pages:

```html
<!-- In <head> section -->
<script src="https://apis.google.com/js/api.js"></script>
<script src="https://accounts.google.com/gsi/client" async defer></script>

<script>
    // Initialize Google API
    function initializeGoogleAPI() {
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: 'YOUR_API_KEY',
                clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
                discoveryDocs: [
                    'https://sheets.googleapis.com/$discovery/rest?version=v4',
                    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
                ],
                scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive'
            });
        });
    }
</script>
```

### Step 4: Implement Google Sign-In

```javascript
// Add to login.html
function handleGoogleLogin() {
    const user = gapi.auth2.getAuthInstance().currentUser.get();
    const profile = user.getBasicProfile();
    
    // Store Google user info
    localStorage.setItem('googleUser', JSON.stringify({
        id: profile.getId(),
        name: profile.getName(),
        email: profile.getEmail(),
        imageUrl: profile.getImageUrl(),
        accessToken: user.getAuthResponse().id_token
    }));
    
    // Create account if doesn't exist
    const users = JSON.parse(localStorage.getItem('societyUsers')) || [];
    if (!users.find(u => u.email === profile.getEmail())) {
        users.push({
            id: Date.now(),
            name: profile.getName(),
            email: profile.getEmail(),
            society: '',
            state: '',
            googleSignIn: true,
            createdAt: new Date().toISOString(),
            googleSheetId: null
        });
        localStorage.setItem('societyUsers', JSON.stringify(users));
    }
    
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
}
```

---

## 🔄 Data Sync with Google Sheets

### Create Google Sheet Programmatically

```javascript
async function createGoogleSheet(societyName) {
    const request = {
        properties: {
            title: `SocietyFlow - ${societyName}`
        },
        sheets: [
            {
                properties: {
                    title: 'Members',
                    sheetId: 0
                },
                data: [{
                    rowData: [{
                        values: [
                            {userEnteredValue: {stringValue: 'Name'}},
                            {userEnteredValue: {stringValue: 'Unit'}},
                            {userEnteredValue: {stringValue: 'Email'}},
                            {userEnteredValue: {stringValue: 'Phone'}},
                            {userEnteredValue: {stringValue: 'BHK/SQFT'}},
                            {userEnteredValue: {stringValue: 'Status'}}
                        ]
                    }]
                }]
            },
            {
                properties: {
                    title: 'Maintenance',
                    sheetId: 1
                }
            },
            {
                properties: {
                    title: 'Payments',
                    sheetId: 2
                }
            }
        ]
    };

    try {
        const response = await gapi.client.sheets.spreadsheets.create(request);
        const sheetId = response.result.spreadsheetId;
        
        // Share with current user
        await gapi.client.drive.files.update({
            fileId: sheetId,
            addParents: 'root',
            fields: 'id, webViewLink'
        });
        
        return sheetId;
    } catch (error) {
        console.error('Error creating sheet:', error);
    }
}
```

### Sync Members to Google Sheet

```javascript
async function syncMembersToSheet(sheetId, members) {
    const values = [
        ['Name', 'Unit', 'Email', 'Phone', 'Type', 'Status']
    ];
    
    members.forEach(member => {
        values.push([
            member.name,
            member.unit,
            member.email,
            member.phone,
            member.type,
            member.status
        ]);
    });

    const request = {
        spreadsheetId: sheetId,
        range: 'Members!A1',
        valueInputOption: 'USER_ENTERED',
        resource: {values: values}
    };

    try {
        const response = await gapi.client.sheets.spreadsheets.values.update(request);
        console.log('Data synced successfully');
        
        // Update sync timestamp
        const society = JSON.parse(localStorage.getItem('currentSociety'));
        society.dataLastSynced = new Date().toISOString();
        localStorage.setItem('currentSociety', JSON.stringify(society));
        
        return response;
    } catch (error) {
        console.error('Error syncing data:', error);
    }
}
```

### Read Data from Google Sheet

```javascript
async function readMembersFromSheet(sheetId) {
    const request = {
        spreadsheetId: sheetId,
        range: 'Members!A1:F1000',
        valueRenderOption: 'FORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
    };

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get(request);
        const data = response.result.values;
        
        if (!data || data.length === 0) {
            console.log('No data found');
            return [];
        }

        // Skip header row and convert to objects
        const members = data.slice(1).map(row => ({
            name: row[0],
            unit: row[1],
            email: row[2],
            phone: row[3],
            type: row[4],
            status: row[5]
        }));

        return members;
    } catch (error) {
        console.error('Error reading data:', error);
    }
}
```

---

## 📋 Sheet Structure

### Members Sheet
```
| Name | Unit | Email | Phone | BHK/SQFT | Status |
|------|------|-------|-------|----------|--------|
| Raj | A-101 | raj@... | 9876543210 | 2 BHK | Active |
```

### Maintenance Sheet
```
| Name | Unit | Monthly | Tax | Total | Paid | Outstanding |
|------|------|---------|-----|-------|------|-------------|
| Raj | A-101 | 3000 | 540 | 3540 | 3540 | 0 |
```

### Payments Sheet
```
| Date | Member | Amount | Reference | Method |
|------|--------|--------|-----------|--------|
| 2024-02-19 | Raj | 3540 | REF001 | Bank Transfer |
```

---

## 🔐 Security Considerations

### For Production:

1. **Password Hashing**
   ```javascript
   // Use bcrypt or similar
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **API Keys**
   - Never expose in frontend code
   - Use backend to handle Google API calls
   - Store keys in environment variables

3. **Access Control**
   ```javascript
   // Check user owns society before allowing access
   function checkSocietyAccess(userId, societyId) {
       const society = allSocieties.find(s => s.id === societyId);
       return society && society.userId === userId;
   }
   ```

4. **Data Encryption**
   - Encrypt sensitive data before storing
   - Use HTTPS for all API calls

---

## 🚀 Implementation Checklist

### Phase 1 - Authentication (MVP)
- [x] Login page created
- [x] Registration form created
- [x] Password validation
- [x] Session management (localStorage)
- [ ] Backend authentication (future)
- [ ] Password hashing
- [ ] Email verification

### Phase 2 - Multi-Society
- [x] Dashboard created
- [x] Create society functionality
- [x] Multi-society support
- [x] Society selection
- [ ] Share society with others
- [ ] Role-based access

### Phase 3 - Google Sheets
- [ ] Google OAuth 2.0 setup
- [ ] Google Sheets API integration
- [ ] Automatic data sync
- [ ] Bi-directional sync
- [ ] Conflict resolution
- [ ] Sync history logging

### Phase 4 - Advanced Features
- [ ] Real-time collaboration
- [ ] Data validation from sheets
- [ ] Scheduled sync
- [ ] Webhook integration
- [ ] Data webhooks

---

## 📚 Code Files Involved

### New Files:
1. **login.html** - User authentication
2. **dashboard.html** - Society management
3. **callback.html** - OAuth callback (when needed)

### Modified Files:
1. **index.html** - Add login check + multi-society support
2. **members.html** - Add Google Sheets sync button
3. **maintenance.html** - Add sync to sheets
4. **reports.html** - Export to Google Sheets
5. **settings.html** - Google Sheets connection UI

### Supporting Files:
1. **google-sheets-api.js** - API integration helper
2. **auth.js** - Authentication utilities
3. **sync.js** - Data sync manager

---

## 🔗 Google API References

- [Google Sheets API](https://developers.google.com/sheets/api/reference/rest)
- [Google Drive API](https://developers.google.com/drive/api/reference/rest)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Sign-In Library](https://developers.google.com/identity/gsi/web)

---

## 📞 Troubleshooting

### Common Issues:

**"OAuth is not defined"**
- Make sure Google libraries are loaded
- Check if script tags are in correct order

**"Sheet not found"**
- Verify spreadsheet ID is correct
- Check if user has permission to access sheet

**"Data not syncing"**
- Check network connectivity
- Verify API credentials
- Check rate limits (100 requests/100 seconds)

**"401 Unauthorized"**
- Token may have expired
- Re-authenticate user
- Refresh OAuth token

---

## 💡 Best Practices

1. **Always validate data** before syncing
2. **Handle errors gracefully** with user feedback
3. **Cache sheet data** locally for offline support
4. **Implement rate limiting** to avoid API quotas
5. **Log sync operations** for debugging
6. **Test thoroughly** before production
7. **Keep backup** of original data
8. **Document API changes** for team

---

## 🎯 Next Steps

1. Complete Phase 1 (Authentication) - DONE ✓
2. Complete Phase 2 (Multi-Society) - DONE ✓
3. Set up Google Cloud Project (Phase 3)
4. Implement Google Sheets API calls (Phase 3)
5. Test end-to-end sync (Phase 3)
6. Deploy to production

---

**Need help?** Check the specific API documentation or create an issue with detailed error logs.

---

*Version 2.0 - Multi-User & Google Sheets Support*
*Last Updated: February 2024*

# 🧾 Activity Logging (Login + Page Clicks)

> Important: A Google Sheet edit URL (like `docs.google.com/spreadsheets/.../edit`) cannot directly receive POST requests from your app.
> You need a Google Apps Script **Web App URL** as a webhook.

### Recommended Flow

1. Keep your spreadsheet link in Settings (for reference).
2. Deploy a Google Apps Script Web App tied to that sheet.
3. Paste the Apps Script URL in **Settings → System → Google Sheets Activity Sync**.
4. SocietyFlow sends events like `login_success`, `page_view`, and `nav_click` to that webhook.

### Minimal Google Apps Script

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.openById('1oNWJRk4QltrcKVvdI9HZ5stJMJ955mIvDh6mjhJ_jIQ').getSheetByName('Sheet1');
  const payload = JSON.parse(e.postData.contents || '{}');

  sheet.appendRow([
    new Date(),
    payload.eventType || '',
    payload.userEmail || '',
    payload.userRole || '',
    payload.page || '',
    JSON.stringify(payload.details || {})
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Deploy with:
- **Execute as:** Me
- **Who has access:** Anyone

This is the simplest alternative to building a full backend.
