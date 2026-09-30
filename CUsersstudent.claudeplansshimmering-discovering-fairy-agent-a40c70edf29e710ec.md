# Implementation Plan: Forgot Password Feature

This plan outlines the implementation of a secure "Forgot Password" flow for CampusLink, allowing users to reset their passwords via email.

## 1. Database Changes
Add fields to the `users` table to store the reset token and its expiration.

**SQL Migration:**
```sql
ALTER TABLE users 
ADD COLUMN reset_token TEXT,
ADD COLUMN reset_token_expires TIMESTAMP WITH TIME ZONE;
```

## 2. Backend Implementation

### 2.1 Email Utility (`server/utils/email.js`)
Create a new utility using `nodemailer` to handle sending reset emails.
- **Configuration**: Use environment variables for SMTP settings (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`).
- **Function**: `sendPasswordResetEmail(email, token)` which sends a link to `/app/reset-password?token=...`.

### 2.2 User Model Updates (`server/models/user.model.js`)
Add the following methods to the `User` object:
- `setResetToken(userId, token)`: Stores the token and expiration (1 hour).
- `findByResetToken(token)`: Retrieves user by token and verifies `reset_token_expires > NOW()`.
- `updatePassword(userId, passwordHash)`: Updates the password and clears the reset token.

### 2.3 Auth Controller Logic (`server/controllers/auth.controller.js`)

#### `forgotPassword` (POST `/api/v1/auth/forgot-password`)
1. Validate that the email is provided and is a `@tut4life.ac.za` email.
2. Search for the user by email.
3. **Security**: Regardless of whether the user exists, return a success message: *"If an account exists for this email, a reset link has been sent."*
4. If user exists:
   - Generate a cryptographically secure token (using `crypto.randomBytes(32).toString('hex')`).
   - Save the token and expiry to the database.
   - Send the email using the email utility.

#### `resetPassword` (POST `/api/v1/auth/reset-password`)
1. Validate that `token` and `newPassword` are provided.
2. Find user by token and verify it hasn't expired.
3. If invalid/expired, return `400 Bad Request` ("Invalid or expired reset token").
4. Hash the new password using `bcryptjs` (salt rounds = 12).
5. Update user record and clear the `reset_token` and `reset_token_expires`.
6. Return success response.

### 2.4 Route Definitions (`server/routes/auth.routes.js`)
Add the new routes:
```javascript
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
```

## 3. Frontend Implementation

### 3.1 Login Page Update (`client/app/page.tsx`)
- Add a "Forgot Password?" link in the `LoginPage` component.
- The link should navigate the user to a new "Forgot Password" view (or a new page).

### 3.2 Forgot Password Request View (`client/app/forgot-password/page.tsx`)
- A simple form with an email input.
- Calls `POST /api/v1/auth/forgot-password`.
- Displays a success message upon submission.

### 3.3 Password Reset View (`client/app/reset-password/page.tsx`)
- Extracts the `token` from the URL query parameters.
- A form with "New Password" and "Confirm Password" inputs.
- Validates that passwords match.
- Calls `POST /api/v1/auth/reset-password` with the token and new password.
- Redirects the user to the login page upon success.

## 4. Security Considerations
- **Email Enumeration**: Handled by returning a generic success message in `forgotPassword`.
- **Token Security**: Use `crypto.randomBytes` for high entropy.
- **Token Expiry**: Strictly enforced via database timestamps.
- **Password Hashing**: Consistent use of `bcryptjs` (12 rounds).
- **Input Validation**: Ensure emails are normalized (lowercase/trimmed) and passwords meet minimum length requirements.

## Critical Files for Implementation
- `server/models/user.model.js`
- `server/controllers/auth.controller.js`
- `server/routes/auth.routes.js`
- `server/utils/email.js` (New)
- `client/app/page.tsx`
- `client/app/forgot-password/page.tsx` (New)
- `client/app/reset-password/page.tsx` (New)
EOF`
