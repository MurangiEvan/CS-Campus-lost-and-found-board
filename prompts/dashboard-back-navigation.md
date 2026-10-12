# CampusLink dashboard back navigation

## Goal

Add a clear back-to-dashboard control for secondary student and campus-security views.

## Behavior

- Student views other than Home get a Back to dashboard control that navigates to the student's Home view (`/app`). Hide it on Home.
- Security Items and Release views get a Back to dashboard control that returns to the security Dashboard view. Hide it on the security Dashboard.
- Do not use `history.back()` as the only behavior; direct links and empty browser history must never send users out of CampusLink.
- Keep the existing student navigation and security bottom navigation intact.

## Constraints

- Follow the repository workflow and client instructions.
- Keep the change in the existing client UI and follow its current palette and button styles.
- Use an accessible button label and visible focus state; ensure it fits on mobile and desktop.
- Do not change API behavior, auth routing, or role authorization.

## Acceptance criteria

- The student Back to dashboard button appears on Browse, My Reports, Notifications, and Account, and returns to Home.
- The security Back to dashboard button appears on Items and Release, and returns to the security overview.
- Neither back control appears on its role's dashboard root.
- The controls work after direct navigation as well as in-app navigation.
- Client lint/build checks pass, or pre-existing failures are reported separately.