import { useRef } from "react"

const PendingSpinner = () => (
  <svg
    className="dashboard-sidebar__pending-spinner"
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      className="dashboard-sidebar__pending-track"
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      opacity="0.25"
    />
    <path
      className="dashboard-sidebar__pending-arc"
      d="M12 3a9 9 0 0 1 9 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const PlusIcon = () => (
  <svg
    className="dashboard-sidebar__create-icon"
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

/**
 * Presentational sidebar: job board list, create table flow, settings / sign out.
 */
export default function DashboardSidebar({
  boards = [],
  activeBoardId = null,
  onSelectBoard,
  isCreatingTable = false,
  createTableName = "",
  onCreateTableNameChange,
  onStartCreate,
  onCommitCreate,
  onCancelCreate,
  boardsLoading = false,
  createBoardSubmitting = false,
  createBoardError = "",
  onSignOut,
  signingOut = false,
  logoutError = "",
}) {
  const createEscapeRef = useRef(false)

  const handleSettings = () => {
    console.log("[dashboard] settings (placeholder)")
  }

  const handleCreateKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onCommitCreate?.()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      if (createBoardSubmitting) return
      createEscapeRef.current = true
      onCancelCreate?.()
    }
  }

  const handleCreateBlur = (e) => {
    if (createEscapeRef.current) {
      createEscapeRef.current = false
      return
    }
    const trimmed = e.currentTarget.value.trim()
    if (trimmed) onCommitCreate?.()
    else onCancelCreate?.()
  }

  return (
    <aside className="dashboard-sidebar" aria-label="AppliCache navigation">
      <p className="dashboard-sidebar__brand">AppliCache</p>

      <nav className="dashboard-sidebar__scroll" aria-label="Job boards">
        {boardsLoading ? (
          <p
            className="dashboard-sidebar__loading-hint"
            role="status"
            aria-live="polite"
          >
            <span className="dashboard-sidebar__loading-label">Loading tables</span>
            <span className="page-loading__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </p>
        ) : null}

        {!boardsLoading && boards.length > 0 ? (
          <ul className="dashboard-sidebar__list">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  className={
                    board.pending
                      ? "dashboard-sidebar__item dashboard-sidebar__item--pending"
                      : "dashboard-sidebar__item"
                  }
                  aria-current={board.id === activeBoardId ? "true" : undefined}
                  aria-busy={board.pending ? "true" : undefined}
                  onClick={() => onSelectBoard?.(board.id)}
                >
                  {board.pending ? <PendingSpinner /> : null}
                  <span className="dashboard-sidebar__item-label">{board.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className={
            boards.length > 0
              ? "dashboard-sidebar__create-wrap"
              : "dashboard-sidebar__create-wrap dashboard-sidebar__create-wrap--empty"
          }
        >
          <div className="dashboard-sidebar__create-slot">
            {isCreatingTable ? (
              <input
                type="text"
                className="dashboard-sidebar__create-input auth-input"
                value={createTableName}
                onChange={(e) => onCreateTableNameChange?.(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                onBlur={handleCreateBlur}
                placeholder="Table name"
                aria-label="New table name"
                disabled={createBoardSubmitting}
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="dashboard-sidebar__create"
                onClick={() => onStartCreate?.()}
                disabled={boardsLoading || createBoardSubmitting}
              >
                <PlusIcon />
                {createBoardSubmitting ? "Creating…" : "Create new table"}
              </button>
            )}
          </div>
        </div>
        {createBoardError ? (
          <p
            className="auth-form-error dashboard-sidebar__create-error"
            role="alert"
          >
            {createBoardError}
          </p>
        ) : null}
      </nav>

      <div className="dashboard-sidebar__footer">
        <button
          type="button"
          className="dashboard-sidebar__settings"
          onClick={handleSettings}
        >
          Settings
        </button>
        {onSignOut ? (
          <button
            type="button"
            className="dashboard-sidebar__logout"
            onClick={onSignOut}
            disabled={signingOut}
            aria-busy={signingOut}
          >
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        ) : null}
        {logoutError ? (
          <p
            className="auth-form-error dashboard-sidebar__footer-error"
            role="alert"
          >
            {logoutError}
          </p>
        ) : null}
      </div>
    </aside>
  )
}
