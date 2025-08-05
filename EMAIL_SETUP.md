# Email Configuration Guide

## Setting Up Email Notifications

The parent-school collaboration platform includes email notifications for:
- Welcome emails for new users
- Approval notifications for parents
- Rejection notifications for parents

## Configuration Steps

### 1. Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Update Environment Variables** in `config.env`:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

### 2. Alternative Email Providers

You can use any SMTP provider. Update the email configuration in `config/database.js`:

```javascript
const transporter = nodemailer.createTransporter({
  service: 'gmail', // or 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

### 3. Testing Email Configuration

1. Start the server: `npm start`
2. Register a new parent account
3. Login as admin and approve the parent
4. Check console logs for email status

### 4. Troubleshooting

**Common Issues:**
- **"Invalid login" error**: Check your email and app password
- **"Less secure app" error**: Use app passwords instead of regular passwords
- **No emails sent**: Check if EMAIL_USER and EMAIL_PASS are set in config.env

**Without Email Configuration:**
- The system will work without email notifications
- Console logs will show what emails would be sent
- All approval/rejection functionality works normally

## Current Status

✅ **Admin Approval System**: Fully functional
✅ **Email Notifications**: Configured (requires email setup)
✅ **User Management**: Complete with approval workflow
✅ **Security**: Proper authentication and authorization

The approval system works perfectly even without email configuration! 