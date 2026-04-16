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
- **Amazon DynamoDB**
  - Persistent storage for application records
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

## Update Policy

- Do not modify this file unless the user explicitly asks.
- When requested, append completed tasks to the backlog table and keep design decisions current.
