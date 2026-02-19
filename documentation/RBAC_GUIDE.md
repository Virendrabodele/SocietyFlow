# SocietyFlow - Role-Based Access Control (RBAC)

## 👥 Two Role System

SocietyFlow now supports **two roles**:
1. **Admin** - Full access to manage everything
2. **Resident/User** - Limited access to view own data

---

## 🎯 Role Comparison

### Admin
- ✅ **Members:** Create, view, edit, delete all members
- ✅ **Maintenance:** Configure rates, calculate for all
- ✅ **Reports:** Generate all reports
- ✅ **Settings:** Configure society settings
- ✅ **Users:** Manage user access (future)
- ✅ **Dashboard:** Full access to all data
- ✅ **Google Sheets:** Connect and sync

**Use Case:** Society secretary, treasurer, president

### Resident/User
- ✅ **Members:** View own details only
- ✅ **Maintenance:** View own charges
- ✅ **Reports:** View own maintenance report
- ❌ **Settings:** Cannot access
- ❌ **Users:** Cannot manage
- ❌ **Bulk Operations:** Cannot perform
- ✅ **Payments:** View own payment history (future)

**Use Case:** Apartment residents, members

---

## 📋 Feature Access Matrix

| Feature | Admin | Resident |
|---------|-------|----------|
| **View Dashboard** | ✅ Full | ❌ Limited |
| **Create Society** | ✅ Yes | ❌ No |
| **Add Members** | ✅ Yes | ❌ No |
| **View Members** | ✅ All | ✅ Own Only |
| **Edit Members** | ✅ Yes | ❌ No |
| **Delete Members** | ✅ Yes | ❌ No |
| **Add Maintenance** | ✅ Yes | ❌ No |
| **View Maintenance** | ✅ All | ✅ Own Only |
| **Configure Rates** | ✅ Yes | ❌ No |
| **Generate Reports** | ✅ All | ✅ Own Report |
| **Export Reports** | ✅ Yes | ✅ Yes |
| **Access Settings** | ✅ Yes | ❌ No |
| **Connect Google** | ✅ Yes | ❌ No |
| **Manage Users** | ✅ Yes | ❌ No |

---

## 🚀 Implementation Guide

### Step 1: User Data Structure

Each user now includes a `role` field:

```javascript
{
  id: 1708345678901,
  name: "John Doe",
  email: "john@example.com",
  society: "Green Park Apartments",
  state: "maharashtra",
  password: "hashed_password",
  createdAt: "2024-02-19T10:00:00Z",
  googleSheetId: null,
  isVerified: false,
  role: "admin"  // ← NEW FIELD: "admin" or "resident"
}
```

### Step 2: During Login

User is automatically logged in with their assigned role. Role is stored in `currentUser`:

```javascript
// After successful login:
localStorage.setItem('currentUser', JSON.stringify({
  id: 1,
  name: "John Doe",
  role: "admin",  // ← Role is now available
  // ... other fields
}));
```

### Step 3: Access Control in Pages

Every page should check user role before showing features:

```javascript
// In members.html
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// Admin can add members
if (currentUser.role === 'admin') {
  document.getElementById('addMemberButton').style.display = 'block';
} else {
  document.getElementById('addMemberButton').style.display = 'none';
}

// Only show own data for residents
if (currentUser.role === 'resident') {
  // Show only this user's member record
  const currentMember = members.find(m => m.email === currentUser.email);
  displayMembers([currentMember]);
} else {
  // Admin sees all members
  displayMembers(members);
}
```

---

## 📝 Role-Based UI Implementation

### For Admin Users

**Dashboard shows:**
```
- Statistics for all members
- All societies
- Google Sheets connection
- Add New Society button
- Manage Users button (future)
```

**Members page shows:**
```
- Add Member button ✅
- Search all members ✅
- Edit/Delete buttons ✅
- All member details ✅
```

**Reports page shows:**
```
- All report templates ✅
- Custom report builder ✅
- Export all data ✅
- Member filter options ✅
```

### For Resident Users

