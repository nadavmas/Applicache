import { useEffect, useRef, useState } from "react"

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

const UploadIcon = () => (
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
      d="M12 16V5M8 9l4-4 4 4M4 20h16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ResumeDocumentIcon = () => (
  <svg
    className="dashboard-sidebar__resume-item-icon"
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M14 2v6h6M10 13h4M10 17h8"
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
  signedInUsername = "",
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
  resumes = [],
  resumesLoading = false,
  isUploadingResume = false,
  onAddResume,
  onSelectResume,
}) {
  const createEscapeRef = useRef(false)
  const resumeFileInputRef = useRef(null)
  const [isBoardsExpanded, setIsBoardsExpanded] = useState(
    () => Boolean(activeBoardId),
  )
  const [isResumesExpanded, setIsResumesExpanded] = useState(false)

  useEffect(() => {
    if (activeBoardId) {
      setIsBoardsExpanded(true)
    }
  }, [activeBoardId])

  const handleSettings = () => {
    console.log("[dashboard] settings (placeholder)")
  }

  const handleToggleBoards = () => {
    setIsBoardsExpanded((prev) => !prev)
  }

  const handleToggleResumes = () => {
    setIsResumesExpanded((prev) => !prev)
  }

  const MAX_RESUME_BYTES = 10 * 1024 * 1024

  const handleUploadResumeClick = () => {
    resumeFileInputRef.current?.click()
  }

  const handleResumeFileChange = (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file) {
      input.value = ""
      return
    }
    if (file.size > MAX_RESUME_BYTES) {
      window.alert("File is too large. Please choose a file under 10 MB.")
      input.value = ""
      return
    }
    onAddResume?.(file)
    input.value = ""
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
      <div className="dashboard-sidebar__brand-wrap">
        <img
          className="dashboard-sidebar__brand"
          src="/applicache_logo.png"
          alt="AppliCache"
        />
        {signedInUsername ? (
          <p className="dashboard-sidebar__signed-in">
            Signed in as: {signedInUsername}
          </p>
        ) : null}
      </div>

      <nav
        className="dashboard-sidebar__primary"
        aria-label="Dashboard navigation"
      >
        <div className="dashboard-sidebar__boards-block">
          <button
            type="button"
            id="sidebar-boards-toggle"
            className="dashboard-sidebar__nav-link dashboard-sidebar__boards-toggle"
            aria-expanded={isBoardsExpanded}
            aria-controls="dashboard-boards-panel"
            onClick={handleToggleBoards}
          >
            Boards
          </button>

          <div
            className={
              isBoardsExpanded
                ? "dashboard-sidebar__boards-accordion is-expanded"
                : "dashboard-sidebar__boards-accordion"
            }
          >
            <div className="dashboard-sidebar__boards-accordion-inner">
              <div
                id="dashboard-boards-panel"
                className="dashboard-sidebar__boards-panel"
                role="region"
                aria-labelledby="sidebar-boards-toggle"
              >
                <div className="dashboard-sidebar__boards-panel-fade">
                  {boardsLoading ? (
                    <p
                      className="dashboard-sidebar__loading-hint"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="dashboard-sidebar__loading-label">
                        Loading tables
                      </span>
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
                              aria-current={
                                board.id === activeBoardId ? "true" : undefined
                              }
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
                            onChange={(e) =>
                              onCreateTableNameChange?.(e.target.value)
                            }
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
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-sidebar__resumes-block">
          <input
            ref={resumeFileInputRef}
            type="file"
            className="visually-hidden"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleResumeFileChange}
          />
          <button
            type="button"
            id="sidebar-resumes-toggle"
            className="dashboard-sidebar__nav-link dashboard-sidebar__resumes-toggle"
            aria-expanded={isResumesExpanded}
            aria-controls="dashboard-resumes-panel"
            onClick={handleToggleResumes}
          >
            Resumes
          </button>

          <div
            className={
              isResumesExpanded
                ? "dashboard-sidebar__resumes-accordion is-expanded"
                : "dashboard-sidebar__resumes-accordion"
            }
          >
            <div className="dashboard-sidebar__resumes-accordion-inner">
              <div
                id="dashboard-resumes-panel"
                className="dashboard-sidebar__resumes-panel"
                role="region"
                aria-labelledby="sidebar-resumes-toggle"
              >
                <div className="dashboard-sidebar__resumes-panel-fade">
                  {resumesLoading ? (
                    <p
                      className="dashboard-sidebar__loading-hint"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="dashboard-sidebar__loading-label">
                        Loading resumes
                      </span>
                      <span className="page-loading__dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </p>
                  ) : resumes.length > 0 ? (
                    <ul className="dashboard-sidebar__list">
                      {resumes.map((resume) => (
                        <li key={resume.id}>
                          <button
                            type="button"
                            className="dashboard-sidebar__resume-item"
                            onClick={() => onSelectResume?.(resume.id)}
                          >
                            <ResumeDocumentIcon />
                            <span className="dashboard-sidebar__resume-item-label">
                              {resume.name ?? "Resume"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="dashboard-sidebar__resumes-empty-wrap">
                      <p className="dashboard-sidebar__resumes-empty-title">
                        {isUploadingResume
                          ? "Uploading resume…"
                          : "No resumes added"}
                      </p>
                      {isUploadingResume ? null : (
                        <p className="dashboard-sidebar__resumes-empty-hint">
                          PDF, Word, or DOCX — up to 10 MB
                        </p>
                      )}
                    </div>
                  )}
                  <div
                    className={
                      !resumesLoading && resumes.length > 0
                        ? "dashboard-sidebar__resumes-upload-wrap dashboard-sidebar__resumes-upload-wrap--after-list"
                        : "dashboard-sidebar__resumes-upload-wrap"
                    }
                  >
                    <button
                      type="button"
                      className="dashboard-sidebar__create dashboard-sidebar__resumes-upload-btn"
                      onClick={handleUploadResumeClick}
                      disabled={isUploadingResume || resumesLoading}
                      aria-busy={isUploadingResume ? "true" : undefined}
                    >
                      {isUploadingResume ? (
                        <>
                          <span
                            className="page-loading__dots"
                            aria-hidden="true"
                          >
                            <span />
                            <span />
                            <span />
                          </span>
                          <span>Uploading…</span>
                        </>
                      ) : (
                        <>
                          <UploadIcon />
                          Upload Resume
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-sidebar__footer">
          <button
            type="button"
            className="dashboard-sidebar__nav-link dashboard-sidebar__settings"
            onClick={handleSettings}
          >
            Settings
          </button>
          {onSignOut ? (
            <button
              type="button"
              className="dashboard-sidebar__nav-link dashboard-sidebar__logout"
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
      </nav>
    </aside>
  )
}
