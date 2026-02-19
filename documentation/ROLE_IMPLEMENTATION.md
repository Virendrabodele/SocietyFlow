# Role-Based Access Implementation Guide

## 🎯 Overview

This guide shows you how to implement role-based access control on each page of SocietyFlow for **Admin** and **Resident/User** roles.

---

## 📋 Roles Definition

### Admin
- Full access to everything
- Can create, edit, delete
- Can access settings
- Can manage users
- Can generate all reports

### Resident
- Limited read-only access
- Can only view own data
- Cannot create/edit/delete
- Cannot access settings
- Can view own reports only

---

## 🔧 Implementation on Each Page

### 1. members.html

**At the top of the script section, add:**

```javascript
// Check user role and setup UI
function setupMembersPageAccess() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  if (currentUser.role === 'resident') {
    // Hide admin features
    document.getElementById('memberForm').style.display = 'none';
    document.querySelector('.search-box').parentElement.style.display = 'none';
    
    // Show resident message
    document.getElementById('membersList').innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #6b7280;">
        <p>Your Member Information</p>
        <p style="margin-top: 1rem; font-size: 0.9rem;">Contact your society admin for detailed information.</p>
      </div>
    `;
  } else {
    // Admin sees everything - load normally
    displayMembers(members);
  }
}

// Call on page load
window.addEventListener('load', setupMembersPageAccess);
```

**Add to HTML Form:**
```html
<!-- Show this button only for admins -->
<button id="addMemberBtn" class="btn btn-primary" onclick="document.getElementById('memberForm').scrollIntoView()">
  Add Member
</button>

<script>
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user.role !== 'admin') {
    document.getElementById('addMemberBtn').style.display = 'none';
  }
</script>
```

**Filter displayed members:**
```javascript
// Before displaying members
function getDisplayableMembers(allMembers) {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (user.role === 'admin') {
    return allMembers; // Show all
  } else {
    // Show only this resident's info
    return allMembers.filter(m => m.email === user.email);
  }
}

// Use it like:
const visibleMembers = getDisplayableMembers(members);
displayMembers(visibleMembers);
```

**Hide action buttons for residents:**
```javascript
function displayMembers(membersToShow) {
  // ... existing code ...
  
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  membersToShow.forEach(member => {
    let tableHTML = `<tr>...`;
    
    // Show edit/delete only for admins
    if (user.role === 'admin') {
      tableHTML += `
        <td>
          <button class="btn-edit" onclick="editMember(${member.id})">Edit</button>
          <button class="btn-delete" onclick="deleteMember(${member.id})">Delete</button>
        </td>
      `;
    }
    
    tableHTML += `</tr>`;
    container.innerHTML += tableHTML;
  });
}
```

---

### 2. maintenance.html

**Add access control:**

```javascript
// At page load
window.addEventListener('load', function() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  if (user.role === 'resident') {
    // Hide calculation setup for residents
    document.querySelector('.form-section').style.display = 'none';
    
    // Show only resident's charges
    showResidentMaintenance(user);
  } else {
    // Admin sees everything
    loadMembersForCalculation();
  }
});

function showResidentMaintenance(user) {
  const html = `
    <div style="background: white; padding: 2rem; border-radius: 12px;">
      <h2>Your Maintenance Information</h2>
      <div style="margin-top: 2rem;">
        <p><strong>Member Name:</strong> ${user.name}</p>
        <p><strong>Monthly Charge:</strong> ₹5,000 (Sample)</p>
        <p><strong>Amount Paid:</strong> ₹5,000</p>
        <p><strong>Outstanding:</strong> ₹0</p>
      </div>
      <p style="margin-top: 2rem; color: #6b7280; font-size: 0.9rem;">
        Contact your society admin for details about calculation methodology.
      </p>
    </div>
  `;
  
  document.getElementById('maintenanceTable').innerHTML = html;
}
```

---

### 3. reports.html

**Add access control:**

```javascript
// At page load
window.addEventListener('load', function() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  if (user.role === 'resident') {
    // Hide report templates
    document.querySelector('.form-section:first-of-type').style.display = 'none';
    
    // Show only personal report
    showPersonalReport(user);
  } else {
    // Admin sees everything
    setupAdminReports();
  }
});

