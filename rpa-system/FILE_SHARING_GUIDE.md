# File Sharing System Documentation

## Overview

The EasyFlow file sharing system allows users to securely share files with external parties through password-protected, time-limited links with granular permission controls.

## Features

### 🔐 **Security Features**

- **Token-based access**: Each share generates a unique, cryptographically secure token
- **Password protection**: Optional password requirement with bcrypt hashing
- **Time-based expiration**: Set custom expiration dates for shares
- **Download limits**: Control maximum number of downloads
- **Access logging**: Track all access attempts with IP addresses and timestamps

### 👥 **Permission Levels**

1. **View Only**: Preview files without downloading
2. **Download**: View and download files
3. **Comment**: View, download, and add comments (future feature)

### 📊 **Management Features**

- **Share management**: View, edit, and delete existing shares
- **Access analytics**: Monitor who accessed shared files and when
- **Bulk operations**: Manage multiple shares simultaneously
- **Copy to clipboard**: Easy sharing with one-click link copying

## How to Use

### Creating a Share

1. Navigate to the Files page in your dashboard
2. Find the file you want to share
3. Click the **🔗 Share** button on the file card
4. Configure sharing settings:
   - **Permission Level**: Choose view-only or download access
   - **Password Protection**: Enable to require a password
   - **Expiration Date**: Set when the share should expire
   - **Download Limit**: Limit the number of downloads
   - **Anonymous Access**: Allow access without user accounts

### Sharing Settings

#### **Basic Settings**

- **Share Name**: Give your share a memorable name
- **Permission**: Select the level of access recipients will have

#### **Security Settings**

- **Require Password**: Check to add password protection
- **Password**: Set a strong password for access
- **Allow Anonymous**: Permit access without user registration

#### **Advanced Settings**

- **Expires At**: Set an expiration date/time
- **Max Downloads**: Limit total number of downloads
- **Notify on Access**: Get email notifications when accessed (future feature)

### Managing Existing Shares

The sharing dialog displays all existing shares for a file:

- **Share Link**: Click to copy the share URL
- **Settings**: View current permission and security settings
- **Stats**: See access count and last accessed date
- **Actions**: Edit or delete shares

### Accessing Shared Files

Recipients can access shared files by:

1. Clicking the shared link
2. Entering password if required
3. Viewing/downloading based on permissions

## Technical Implementation

### Frontend Components

- **FileSharing.jsx**: Main sharing dialog with form controls
- **SharedFilePage.jsx**: Public access page for shared files
- **FileManager.jsx**: Integration point with share buttons

### Backend Endpoints

- `POST /api/files/shares` - Create new share
- `GET /api/files/:id/shares` - Get shares for a file
- `PUT /api/files/shares/:shareId` - Update share settings
- `DELETE /api/files/shares/:shareId` - Delete share
- `POST /api/shared/access` - Access shared file

### Database Schema

- **file_shares**: Main shares table with tokens and settings
- **file_share_access_logs**: Access tracking and analytics

### Security Considerations

- All share tokens are cryptographically secure (32+ bytes)
- Passwords are hashed using bcrypt with salt rounds
- Expired shares are automatically deactivated
- Access attempts are logged for security monitoring
- File access uses signed URLs with time-limited validity

## API Usage Examples

### Creating a Share

```javascript
const shareData = {
  permission: "download",
  requirePassword: true,
  password: "securepassword123",
  expiresAt: "2024-12-31T23:59:59Z",
  maxDownloads: 10,
  allowAnonymous: true,
};

const share = await createFileShare(fileId, shareData);
console.log("Share URL:", getShareUrl(share.token));
```

### Accessing a Shared File

```javascript
const token = "secure-share-token";
const password = "securepassword123";

try {
  const fileData = await getSharedFile(token, password);
  console.log("File:", fileData.file);
  console.log("Download URL:", fileData.downloadUrl);
} catch (error) {
  console.error("Access denied:", error.message);
}
```

## Troubleshooting

### Common Issues

**Share Link Not Working**

- Check if share has expired
- Verify password is correct
- Ensure share is still active

**Download Limit Reached**

- Share owner can increase limit in settings
- Create a new share if needed

**Password Not Accepted**

- Passwords are case-sensitive
- Check for extra spaces or special characters

### Database Maintenance

Run periodic cleanup to remove expired shares:

```sql
SELECT cleanup_expired_shares();
```

## Future Enhancements

- **Comment system**: Allow recipients to leave feedback
- **Email notifications**: Notify on share access
- **Usage analytics**: Detailed access reports
- **Batch sharing**: Share multiple files at once
- **QR codes**: Generate QR codes for easy mobile access

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.
