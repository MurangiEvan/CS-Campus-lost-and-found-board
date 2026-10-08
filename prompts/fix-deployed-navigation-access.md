# Fix Dashboard Navigation Access

## Goal

Make it reliably possible to dismiss the report modal and use the dashboard navigation on deployed desktop and mobile layouts.

## Verified findings

- Home, Browse, My reports, and Notifications buttons call `navigateToView`, which uses Next.js `router.push` to `/app`, `/app/browse`, `/app/reports`, and `/app/notifications`.
- The catch-all `/app/[[...section]]` route explicitly allows those destinations.
- The report modal uses a fixed full-screen backdrop with `z-index: 10`, so it correctly blocks interaction with the underlying navigation until dismissed.
- The report modal itself is scrollable. Its close button is absolutely positioned inside that scrolling element, so after scrolling through the form it can leave the visible area; the deployed screenshot shows this state.
- At mobile widths, the dashboard nav is fixed to the bottom of the viewport, but the modal backdrop remains above it while a modal is open.

## Planned implementation

1. Adjust only the report modal header/close control so the close action remains visible and reachable while the modal content scrolls, including on small viewports.
2. Preserve modal behavior: background navigation stays inert while the modal is open; closing it restores access to the navigation.
3. Add explicit `type="button"` and active-route accessibility state to the four dashboard nav controls if needed, without changing their destinations.
4. Verify the four navigation routes by clicking the controls after closing the modal, at desktop and mobile viewport sizes. Ensure the modal close control remains visible after scrolling.
5. Do not change authentication, report submission, API routing, or storage configuration in this task.

## Acceptance criteria

- The close control remains visible when the report modal is scrolled to the bottom.
- After dismissing the modal, Home, Browse, My reports, and Notifications each navigate to the matching route and render the corresponding view.
- At mobile widths, nav controls remain visible, individually tappable, and do not overlap the modal after it closes.
- The modal continues to prevent interaction with the obscured dashboard while open.
