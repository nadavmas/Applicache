import { useRef } from "react"

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
  boardInteractionsLocked = false,
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
    if (!trimmed) onCancelCreate?.()
  }

  const handleCancelClick = () => {
    onCancelCreate?.()
  }

  const handleCommitClick = () => {
    onCommitCreate?.()
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
            {boards.map((board) => {
              const isDraft = board.persisted === false
              return (
                <li key={board.id}>
                  <button
                    type="button"
                    className={
                      isDraft
                        ? "dashboard-sidebar__item dashboard-sidebar__item--draft"
                        : "dashboard-sidebar__item"
                    }
                    aria-current={board.id === activeBoardId ? "true" : undefined}
                    onClick={() => onSelectBoard?.(board.id)}
                    disabled={boardInteractionsLocked}
                    aria-busy={
                      boardInteractionsLocked ? "true" : undefined
                    }
                  >
                    <span className="dashboard-sidebar__item-label">
                      {board.name}
                      {isDraft ? (
                        <span className="dashboard-sidebar__draft-badge">
                          {" "}
                          (unsaved)
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
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
              <div className="dashboard-sidebar__create-form">
                <input
                  type="text"
                  className="dashboard-sidebar__create-input auth-input"
                  value={createTableName}
                  onChange={(e) => onCreateTableNameChange?.(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  onBlur={handleCreateBlur}
                  placeholder="Board name"
                  aria-label="New board name"
                  autoFocus
                  disabled={boardInteractionsLocked}
                />
                <div className="dashboard-sidebar__create-actions">
                  <button
                    type="button"
                    className="dashboard-sidebar__create-submit"
                    onClick={handleCommitClick}
                    disabled={boardInteractionsLocked}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="dashboard-sidebar__create-cancel"
                    onClick={handleCancelClick}
                    disabled={boardInteractionsLocked}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="dashboard-sidebar__create"
                onClick={() => onStartCreate?.()}
                disabled={boardsLoading || boardInteractionsLocked}
              >
                <PlusIcon />
                Create new board
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
