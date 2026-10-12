# CampusLink forgot-password entry point

## Goal

Expose the existing password-reset request flow from the sign-in form so students and staff can recover access.

## Existing behavior

- `LoginPage` already receives an `onForgot` callback, but does not render or use it.
- `/app/forgot-password` renders the request form and returns to sign-in.
- The form submits to the existing unauthenticated `/api/v1/auth/forgot-password` endpoint and displays its current success/error states.
- `/app/reset-password` handles the reset token flow.

## Requirements

1. Add a clearly labeled, keyboard-accessible “Forgot password?” control to the sign-in form and call the existing `onForgot` callback.
2. Show the control only in sign-in mode, not while creating an account.
3. Preserve the existing layout, color palette, account-type selection, validation, and submit behavior.
4. Do not change API contracts, reset-token behavior, or disclosure-safe server responses.
5. Verify the link opens the request page, the back action returns to sign-in, and the client production build passes.

## Working approach

Make the smallest client-only JSX/style change in `client/app/page.tsx` and `client/app/dashboard.css` if styling is needed. Run the client build and check the sign-in and registration modes.