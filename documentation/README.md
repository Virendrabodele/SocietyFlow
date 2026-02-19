# SocietyFlow - Society Management Software

## 🏘️ Overview
SocietyFlow is a comprehensive web-based society management software designed specifically for residential societies in India. It helps manage members, calculate maintenance charges flexibly, generate custom reports, and handle state-specific compliance requirements.

**Version**: 1.0 MVP  
**Built**: HTML5, CSS3, JavaScript  
**Database**: Browser LocalStorage (offline-capable)

---

## 📁 Files Structure

```
SocietyFlow/
├── index.html              # Home page / Dashboard
├── members.html            # Member management module
├── maintenance.html        # Maintenance calculator
├── reports.html            # Custom reports generation
├── settings.html           # Society configuration & settings
└── README.md              # This file
```

---

## ✨ Features

### 1. **Home Page (index.html)**
- Professional landing page showcasing all features
- Navigation to all modules
- Statistics dashboard
- Call-to-action section

### 2. **Member Management (members.html)**
- ✅ Add new members with details
- ✅ Support for BHK, SQFT, and Metered calculation types
- ✅ Track member status (Active, Inactive, Vacant)
- ✅ Search and filter members
- ✅ View member statistics
- ✅ Edit and delete functionality

### 3. **Maintenance Calculator (maintenance.html)**
- ✅ **Flexible Calculation Methods**:
  - BHK-based (1 BHK, 2 BHK, 3 BHK, etc.)
  - SQFT-based (area-wise charges)
  - Metered (usage-based for utilities)
  
- ✅ **Features**:
  - Quick calculator for single members
  - Bulk calculation for all members
  - Configurable rates and charges
  - Tax/GST calculation
  - Generate maintenance reports

### 4. **Custom Reports (reports.html)**
- ✅ **Pre-built Templates**:
  - Members Report
  - Maintenance Collection Report
  - Outstanding Dues Report
  - Financial Summary Report
  - Custom Report Builder
  
- ✅ **Customization Options**:
  - Select columns to include/exclude
  - Date range filtering
  - Status-based filtering
  - Export to PDF/Excel

### 5. **Settings & Configuration (settings.html)**
- ✅ **Society Information Tab**:
  - Society name, registration number
  - Contact information
  - Secretary/Admin details
  - Address and location

- ✅ **State-Specific Configuration**:
  - Select state (Maharashtra, Karnataka, Delhi, etc.)
  - GST and tax rate configuration
  - State-wise ID format
  - Compliance notes

- ✅ **Charges Setup**:
  - BHK-based rates
  - SQFT-based rates
  - Water and electricity charges
  - Fixed monthly charges

- ✅ **System Settings**:
  - Email notifications toggle
  - SMS alerts
  - Auto backup
  - Audit trail logging
  - Data import/export
  - Data deletion option

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No internet required (works offline using localStorage)

### Installation

1. **Extract all files** from the ZIP to a folder
2. **Open in browser**: Double-click `index.html` OR
3. **Use a local server** (recommended):
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Python 2
   python -m SimpleHTTPServer 8000
   
   # Using Node.js (http-server)
   npx http-server
   ```
4. **Navigate to**: `http://localhost:8000`

---

## 💾 Data Storage

All data is stored in **Browser LocalStorage**:
- **Members Data**: `societyMembers` key
- **Settings Data**: `societySettings` key

### Data Persistence
- Data persists across browser sessions
- Works offline (no server required)
- For online version: Will require backend database

---

## 📊 How to Use

### Step 1: Configure Society
1. Go to **Settings** page
2. Fill in **Society Information** (name, registration, contact)
3. Select your **State** and configure GST rates
4. Set up **Maintenance Charges** (choose your calculation method)
5. Click **Save**

### Step 2: Add Members
1. Go to **Members** page
2. Fill the form with:
   - Member name
   - Unit/Flat number
   - Calculation type (BHK/SQFT/Metered)
   - Status (Active/Inactive/Vacant)