function showPersonalReport(user) {
  // Generate report for resident
  const reportHTML = `
    <div style="background: white; padding: 2rem; border-radius: 12px;">
      <h2>Your Maintenance Report</h2>
      
      <table style="width: 100%; margin-top: 1rem; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <th style="padding: 1rem; text-align: left;">Month</th>
          <th style="padding: 1rem; text-align: left;">Charge</th>
          <th style="padding: 1rem; text-align: left;">Paid</th>
          <th style="padding: 1rem; text-align: left;">Outstanding</th>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 1rem;">February 2024</td>
          <td style="padding: 1rem;">₹5,000</td>
          <td style="padding: 1rem;">₹5,000</td>
          <td style="padding: 1rem;">₹0</td>
        </tr>
      </table>
      
      <button class="btn btn-primary" style="margin-top: 2rem;" onclick="window.print()">
        Print Report
      </button>
    </div>
  `;
  
  document.getElementById('reportContent').innerHTML = reportHTML;
  document.getElementById('reportSection').style.display = 'block';
}
```

---

### 4. settings.html

**Add access control:**

```javascript
// At very top of page load
window.addEventListener('load', function() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  if (user.role !== 'admin') {
    // Redirect residents away
    document.body.innerHTML = `
      <div style="
        padding: 4rem 2rem;
        text-align: center;
        color: #ef4444;
        font-size: 1.2rem;
      ">
        <h1>❌ Access Denied</h1>
        <p>Only Admins can access settings.</p>
        <button onclick="window.location.href='dashboard.html'" style="
          margin-top: 2rem;
          padding: 0.75rem 2rem;
          background: #1e40af;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        ">
          Go Back to Dashboard
        </button>
      </div>
    `;
    return;
  }

  // Normal settings page for admins
  loadSettings();
});
```

---

### 5. index.html (Home/Dashboard)

**Add access control:**

```javascript
// Check role before showing certain features
window.addEventListener('load', function() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Show role in header
  const roleDisplay = document.createElement('div');
  roleDisplay.style.cssText = `
    padding: 0.5rem 1rem;
    background: #f8fafc;
    border-radius: 6px;
    font-weight: 600;
    color: #1e40af;
  `;
  roleDisplay.textContent = `Role: ${user.role === 'admin' ? 'Admin' : 'Resident'}`;
  
  document.querySelector('.nav-container').appendChild(roleDisplay);

  // Hide admin features for residents
  if (user.role === 'resident') {
    // Hide settings link
    document.querySelector('a[href="settings.html"]').style.display = 'none';
  }
});
```

---

## 📝 Helper Functions

Create a `rbac.js` file for reuse:

```javascript
// rbac.js - Role-Based Access Control Helper

/**
 * Check if current user is admin
 */
function isAdmin() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  return user && user.role === 'admin';
}

/**
 * Check if current user is resident
 */
function isResident() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  return user && user.role === 'resident';
}

/**
 * Get current user
 */
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('currentUser'));
}

/**
 * Check if user can access page
 */
function requireAdmin(onDeny = 'redirect') {
  if (!isAdmin()) {
    if (onDeny === 'redirect') {
      window.location.href = 'dashboard.html';
    }
    return false;
  }
  return true;
}

/**
 * Show/hide elements based on role
 */
function setupRoleUI() {
  const adminElements = document.querySelectorAll('[data-role="admin"]');
  const residentElements = document.querySelectorAll('[data-role="resident"]');

  adminElements.forEach(el => {
    el.style.display = isAdmin() ? 'block' : 'none';
  });

  residentElements.forEach(el => {
    el.style.display = isResident() ? 'block' : 'none';
  });
}