**Dashboard shows:**
```
- Their own information only
- Their unit/property info
- Their maintenance balance
- Recent payments (future)
❌ Cannot create/manage societies
❌ Cannot see other residents
```

**Members page shows:**
```
- Own profile only
- Own unit details
❌ Add Member button hidden
❌ Search feature limited
❌ Edit/Delete hidden
```

**Reports page shows:**
```
- Own maintenance report
- Own payment history
- Own charges breakdown
❌ Cannot see other residents' data
❌ Custom report builder hidden
```

---

## 🔧 Code Examples

### Check if User is Admin

```javascript
function isAdmin() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  return user && user.role === 'admin';
}

function isResident() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  return user && user.role === 'resident';
}
```

### Hide/Show Elements Based on Role

```javascript
// Hide admin features from residents
function setupUIBasedOnRole() {
  const adminElements = document.querySelectorAll('[data-admin-only]');
  const residentElements = document.querySelectorAll('[data-resident-only]');

  if (!isAdmin()) {
    adminElements.forEach(el => el.style.display = 'none');
  }

  if (!isResident()) {
    residentElements.forEach(el => el.style.display = 'none');
  }
}

// In HTML:
// <button data-admin-only class="btn">Add Member</button>
```

### Filter Data Based on Role

```javascript
function getAccessibleMembers() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const allMembers = JSON.parse(localStorage.getItem('societyMembers'));

  if (isAdmin()) {
    return allMembers; // Admins see all
  } else {
    // Residents see only their own
    return allMembers.filter(m => m.email === user.email);
  }
}
```

### Protect Actions

```javascript
function handleDeleteMember(memberId) {
  if (!isAdmin()) {
    alert('❌ Only Admins can delete members');
    return;
  }

  // Proceed with deletion
  // ...
}

function handleAddMember() {
  if (!isAdmin()) {
    alert('❌ Only Admins can add members');
    return;
  }

  // Show add member form
  // ...
}
```

---

## 👤 User Management (Future Enhancement)

Once implemented, Admins can:

### Invite Users
```
Click "Invite User" button
Enter email address
Select role (Admin/Resident)
Send invitation email
User accepts and creates account
```

### Manage User Access
```
View all users in society
Change user roles
Remove user access
Reset user password
```

### Track User Activity
```
See who added members
See who calculated maintenance
See who generated reports
Audit trail of changes
```

---

## 🔐 Security Considerations

### For Residents (Users)
- ✅ Only see own data
- ✅ Cannot modify any data
- ✅ Cannot access settings
- ✅ Cannot manage other users
- ❌ No privilege escalation

### For Admins
- ✅ Full system access
- ✅ Can manage all members
- ✅ Can manage all data
- ✅ Can configure system
- ⚠️ With great power comes great responsibility

### Protection Mechanisms

```javascript
// Always verify role server-side (in production)
function verifyAdminAccess(userId) {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  
  return true;
}

// Never trust client-side role
// Always validate on backend before:
// - Deleting data
// - Modifying data
// - Accessing sensitive information
```

---

## 📊 Sample Data

### Admin User
```javascript
{
  id: 1,
  name: "Priya Sharma",
  email: "priya@greenpark.com",
  society: "Green Park Apartments",
  state: "maharashtra",
  password: "Admin@123",
  createdAt: "2024-01-15T10:00:00Z",
  role: "admin"
}
```

### Resident User
```javascript
{
  id: 2,
  name: "Raj Kumar",
  email: "raj@greenpark.com",
  society: "Green Park Apartments",
  state: "maharashtra",
  password: "Resident@123",
  createdAt: "2024-01-20T10:00:00Z",
  role: "resident"
}
```

---

## 🔄 Implementation Roadmap

### Phase 1: Basic RBAC ✅ DONE
- [x] Role field in user object
- [x] Role selection during signup
- [x] Demo accounts with roles
- [x] Role stored in session

### Phase 2: UI-Based Access (Ready to Implement)
- [ ] Hide/show buttons based on role
- [ ] Filter data based on role
- [ ] Show/hide pages based on role
- [ ] Role-specific dashboards
- [ ] Role-specific reports

