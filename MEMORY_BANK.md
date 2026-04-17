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
| Implemented **boards** Lambda (`GET`/`POST /boards`): create/list user boards in `AppliCacheData` with `PK`=`USER#<sub>`, `SK`=`BOARD#<id>`; `POST` stores `entityType: BOARD`, `boardName`, `createdAt`/`updatedAt` (ISO), default **columns** (Company / Job Title / Status) with `crypto.randomUUID()` ids, **`rows: []`**; `GET` returns boards with `columns`, `rows`, `entityType`, timestamps. | 2026-04-16 | `backend/functions/boards/index.js`; REST authorizer `sub` from Cognito claims. |
| Frontend **boards API client** (`listBoards`, `getBoard`, `createBoard` with optional column payload) with JSDoc for response shapes; `VITE_API_URL` base + Bearer id token. | 2026-04-16 | `frontend/src/api/boardsApi.js`. |
| Dashboard **job boards**: `boardFromServer` / `createEmptyBoard` with **`persisted`** and **`columnsLocked`**; list boards on load when API configured; table UI with optional add-column, entries gate, rows. | 2026-04-16 | `frontend/src/dashboard/boardUtils.js`, `DashboardPage.jsx`, `BoardTableView.jsx`. |
| **Deferred save UX**: sidebar flow only adds a **local draft** (`draft-<uuid>`); **`POST /boards` runs only** from the primary **Create** control **below the table**; `savingBoardId` / `saveBoardError`; bar hidden after successful save. Sidebar uses **Continue** + **Cancel** (no blur-to-submit); drafts show **(unsaved)**. | 2026-04-16 | `DashboardPage.jsx`, `DashboardSidebar.jsx`; styles `.dashboard-draft-save`. |
| **Draft vs persisted columns**: drafts use **`columnsLocked: false`** until save; after save, **`boardFromServer`** sets **`columnsLocked: true`** (no **+**). **`POST /boards`** can include optional **`columns`** from the client so draft column definitions persist; if omitted, the API uses the default three. **`handleAddColumn`** runs only when **`!columnsLocked`**. | 2026-04-16 | `boardUtils`, `DashboardPage.handleSaveDraftBoard`, `boards/index.js` POST. |
| **`GET /boards/{boardId}`** (DynamoDB **`GetItem`** on `USER#<sub>` / `BOARD#<id>`); shared **`sanitizeColumns`** + **`buildBoardDto`** with list **`GET`**. Frontend **`getBoard`**, **`handleSelectBoard`**: refetch persisted board on sidebar click so the main table matches stored columns/rows. | 2026-04-16 | IAM `dynamodb:GetItem`; `template.yaml` route; `boardsApi.js`. |
| **Dashboard UI (boards)**: shared **`.dashboard-accent-btn`** (same accent text treatment as sidebar “Create new table”) for **Create** (draft save) and **Start adding entries**; **unboxed** draft save and entries-gate sections (top divider only, no card); primary copy **“Press Create and start caching your applications!”**; duplicate draft hint under the grid removed. | 2026-04-16 | `styles.css`, `DashboardPage`, `BoardTableView`. |
| **Board row entries (DynamoDB)**: **`POST /boards/{boardId}/entries`** on API Gateway (same Cognito authorizer); **`dynamodb:UpdateItem`** on `BoardsFunction`. Lambda loads board via **`GetItem`**, validates **`cells`** keys match the board’s column ids exactly (no missing/extra keys), appends one element to **`rows`** with **`UpdateItem`** + **`list_append`**, each stored row **`{ rowId, cells, createdAt, updatedAt }`**; board **`updatedAt`** refreshed. **`mapRowForApi`** maps **`rowId`** or **`id`** for **`GET`** DTOs. **`201`** returns **`{ row: { id, cells, … }, updatedAt }`**. | 2026-04-17 | `backend/template.yaml`, `backend/functions/boards/index.js`. |
| **Board entries (SPA)**: **`addBoardEntry(boardId, { cells })`** in **`boardsApi.js`** (Bearer + JSON). Client rows use **`pendingSave`** for drafts; **Save** / **Enter** submit; failed API keeps draft + inline error + retry; success merges server **`row`** locally (no refetch flicker). **`boardFromServer`**: **`entriesEnabled: true`** when **`rows.length > 0`** so boards with data skip the “Start adding entries” gate; gate only for **persisted + no rows + not yet enabled**. Table: empty **Save** column header, read-only cells for saved rows. | 2026-04-17 | `frontend/src/api/boardsApi.js`, `boardUtils.js`, `BoardTableView.jsx`, `DashboardPage.jsx`. |
| **Edit board entries**: **`PATCH /boards/{boardId}/entries/{rowId}`** (API Gateway + boards Lambda): **`GetItem`**, find row by **`rowId`** / **`id`**, **`normalizeCellsForBoard`**, **`UpdateItem`** **`SET`** **`rows`** + board **`updatedAt`**; **`200`** **`{ row, updatedAt }`**. CORS / GatewayResponses include **`PATCH`**. SPA: **`updateBoardEntry`**, **`editingRowId`** + **`originalEditRowData`** snapshot cancel, **`handleUpdateRow`**, inline **Edit** (row hover / focus), **Save** / **Cancel**, **Escape** / **Enter**, **`saveEntryError`** shared. | 2026-04-17 | `backend/template.yaml`, `backend/functions/boards/index.js`, `frontend/src/api/boardsApi.js`, `DashboardPage.jsx`, `BoardTableView.jsx`, `styles.css`. |