3. Click **Add Member**

### Step 3: Calculate Maintenance
1. Go to **Maintenance** page
2. Select calculation method (BHK/SQFT/Metered)
3. Enter rates for your society
4. **Quick Calculate**: For single member
5. **Calculate**: For all members
6. View results and export if needed

### Step 4: Generate Reports
1. Go to **Reports** page
2. Select a report template or create custom
3. Choose columns to include
4. Set filters (date, status, etc.)
5. Click **Generate Report**
6. Export to PDF/Excel or print

---

## 🔧 Customization Guide

### Adding New States
Edit `settings.html` and add to the state selector:
```html
<option value="punjab">Punjab</option>
<option value="rajasthan">Rajasthan</option>
```

### Changing Color Scheme
Edit CSS variables in any file (at the top of `<style>`):
```css
:root {
    --primary: #1e40af;        /* Main blue */
    --accent: #06b6d4;         /* Cyan accent */
    --success: #10b981;        /* Green */
    --danger: #ef4444;         /* Red */
}
```

### Adding New Report Templates
In `reports.html`, add new template card:
```html
<div class="template-card" onclick="selectTemplate('new-template')">
    <h3>📈 New Report Type</h3>
    <p>Description of the report</p>
</div>
```

---

## 📱 Responsive Design
- ✅ Works on Desktop
- ✅ Works on Tablet
- ✅ Works on Mobile (optimized for landscape)

---

## 🔐 Security Notes

**Current Version (MVP)**:
- Data stored locally in browser
- No encryption (suitable for development/testing)

**For Production**:
- Add backend database (MongoDB, PostgreSQL, MySQL)
- Implement user authentication
- Add data encryption
- Implement proper access controls
- Use HTTPS

---

## 🎯 Features Map - Future Enhancements

### Phase 2:
- [ ] User authentication & roles
- [ ] Backup to cloud
- [ ] Email/SMS notifications
- [ ] Payment integration
- [ ] Automated payment reminders
- [ ] Mobile app

### Phase 3:
- [ ] Advanced analytics
- [ ] Audit trail & compliance reports
- [ ] Integration with bank/payment gateways
- [ ] Multi-society management
- [ ] API for third-party integration

---

## 🐛 Known Issues & Limitations

**Current Version**:
- Data stored in browser localStorage only (max ~5-10MB)
- No user authentication
- No encrypted data storage
- Mock data in reports (needs backend)
- PDF/Excel export is placeholder (needs library)

---

## 📞 Support & Development

### For Development Help
1. **Replace calculations** in `maintenance.html` with actual formulas
2. **Connect to backend** by replacing localStorage with API calls
3. **Add authentication** using JWT or similar
4. **Implement database** to store data permanently

### Key Code Locations
- **Member Logic**: `members.html` - Lines 320-370
- **Calculation Logic**: `maintenance.html` - Lines 300-380
- **Report Generation**: `reports.html` - Lines 330-400
- **Settings Storage**: `settings.html` - Lines 230-260

---

## 📄 License
Free to use and modify for your project

---

## 🎨 Design Credits
- **Color Scheme**: Professional blue and accent colors
- **Typography**: Segoe UI (system font)
- **Icons**: Unicode emoji
- **Responsive Grid**: CSS Grid & Flexbox

---

## 📋 Checklist for Going to Production

- [ ] Set up backend database
- [ ] Implement user authentication
- [ ] Add SSL/HTTPS
- [ ] Implement proper error handling
- [ ] Add data validation on server
- [ ] Set up automated backups
- [ ] Create user manual/documentation
- [ ] Conduct security audit
- [ ] Test with real data
- [ ] Deploy to production server

---

## 🚀 Quick Start Commands

```bash
# If using Python
python -m http.server 8000

# If using PHP
php -S localhost:8000

# If using Node.js
npx http-server

# Then open: http://localhost:8000/index.html
```

---

**Last Updated**: February 2026  
**Next Review**: When moving to Phase 2 features
