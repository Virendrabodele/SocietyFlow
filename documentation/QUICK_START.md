# SocietyFlow - Quick Start Guide

## 🎯 What You Have

A complete **web-based society management software** with 5 fully functional pages:

1. **Home (index.html)** - Landing page and navigation
2. **Members (members.html)** - Add and manage members
3. **Maintenance (maintenance.html)** - Calculate charges flexibly
4. **Reports (reports.html)** - Generate custom reports
5. **Settings (settings.html)** - Configure your society

---

## ⚡ 5-Minute Setup

### Step 1: Open the App
- Extract all files to a folder
- Open `index.html` in your web browser
- You'll see the beautiful home page with navigation

### Step 2: Configure Your Society
1. Click **Settings** in navigation bar
2. Fill in your society details:
   - Society name
   - Registration number
   - Address, phone, email
   - Secretary/Admin contact

3. Go to **State & Tax** tab:
   - Select your state
   - Set GST rate
   - Confirm ID format

4. Go to **Charges Setup** tab:
   - Choose calculation type (BHK/SQFT/Metered)
   - Enter rates
   - Save

### Step 3: Add Members
1. Click **Members** in navigation
2. Fill the form:
   - Member name
   - Unit/Flat number (e.g., A-101)
   - Select BHK/SQFT/Metered
   - If BHK: Select 1/2/3/4/5 BHK
   - If SQFT: Enter area (e.g., 1200 sqft)
   - Click **Add Member**

3. Repeat for all members
   - You'll see them in the table below

### Step 4: Calculate Maintenance
1. Click **Maintenance** in navigation
2. **Left side - Setup**:
   - Select calculation method
   - Enter monthly charge rate
   - Add any extra charges
   - Set tax rate
   - Click **Calculate**

3. **Right side - Quick Calculate**:
   - Test with one member
   - See results instantly

4. See bulk results in the table below

### Step 5: Generate Reports
1. Click **Reports** in navigation
2. Select a report template (Members, Maintenance, Outstanding, Financial)
3. Customize:
   - Choose which columns to include
   - Set date range
   - Filter by status
4. Click **Generate Report**
5. You'll see the report with summary
6. Click **Print** or export buttons

---

## 🎮 Feature Details

### Members Page Features
- ✅ Add members with BHK/SQFT/Metered info
- ✅ Search members by name or unit
- ✅ View all member statistics
- ✅ Edit/Delete members
- ✅ Track member status

### Maintenance Page Features
- ✅ BHK-based calculation
- ✅ SQFT-based calculation
- ✅ Metered/usage-based calculation
- ✅ Quick calculator for testing
- ✅ Bulk calculation for all members
- ✅ Tax/GST calculation
- ✅ Additional charges support

### Reports Page Features
- ✅ 5 pre-built report templates
- ✅ Custom report builder
- ✅ Select which columns to show
- ✅ Filter by date and status
- ✅ View summary statistics
- ✅ Print reports
- ✅ Export options (PDF/Excel - coming)

### Settings Page Features
- ✅ Society information configuration
- ✅ State-specific tax setup
- ✅ BHK/SQFT rate configuration
- ✅ System toggles (notifications, backup)
- ✅ Data import/export
- ✅ Data backup and restoration

---

## 💡 Example Workflow

### Scenario: 20-unit apartment building in Mumbai

1. **Settings**:
   - Society Name: "Green Park Apartments"
   - State: Maharashtra
   - GST: 18%
   - 2 BHK Rate: ₹3000/month
   - 3 BHK Rate: ₹4000/month

2. **Add Members**:
   - Unit A-101: Raj Kumar, 2 BHK
   - Unit A-102: Priya Singh, 3 BHK
   - Unit A-103: Amit Patel, 2 BHK
   - ... (repeat for all 20 units)

3. **Calculate Maintenance**:
   - Select BHK-based
   - Rate: 2 BHK = ₹3000, 3 BHK = ₹4000
   - Additional charges: ₹500
   - Click Calculate
   - See total for all members with tax

