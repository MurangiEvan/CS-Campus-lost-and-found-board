# CampusLink dashboard screens redesign

## Goal

Update the CampusLink client UI to closely follow the attached mobile reference screens while preserving the existing API-backed behavior, account roles, and security rules. Treat the attached images in the user's request as the visual source of truth.

## Reference surfaces

Implement the student and campus-security surfaces shown in the references:

- Student home dashboard with greeting, active-report summary, Report Lost and Report Found actions, and a compact recent-campus list.
- Student My Reports and Notifications screens.
- Lost-item and found-item report forms, item details, and the relevant report/claim actions.
- Security dashboard with custody/awaiting/resolved counts, Log Found Item and Release Item actions, and recently received items.
- Security item-management list with search and status filters, found-item intake form, and release verification screen.

## Existing implementation to build on

- The main client UI and role switch are in `client/app/page.tsx`; staff accounts currently enter `SecurityDashboard`, while students see home, browse, reports, notifications, and account views.
- Styles are in `client/app/globals.css` and reusable primitives are in `client/components/ui.tsx`.
- The item UI already uses the authenticated item API. Preserve real persisted item data; do not add demo-only dashboard records or replace API behavior with hard-coded screenshot content.
- Existing security actions include found-item report entry, resolution handling, reassignment hooks, and a release-protocol dialog. Reuse and improve those behaviors where possible.
- Staff release verification must be submitted to and enforced by the API, not only gated by client controls; record its completion in the existing resolution history.

## Visual direction

- Match the references' narrow mobile composition first: pale blue-gray page background, white compact headers and list rows, deep navy primary actions/security header, warm gold secondary actions and avatar, restrained blue accent, rounded controls, and compact readable typography.
- Student list rows should be scannable, with a clear item/category symbol, title, location/date metadata, and a compact status badge. Match summaries and notifications to the sparse spacing and visual hierarchy in the references.
- Report forms should use full-width touch-friendly fields, selectable item categories, date/location controls, a dashed optional-photo affordance, and a clear bottom action. Keep lost and found visually distinct as shown.
- Security screens should prioritize queue counts, custody status, item storage references, and the release-verification checklist. Make primary actions easy to reach on mobile.
- At desktop widths, expand into a restrained, centered workspace without changing the screenshot's hierarchy or introducing decorative marketing sections.
- Use the existing design system and dependencies where possible. Do not add an icon package unless existing options prove inadequate. Ensure focus, labels, accessible names, and visible loading/empty/error/success states remain clear.

## Implementation requirements

1. Inspect the current JSX, role navigation, CSS, route handling, and applicable Next.js documentation before implementation. Follow `AGENTS.md`, `client/AGENTS.md`, `PROJECT_CONTRACT.md`, and existing client conventions.
2. Update the existing components and styling with a focused implementation. Avoid a broad rewrite of the monolithic page unless a small extraction is needed for maintainability.
3. Keep student and staff authorization distinctions intact. Do not expose controls as a substitute for server-side authorization.
4. Keep every displayed item sourced from the API. Keep mutations on the existing API path and refresh/reflect persisted server state rather than presenting success optimistically.
5. Do not imply notifications are persisted/read-tracked if they are not. Do not add unrelated backend contracts, external identity integration, delivery, payments, chat, or other out-of-scope features.
6. Where a screenshot shows a dedicated screen but the current client only has a modal or no route, decide the smallest coherent way to present that workflow within the existing navigation. Do not create nonfunctional placeholder navigation. Keep current working behavior accessible.
7. Ensure the student mobile navigation and security navigation do not cover page content or controls. Provide responsive behavior for narrow phones and desktop widths.
8. Preserve form validation, error reporting, loading feedback, empty states, and keyboard accessibility.

## Acceptance criteria

- Student home, My Reports, Notifications, lost/found reporting, and item details resemble their corresponding references on a narrow mobile viewport and remain coherent on desktop.
- Staff dashboard, custody management, intake, and release verification follow the security references; controls remain connected to real implemented actions.
- Existing API-backed data and server-enforced permissions are preserved; there are no screenshot-only seed values.
- No horizontal overflow or obstructed content at phone widths; mobile navigation does not overlap the last list row or primary action.
- Client lint and production build pass, or any pre-existing/unrelated failures are reported accurately.
- Provide exact local test steps for student and staff accounts and the viewports used for verification.

## Working approach

1. Read the current Next.js version's relevant local documentation and identify the UI sections to adapt.
2. Implement the mobile-first visual update in the existing client structure, adding only the minimum navigation/screen structure required for the shown workflows.
3. Run client lint and production build, then verify student and staff screens at phone and desktop sizes if a browser preview is available.
4. Report changed surfaces, checks, and any functionality that the existing API does not yet support.