### Phase 3: Backend Enforcement (Future)
- [ ] Server-side role validation
- [ ] API permission checks
- [ ] Audit logging
- [ ] Activity tracking
- [ ] Role management interface

### Phase 4: Advanced Features (Future)
- [ ] User invitations
- [ ] Role changes
- [ ] Permission groups
- [ ] Custom roles
- [ ] Fine-grained permissions

---

## 📋 Implementation Checklist

### For Each Page (members.html, maintenance.html, etc.)

```javascript
// Add at top of page
function checkUserAccess() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!currentUser) {
    // Redirect to login
    window.location.href = 'login.html';
    return false;
  }
  
  return true;
}

// Call on page load
window.addEventListener('load', function() {
  if (!checkUserAccess()) return;
  
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  // Setup UI based on role
  if (user.role === 'admin') {
    setupAdminUI();
  } else if (user.role === 'resident') {
    setupResidentUI();
  }
  
  // Load data
  loadData();
});
```

### For Members Page

```javascript
// Show/hide add button
if (isAdmin()) {
  document.getElementById('addMemberForm').style.display = 'block';
  document.querySelector('.add-member-btn').style.display = 'block';
} else {
  document.getElementById('addMemberForm').style.display = 'none';
  document.querySelector('.add-member-btn').style.display = 'none';
}

// Filter data
const visibleMembers = isAdmin() ? allMembers : allMembers.filter(m => m.email === user.email);
displayMembers(visibleMembers);
```

### For Reports Page

```javascript
// Admin sees all templates
if (isAdmin()) {
  showAllReportTemplates();
} else {
  // Residents see only personal report
  showPersonalReportOnly();
}

// Filter data in reports
const reportData = isAdmin() ? getAllData() : getOwnData(user.email);
```

---

## 🎯 Test Scenarios

### Test Admin User

```
1. Login: demo@society.com / Demo@123
2. Should see:
   ✅ Full dashboard
   ✅ Add Society button
   ✅ Add Member button
   ✅ Edit/Delete buttons
   ✅ Full reports
   ✅ Settings page
```

### Test Resident User

```
1. Login: resident@society.com / Demo@123
2. Should see:
   ✅ Limited dashboard
   ✅ Own member info only
   ❌ No Add Member button
   ❌ No Edit/Delete buttons
   ✅ Own maintenance only
   ✅ Own report only
   ❌ No Settings page
```

---

## 🚀 Usage Instructions

### For Admin

1. **Create Account with Admin Role:**
   - Open login.html
   - Click "Create Account"
   - Select role: "Admin"
   - Create account

2. **Manage Everything:**
   - Add/edit/delete members
   - Configure maintenance rates
   - Generate all reports
   - Access settings
   - Connect Google Sheets

### For Residents

1. **Create Account with Resident Role:**
   - Open login.html
   - Click "Create Account"
   - Select role: "Resident/User"
   - Create account

2. **View Personal Data:**
   - See own member info
   - View own maintenance charges
   - Download own report
   - Cannot modify anything

---

## 📱 Future Enhancements

### Admin Controls
```
[ ] Invite residents to join
[ ] Manage user roles
[ ] View activity logs
[ ] Set permissions
[ ] Create custom roles
[ ] Manage API keys
```

### Resident Features
```
[ ] Request information
[ ] View payment history
[ ] Submit complaints
[ ] Download receipts
[ ] Update profile
```

---

## ✅ Summary

SocietyFlow now has a **simple, effective two-role system**:

- **Admin:** Full control over everything
- **Resident:** View-only access to personal data

The system is ready for implementation across all pages. Follow the checklist above to add role-based access to each module.

---

## 📞 Support

### Demo Credentials

**Admin User:**
```
Email: demo@society.com
Password: Demo@123
Role: Admin
```

**Resident User:**
```
Email: resident@society.com
Password: Demo@123
Role: Resident
```

### For Development

Check the code examples above for:
- How to check user role
- How to hide/show features
- How to filter data
- How to protect actions

---

**Version 2.1 - Role-Based Access Control Implemented**  
*Built for managing diverse user types in residential societies*
