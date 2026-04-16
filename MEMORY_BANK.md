# AppliCache Memory Bank

This is the internal source of truth for product design decisions and completed work history.

## Product Design

### Product Purpose

AppliCache helps job seekers manage all job applications in one place instead of using spreadsheets. Users can track each application, update status, and keep notes throughout the hiring process.

### Problem Statement

Most candidates track applications in Excel or Google Sheets, which is hard to maintain and not tailored for application lifecycle workflows.

### Solution Overview

AppliCache provides:

- A React single-page dashboard for managing applications and statuses
- A status-driven workflow from application to final outcome
- A Chrome extension flow to save LinkedIn jobs directly to the dashboard

### Frontend Architecture

- Application type: React SPA
- Main user experience: dashboard for viewing, filtering, and updating applications
- Authenticated user sessions tied to AWS Cognito

### Backend Architecture

- Runtime: Node.js
- Pattern: Raw AWS Lambda handlers behind API Gateway (default recommendation)
- API consumer clients:
  - React frontend
  - Chrome extension

### AWS Services and Responsibilities

- **Amazon Cognito**
  - User sign-up/sign-in
  - Token issuance and identity
- **Amazon API Gateway**
  - Public HTTP API surface
  - Cognito-authorized access to backend routes
- **AWS Lambda**
  - Business logic and request handling
  - Validation and data access orchestration
  - Post Confirmation trigger: after email verification, writes the user profile into DynamoDB (single-table keys `USER#<sub>` / `PROFILE#<sub>`)
- **Amazon DynamoDB**
  - Persistent storage for application records
  - Single-table design (`AppliCacheData` with `PK` / `SK`); user profiles and future entities share one table
- **Amazon S3 + CloudFront (or Amplify Hosting)**
  - Frontend SPA hosting

### Core Domain Model

Primary entity: `Application`

Suggested fields:

- `userId`
- `applicationId`
- `company`
- `jobTitle`
- `jobUrl`
- `source` (for example: linkedin, manual)
- `status` (for example: saved, applied, interview, offer, rejected)
- `notes`
- `appliedAt`
- `createdAt`
- `updatedAt`

### High-Level API Surface

- `POST /applications` create application
- `GET /applications` list applications
- `GET /applications/{id}` get one application
- `PATCH /applications/{id}` update status/details
- `DELETE /applications/{id}` delete application

### LinkedIn Extension Flow

1. User opens a LinkedIn job posting page.
2. Extension reads available job metadata.
3. User clicks add-to-AppliCache action.
4. Extension calls secured AppliCache API.
5. Backend stores the job in DynamoDB under the user account.

## Completed Tasks Backlog

Update this section only when explicitly requested.

