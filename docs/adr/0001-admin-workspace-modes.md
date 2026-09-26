# ADR 0001: Admin uses explicit workspace modes

## Status

Accepted

## Context

The product normally fixes each Google identity to either teacher or student. Development needs one trusted account to exercise both complete experiences without maintaining two Google accounts. Making admin a third workspace would duplicate UI and would not test the real teacher and student paths. Giving admin unrestricted access at all times would also make accidental cross-role operations easy.

## Decision

Add `admin` as an account role and store one active workspace mode (`teacher` or `student`) for admin accounts. Route guards, Server Actions, and Row Level Security all resolve authorization through that active mode. Switching mode changes the persisted mode atomically and routes to the corresponding real workspace.

Teacher-owned records and student-owned records continue to use the same authenticated user ID, but each mode exposes only its own navigation and operations. Admin has no separate dashboard.

## Consequences

- The admin account can test the production teacher and student experiences with one Google login.
- A mode switch applies across sessions because it is stored in the profile.
- Teacher and student data remain separate by domain relationship, while sharing one identity for authentication.
- Admin assignment remains a privileged database operation; onboarding can never select it.

