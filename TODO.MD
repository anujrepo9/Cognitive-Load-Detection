# Phased TODO for CODEX

## Phase 1 — Foundation and Correctness

* [ ] Remove stale CSS/build artifacts from the lint scope.
* [ ] Fix source lint warnings.
* [ ] Fix encoding corruption in source files.
* [ ] Centralize API error and loading handling.
* [ ] Centralize model API calls.
* [ ] Fix the WPM field mismatch.
* [ ] Fix token refresh behavior.
* [ ] Fix profile persistence.
* [ ] Connect settings correctly to runtime behavior.
* [ ] Prevent duplicate behavior persistence.
* [ ] Prevent duplicate prediction persistence.
* [ ] Verify frontend/backend connectivity.
* [ ] Verify application startup and database connectivity.

## Phase 2 — Tracking and Trust

* [ ] Introduce a single session/tracking controller.
* [ ] Implement explicit tracking states.
* [ ] Add Start Tracking functionality.
* [ ] Add Pause Tracking functionality.
* [ ] Add End Tracking functionality.
* [ ] Add user consent before tracking begins.
* [ ] Add a precise privacy/data-collection explanation.
* [ ] Display current tracker status.
* [ ] Display data-quality status.
* [ ] Display API/backend connection status.
* [ ] Display offline status when applicable.
* [ ] Add meaningful error messages and recovery actions.

## Phase 3 — Navigation and Responsive Shell

* [ ] Consolidate Dashboard and Live Monitoring into one primary experience.
* [ ] Implement an accessible mobile sidebar drawer.
* [ ] Ensure keyboard navigation works across the navigation shell.
* [ ] Make search functional, or remove the static search UI.
* [ ] Make notifications functional, or remove the static notification UI.
* [ ] Verify responsive behavior across desktop, tablet, and mobile layouts.

## Phase 4 — Page Redesign

### Dashboard

* [ ] Rebuild Dashboard as the current-session command center.
* [ ] Show active tracking state clearly.
* [ ] Show current-session metrics.
* [ ] Show cognitive-load status and trends.
* [ ] Show data-quality and connection status.
* [ ] Provide clear actions for starting, pausing, and ending tracking.

### Sessions

* [ ] Add session drill-down details.
* [ ] Add session filters.
* [ ] Add session search where useful.
* [ ] Add session export functionality.
* [ ] Add meaningful no-data guidance.
* [ ] Prevent duplicate session records.

### Insights

* [ ] Add date/range controls.
* [ ] Improve chart readability.
* [ ] Add explainable chart labels and context.
* [ ] Clearly explain what each insight means.
* [ ] Handle empty and insufficient-data states.
* [ ] Ensure charts are accessible.

### Recommendations

* [ ] Make recommendations actionable.
* [ ] Add acknowledgement tracking.
* [ ] Add completion tracking.
* [ ] Show recommendation status.
* [ ] Provide useful feedback after acknowledgement or completion.

## Phase 5 — Polish and Accessibility

* [ ] Formalize reusable form primitives.
* [ ] Formalize reusable dialog primitives.
* [ ] Formalize reusable toast/notification primitives.
* [ ] Formalize reusable table primitives.
* [ ] Formalize reusable tab primitives.
* [ ] Formalize reusable page-header primitives.
* [ ] Improve keyboard navigation.
* [ ] Improve focus states.
* [ ] Add proper form labels.
* [ ] Improve color contrast.
* [ ] Add reduced-motion support.
* [ ] Improve chart accessibility.
* [ ] Replace unverified marketing claims.
* [ ] Use evidence-backed copy throughout the application.
* [ ] Perform a final frontend/backend integration test.
* [ ] Perform a final responsive and accessibility review.