4. **Generate Report**:
   - Select "Maintenance Collection Report"
   - Include: Name, Unit, Monthly Charge, Outstanding
   - Generate
   - Print for board meeting

---

## 🔑 Key Points

### Data Saving
- **Automatic**: Data saves immediately when you add/edit
- **Local**: Data stored in your browser (no server needed)
- **Offline**: Works without internet
- **Backup**: Export data from Settings anytime

### Calculation Methods Explained

**BHK-Based**:
- Best for: Apartments with standard units
- How: Each BHK type has fixed rate
- Example: 2 BHK = ₹3000/month

**SQFT-Based**:
- Best for: Mixed-size properties
- How: Rate per square foot × total area
- Example: 5 per sqft × 1200 sqft = ₹6000/month

**Metered-Based**:
- Best for: Utility recovery
- How: Charge per unit used (water/electricity)
- Example: 50 units × ₹25/unit = ₹1250/month

---

## ❓ FAQ

**Q: Where is my data saved?**  
A: In your browser's local storage. Safe and offline.

**Q: Can I export data?**  
A: Yes! Go to Settings > System > Export Data

**Q: Can I restore from backup?**  
A: Yes! Go to Settings > System > Import Data

**Q: How do I add more states?**  
A: Edit Settings page HTML to add your state

**Q: What if I clear browser data?**  
A: Export first! Then use import to restore.

**Q: Can multiple people use this?**  
A: Currently on one device. For multi-user, need backend.

**Q: Does it work offline?**  
A: Yes! Completely works offline.

**Q: Can I change colors?**  
A: Yes! Edit CSS variables in style sections.

---

## 🚀 Next Steps

### For Testing/Demo
1. Add 5-10 sample members
2. Test all calculation methods
3. Generate different reports
4. Export/import data

### For Real Usage
1. Configure all society details accurately
2. Add all members with correct details
3. Set accurate rates for your society
4. Generate monthly reports
5. Regular backups (export every month)

### For Development/Deployment
1. Learn from the code structure
2. Add a backend database
3. Implement authentication
4. Deploy to web server
5. Add payment integration

---

## 📞 Support

### If Something Doesn't Work
- Check browser console (F12 > Console tab)
- Try clearing browser cache
- Make sure JavaScript is enabled
- Use a modern browser (Chrome, Firefox, Safari)

### To Modify Features
- All code is in the HTML files
- Look for comments marked with `// ...`
- Change colors in `:root` CSS variables
- Modify calculations in JavaScript sections

---

## 🎯 What's NOT Included (For Phase 2)

- ❌ User login/authentication
- ❌ Actual PDF/Excel export
- ❌ Email/SMS sending
- ❌ Payment gateway integration
- ❌ Cloud backup
- ❌ Multi-society support
- ❌ Mobile app

These require backend development.

---

## 📊 Data Structure

### Member Object
```javascript
{
  id: 1234567890,
  name: "John Doe",
  phone: "98765432100",
  email: "john@example.com",
  unit: "A-101",
  type: "bhk",  // or "sqft", "metered"
  bhk: "2",
  sqft: "1200",
  status: "active",  // or "inactive", "vacant"
  joinDate: "2/19/2026"
}
```

### Settings Object
```javascript
{
  societyName: "Green Park Apartments",
  state: "maharashtra",
  gstRate: 18,
  bhk2Rate: 3000,
  sqftRate: 5,
  // ... more settings
}
```

---

## 🎓 Learning Resources in Code

Each file has JavaScript sections you can learn from:

1. **Form Handling** → `members.html` (add/search)
2. **Calculations** → `maintenance.html` (math logic)
3. **Report Generation** → `reports.html` (data formatting)
4. **Storage** → All files (localStorage usage)
5. **UI Interactions** → All files (event listeners)

---

**Ready to use!** Start with Step 1 above and you'll have your first society configured in 5 minutes. 🚀