### Recent work log (since last backlog snapshot)

Entries below mirror the table above in narrative form for quick scanning.

**2026-04-16 — Repository**

- Removed `MEMORY_BANK.md` from `.gitignore` and merged `feature/user-handling` into `main`, then pushed so the memory bank and integrated auth/dashboard work live on `origin/main`.

**2026-04-16 — Frontend**

- Shipped a CSS-first UI pass: expanded tokens, backgrounds, button/input focus and hover behavior, staggered hero entry animation where appropriate, loading state with dot pulse, and glass-style auth card; deleted the orphaned `style.css` asset and consolidated on `styles.css`.

**2026-04-16 — Backend / AWS**

- Defined the single DynamoDB table `AppliCacheData` in SAM and deployed the Post Confirmation Lambda that persists `USER#<sub>` / `PROFILE#<sub>` items after successful sign-up confirmation, with least-privilege IAM and Cognito invoke permission.

**2026-04-16 — Boards API & DynamoDB shape**

- Boards Lambda implements `GET`/`POST` for `/boards`: items include `entityType: BOARD`, ISO `createdAt`/`updatedAt`, server-generated default columns with stable UUID ids, and empty `rows` on create; list returns the same fields for each board.

**2026-04-16 — Dashboard: boards UI & deferred save**

- Connected the SPA to the boards API when `VITE_API_URL` is set; normalized server payloads in `boardFromServer` with `persisted`/`columnsLocked` flags.
- Adopted **deferred persistence**: naming a table in the sidebar creates a **draft** only; the user saves to DynamoDB via the main **Create** action; loading and error states are scoped to that action.
- Sidebar lists drafts with an **(unsaved)** label; the inline create flow uses **Continue** / **Cancel** (no accidental submit on blur).
- **Drafts** allow the **+ add column** control; **persisted** boards hide it via **`columnsLocked`**.

**2026-04-16 — Boards API & dashboard polish (follow-up)**

- **`POST /boards`** accepts an optional **`columns`** array (sanitized, max 64); the SPA sends the draft’s columns when saving so extra columns are stored, not only the default three.
- **`GET /boards/{boardId}`** loads a single board with **`GetItem`**; list and item responses share **`buildBoardDto`**. Selecting a persisted board in the sidebar triggers **`getBoard`** to refresh the main view from DynamoDB.
- **UI**: Introduced **`.dashboard-accent-btn`** for the main **Create** and **Start adding entries** actions (accent link-style, aligned with the sidebar). Draft-save and entries-gate areas use a **light top rule** only (no boxed card). Primary draft line: **“Press Create and start caching your applications!”** Redundant hint under the table body was removed.

**2026-04-17 — Board entries persisted to DynamoDB**

- **API / IaC**: New **`POST /boards/{boardId}/entries`**; boards Lambda IAM extended with **`UpdateItem`**. Handler branches **`POST`** with **`pathParameters.boardId`** (add entry) vs **`POST /boards`** without **`boardId`** (create board, unchanged).
- **DynamoDB**: **`list_append(if_not_exists(rows, []), [newEntry])`**; new entry shape **`rowId`** (UUID), **`cells`** (string map aligned to columns), **`createdAt`** / **`updatedAt`** ISO strings; **`ConditionExpression`** on key existence.
- **Validation**: Reject **`400`** if **`cells`** keys don’t match the board’s column ids one-to-one; **`404`** if board missing.
- **Frontend**: **`addBoardEntry`**; draft rows (**`pendingSave`**) with **Save** (`.dashboard-accent-btn`), **Saving…**, **Enter** to save, **`role="alert"`** error on failure; **`handleCellChange`** only for draft rows; **`+ Add New Entry`** unchanged flow.
- **UX**: **`boardFromServer`** sets **`entriesEnabled`** when the server returns rows so existing data doesn’t require the entries gate; **“Start adding entries”** only when the persisted board has **no rows** and entry mode isn’t on yet.

**2026-04-17 — Edit / PATCH board row entries**

- **`PATCH /boards/{boardId}/entries/{rowId}`**: read–modify–write on the board item’s **`rows`** list; CORS allows **`PATCH`** on success and gateway error responses.
- **Dashboard**: **`updateBoardEntry`**, per-row **Edit** (revealed on row hover or keyboard focus), **Save** / **Cancel** in edit mode, snapshot revert on cancel or when switching to another row’s edit, **Escape** / **Enter** while editing.

## Update Policy

- Do not modify this file unless the user explicitly asks.
- When requested, append completed tasks to the backlog table and keep design decisions current.
