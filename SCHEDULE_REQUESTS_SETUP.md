# Schedule Requests Feature Setup

This document describes the schedule requests feature that allows donors to request donation schedules and admins to review and approve/reject them.

## Database Setup

Before using this feature, you need to create the `schedule_requests` table in your database. Run the following SQL script:

```sql
-- Create schedule_requests table
CREATE TABLE IF NOT EXISTS schedule_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TIME NOT NULL,
  last_donation_date DATE,
  weight DECIMAL(5,2),
  health_screening_answers JSON,
  notes TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  reviewed_by INT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_preferred_date (preferred_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

You can find this SQL in `backend/scripts/createScheduleRequestsTable.sql`.

## Features Implemented

### Donor Side
1. **Set Schedule Button** - Added to the donor dashboard
2. **Schedule Request Modal** - Form with:
   - Eligibility guidelines display
   - Preferred date and time
   - Last donation date
   - Weight
   - Health screening questions (Yes/No)
   - Notes (optional)
   - Confirmation checkbox
3. **Schedule Request Status Display** - Shows the latest request status on the dashboard
4. **Notifications** - Displays approval/rejection notifications

### Admin Side
1. **Schedule Requests Button** - Added to the admin donation page (next to "Add Donor")
2. **Schedule Requests Modal** - Lists all schedule requests with:
   - Donor name
   - Preferred date & time
   - Status (Pending/Approved/Rejected)
   - Submitted date/time
   - View Details button
3. **Request Details Modal** - Shows all request information:
   - Donor profile info
   - Preferred date & time
   - Last donation date
   - Weight
   - Health screening answers
   - Current status
   - Admin notes field (for approval)
   - Rejection reason field (for rejection)
   - Approve/Reject buttons

### Rules Implemented
- Donor cannot submit a new schedule request if there is an existing Pending request
- Rejection requires a rejection reason
- Notifications are automatically sent when requests are approved/rejected
- UI updates in real-time after actions

## API Endpoints

### Donor Endpoints
- `GET /api/user/schedule-requests` - Get donor's schedule requests
- `POST /api/user/schedule-requests` - Create schedule request

### Admin Endpoints
- `GET /api/admin/schedule-requests` - Get all schedule requests
- `GET /api/admin/schedule-requests/:id` - Get schedule request details
- `PATCH /api/admin/schedule-requests/:id/approve` - Approve request
- `PATCH /api/admin/schedule-requests/:id/reject` - Reject request

## Usage

1. **Donor creates a schedule request:**
   - Log in as a donor
   - Click "Set Schedule" button on dashboard
   - Fill out the form
   - Submit request

2. **Admin reviews requests:**
   - Log in as admin
   - Go to Admin > Donations page
   - Click "Schedule Requests" button
   - View details of any request
   - Approve or reject with notes/reason

3. **Donor receives notifications:**
   - Notifications appear in the notification dropdown
   - Schedule request status is displayed on dashboard