/**
 * Protect an action
 */
function protectAction(action, requiredRole = 'admin') {
  const user = getCurrentUser();
  
  if (!user) {
    alert('Please login first');
    window.location.href = 'login.html';
    return false;
  }

  if (user.role !== requiredRole) {
    alert(`❌ This action requires ${requiredRole} role`);
    return false;
  }

  return true;
}
```

**Use in HTML:**
```html
<button data-role="admin" onclick="handleAddMember()">Add Member</button>
<button data-role="resident" disabled>Cannot add members</button>

<script src="rbac.js"></script>
<script>
  window.addEventListener('load', setupRoleUI);
</script>
```

---

## 🔐 Security Notes

### Client-Side (What You're Doing Now)
- ✅ Hide UI elements
- ✅ Disable buttons
- ✅ Redirect pages
- ⚠️ **NOT SECURE** - User can modify with developer tools

### Server-Side (For Production)
- ✅ Verify role on backend
- ✅ Check permissions before processing
- ✅ Log access attempts
- ✅ Encrypt sensitive data
- ✅ **SECURE** - Cannot be bypassed

### Implementation Strategy

```javascript
// Current (Client-Side Only - MVP)
if (isAdmin()) {
  // Show button
}

// Production (Client + Server)
if (isAdmin()) {
  // Show button
  // onClick handler calls API
  // API verifies role again
  // API checks if user is authorized for this action
  // API processes and returns result
}
```

---

## 📋 Checklist

### For Each Page

- [ ] Add role check at page load
- [ ] Hide admin-only buttons/forms for residents
- [ ] Filter data based on role
- [ ] Show appropriate messages to residents
- [ ] Protect sensitive actions
- [ ] Test with both admin and resident accounts

### Testing

```
Test Admin User:
[ ] Can see all features
[ ] Can add/edit/delete
[ ] Can access settings
[ ] Can generate all reports

Test Resident User:
[ ] Cannot see admin buttons
[ ] Can view own data only
[ ] Cannot edit anything
[ ] Cannot access settings
[ ] Can see own report only
```

---

## 🚀 Deployment Checklist

### Before Going Live

- [ ] All pages have role checks
- [ ] Admin features hidden from residents
- [ ] Data properly filtered by role
- [ ] All buttons protected with role checks
- [ ] Error messages friendly
- [ ] Tested with both roles
- [ ] Performance acceptable
- [ ] No console errors

### For Production

- [ ] Move role validation to backend
- [ ] Implement proper authentication
- [ ] Use encrypted tokens
- [ ] Log all admin actions
- [ ] Set up audit trail
- [ ] Add rate limiting
- [ ] Enable HTTPS

---

## 📞 Testing Credentials

### Admin Account
```
Email: demo@society.com
Password: Demo@123
Role: Admin
Access: Full
```

### Resident Account
```
Email: resident@society.com
Password: Demo@123
Role: Resident
Access: Limited
```

---

## ✅ Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Role selection at signup | ✅ Complete | Done in login.html |
| Role stored in session | ✅ Complete | Stored in currentUser |
| Dashboard role check | ✅ Complete | Shows/hides society list |
| Demo accounts with roles | ✅ Complete | Admin + Resident accounts |
| RBAC Guide | ✅ Complete | This document |
| Members.html protection | 📋 To do | Follow guide above |
| Maintenance.html protection | 📋 To do | Follow guide above |
| Reports.html protection | 📋 To do | Follow guide above |
| Settings.html protection | 📋 To do | Follow guide above |
| Helper functions | 📋 To do | Create rbac.js |
| Backend verification | 📋 Future | When backend added |

---

**Start implementing role-based access on each page using the code examples above!**

---

*Version 2.1 - Role-Based Access Control Implementation Guide*