| Task | Completed On | Notes |
|---|---|---|
| Created project root folders `backend/` and `frontend/`. | 2026-04-14 | Initial repository structure setup. |
| Created product overview in `README.md`. | 2026-04-14 | Added purpose, architecture, MVP scope, and roadmap. |
| Created `.gitignore` and added `README.md` ignore entry. | 2026-04-14 | Applied requested ignore rule. |
| Created `TASK_TRACKER.md` and iterated its format to completed-only backlog. | 2026-04-14 | Evolved tracker format based on user feedback. |
| Created `MEMORY_BANK.md` as single source of truth and deprecated `TASK_TRACKER.md`. | 2026-04-14 | Migrated tracking workflow to memory bank model. |
| Added project rule in `.cursorrules` for memory bank usage/immutability unless instructed. | 2026-04-14 | Enforced memory-first guidance for future work. |
| Set up frontend React SPA landing flow with routes `/`, `/login`, `/signup`. | 2026-04-14 | Added router, landing hero, and placeholder auth pages. |
| Added minimal AWS SAM scaffold at `backend/template.yaml`. | 2026-04-14 | Created empty SAM template with `Resources: {}`. |
| Created and switched to `aws` git branch for backend SAM/Lambda-focused work. | 2026-04-14 | Branch workflow established for AWS-related changes. |
| Integrated AWS Amplify v6 (`aws-amplify/auth`) in the frontend: `amplifyConfig.js`, `cognitoSignup.js`, `cognitoLogin.js`, `cognitoLogout.js`, `cognitoStub.js`, `cognitoAuthErrors.js`; configure via `VITE_*` env vars. | 2026-04-16 | End-to-end Cognito flows for the SPA. |
| Expanded `backend/template.yaml` with Cognito User Pool + app client (email alias, password policy, required attributes, SRP + refresh flows, no client secret). | 2026-04-16 | Replaced empty SAM scaffold with auth-ready Cognito resources. |
| Added `/dashboard` route, `DashboardPage` (auth gate, welcome, sign out), and `LandingPage` redirect to dashboard when already signed in. | 2026-04-16 | Baseline authenticated shell for post-login UX. |
| Implemented sign-up with profile fields, email verification (`confirmSignUp`), and resend code; wired `SignupPage` to Cognito. | 2026-04-16 | Registration path aligned with pool required attributes. |
| Implemented sign-in restricted to **email only** (`LoginPage` + validation); Cognito `loginWith`: `email: true`, `username: false`; sign-in uses verified email as Amplify `username` parameter. | 2026-04-16 | Avoids username-vs-alias confusion; simplified login UX. |
| Stopped ignoring `MEMORY_BANK.md` in `.gitignore` so the memory bank is tracked in git. | 2026-04-16 | Keeps product/design history with the repo. |
| Merged `feature/user-handling` into `main` and pushed to `origin` (includes Cognito integration and dashboard shell). | 2026-04-16 | Remote `main` updated to match integrated feature work. |
| Redesigned global SPA styles in `frontend/src/styles.css` (design tokens, subtle motion, `prefers-reduced-motion`, landing/auth/dashboard polish); removed unused `frontend/src/style.css`; replaced inline styles with utility classes where appropriate; `frontend/src/main.ts` now imports `styles.css` if used. | 2026-04-16 | Cleaner, Apple-inspired UI; no new runtime deps. |
| Added `AppliCacheData` DynamoDB table to `backend/template.yaml` (partition key `PK`, sort key `SK`, on-demand billing) with stack outputs for name and ARN. | 2026-04-16 | Establishes single-table storage for profiles and future application entities. |
| Implemented Cognito **Post Confirmation** Lambda at `backend/functions/postConfirmation/` (Node.js 20, AWS SDK v3 `PutItem`); profile item shape `PK` = `USER#<sub>`, `SK` = `PROFILE#<sub>` with email, names, birthdate, username, `createdAt`. Wired IAM (`dynamodb:PutItem` on table only), `AWS::Lambda::Permission` for `cognito-idp.amazonaws.com`, and `CognitoUserPool.LambdaConfig.PostConfirmation` in SAM. | 2026-04-16 | Confirmed users get a profile row automatically after email verification. |
| Added root `.gitignore` entry `node_modules/` (covers frontend and packaged Lambda dependencies). | 2026-04-16 | Avoids committing installed packages. |

### Recent work log (since last backlog snapshot)

Entries below mirror the table above in narrative form for quick scanning.

**2026-04-16 — Repository**

- Removed `MEMORY_BANK.md` from `.gitignore` and merged `feature/user-handling` into `main`, then pushed so the memory bank and integrated auth/dashboard work live on `origin/main`.

**2026-04-16 — Frontend**

- Shipped a CSS-first UI pass: expanded tokens, backgrounds, button/input focus and hover behavior, staggered hero entry animation where appropriate, loading state with dot pulse, and glass-style auth card; deleted the orphaned `style.css` asset and consolidated on `styles.css`.

**2026-04-16 — Backend / AWS**

- Defined the single DynamoDB table `AppliCacheData` in SAM and deployed the Post Confirmation Lambda that persists `USER#<sub>` / `PROFILE#<sub>` items after successful sign-up confirmation, with least-privilege IAM and Cognito invoke permission.

## Update Policy

- Do not modify this file unless the user explicitly asks.
- When requested, append completed tasks to the backlog table and keep design decisions current.
