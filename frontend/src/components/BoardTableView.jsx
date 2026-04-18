import { useEffect, useRef, useState } from "react"
import {
  ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE,
  entryCellsHaveAtLeastOneFilledValue,
} from "../dashboard/boardUtils"

/** Square-pen style edit icon (stroke matches button via currentColor) */
const BoardEditIcon = () => (
  <svg
    className="board-table__edit-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.375 2.625a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.375-9.375z" />
  </svg>
)

/** Trash icon for row delete (stroke matches button via currentColor) */
const BoardDeleteIcon = () => (
  <svg
    className="board-table__delete-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

const BoardMoreIcon = () => (
  <svg
    className="board-actions__more-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
)

const BoardColumnRemoveIcon = () => (
  <svg
    className="board-table__col-remove-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
)

/**
 * @param {object} props
 * @param {import('../dashboard/boardUtils').Board} props.board
 * @param {boolean} props.persisted
 * @param {boolean} props.columnsLocked
 * @param {boolean} props.entriesEnabled
 * @param {boolean} props.isEditingBoard
 * @param {boolean} props.canSaveBoardEdit
 * @param {boolean} props.savingBoardEdit
 * @param {string} props.saveBoardEditError
 * @param {(value: string) => void} props.onBoardTitleChange
 * @param {() => void} props.onStartEditBoard
 * @param {() => void} props.onSaveBoardEdit
 * @param {() => void} props.onCancelBoardEdit
 * @param {(columnId: string, value: string) => void} props.onBoardColumnNameChange
 * @param {(columnId: string) => void} props.onRemoveBoardColumn
 * @param {() => void} props.onEnableEntries
 * @param {(name: string) => void} props.onAddColumn
 * @param {() => void} props.onAddRow
 * @param {(rowId: string, columnId: string, value: string) => void} props.onCellChange
 * @param {(rowId: string) => void} [props.onSaveRow]
 * @param {string | null} [props.savingRowId]
 * @param {string} [props.saveRowError]
 * @param {string | null} [props.editingRowId]
 * @param {(rowId: string) => void} [props.onStartEditRow]
 * @param {() => void} [props.onCancelEdit]
 * @param {(rowId: string) => void} [props.onUpdateRow]
 * @param {string | null} [props.deletingRowId]
 * @param {(rowId: string) => void} [props.onDeleteRow]
 * @param {{ deletedIndex: number } | null} [props.focusAfterDelete]
 * @param {() => void} [props.onFocusAfterDeleteComplete]
 * @param {string | null} [props.deletingBoardId]
 * @param {() => void} [props.onDeleteBoard]
 * @param {string} [props.deleteBoardError]
 */
export default function BoardTableView({
  board,
  persisted,
  columnsLocked,
  entriesEnabled,
  isEditingBoard,
  canSaveBoardEdit,
  savingBoardEdit,
  saveBoardEditError,
  onBoardTitleChange,
  onStartEditBoard,
  onSaveBoardEdit,
  onCancelBoardEdit,
  onBoardColumnNameChange,
  onRemoveBoardColumn,
  onEnableEntries,
  onAddColumn,
  onAddRow,
  onCellChange,
  onSaveRow,
  savingRowId,
  saveRowError,
  editingRowId,
  onStartEditRow,
  onCancelEdit,
  onUpdateRow,
  deletingRowId,
  onDeleteRow,
  focusAfterDelete,
  onFocusAfterDeleteComplete,
  deletingBoardId = null,
  onDeleteBoard,
  deleteBoardError = "",
}) {
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")
  const [boardMenuOpen, setBoardMenuOpen] = useState(false)
  const columnCancelRef = useRef(false)
  const tableScrollRef = useRef(null)
  const addRowButtonRef = useRef(null)
  const boardMenuRef = useRef(null)

  const showAddColumn = !columnsLocked || isEditingBoard
  /** Show entry rows / Add row when entry mode is on or the board already has saved rows */
  const entriesVisible =
    entriesEnabled || (Boolean(persisted) && board.rows.length > 0)
  const showEntriesGate =
    Boolean(persisted) &&
    !entriesEnabled &&
    board.rows.length === 0
  /** Draft Save and/or saved-row Edit / edit Save+Cancel */
  const showRowActionsColumn =
    Boolean(persisted) && entriesEnabled && board.rows.length > 0
  const showBoardMenu = Boolean(persisted && !isEditingBoard)
  const boardLocked =
    deletingBoardId != null && deletingBoardId === board.id
  const rowActionsLocked = Boolean(isEditingBoard || boardLocked)

  useEffect(() => {
    if (!focusAfterDelete) return
    const { deletedIndex } = focusAfterDelete
    const raf = requestAnimationFrame(() => {
      const newCount = board.rows.length
      let focused = false
      if (newCount > 0) {
        const nextFocusIndex = Math.min(deletedIndex, newCount - 1)
        const tr = tableScrollRef.current?.querySelector(
          `tr[data-board-row-index="${nextFocusIndex}"]`,
        )
        const actions = tr?.querySelector(".board-table__row-actions")
        const firstBtn = actions?.querySelector("button")
        if (firstBtn) {
          firstBtn.focus()
          focused = true
        } else {
          const inp = tr?.querySelector(".board-table__cell-input")
          if (inp) {
            inp.focus()
            focused = true
          }
        }
      } else {
        addRowButtonRef.current?.focus()
        focused = document.activeElement === addRowButtonRef.current
      }
      if (!focused) {
        tableScrollRef.current?.focus()
      }
      onFocusAfterDeleteComplete?.()
    })
    return () => cancelAnimationFrame(raf)
  }, [focusAfterDelete, board.rows, onFocusAfterDeleteComplete])

  useEffect(() => {
    if (!boardMenuOpen) return
    const handlePointerDown = (e) => {
      const el = boardMenuRef.current
      if (el && !el.contains(e.target)) {
        setBoardMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setBoardMenuOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [boardMenuOpen])

  const finishColumnInput = (value) => {
    if (boardLocked) return
    const trimmed = value.trim()
    if (trimmed) onAddColumn(trimmed)
    setNewColumnName("")
    setIsAddingColumn(false)
  }

  const handleColumnKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      finishColumnInput(e.currentTarget.value)
    }
    if (e.key === "Escape") {
      e.preventDefault()
      columnCancelRef.current = true
      setNewColumnName("")
      setIsAddingColumn(false)
    }
  }

  const handleColumnBlur = (e) => {
    if (columnCancelRef.current) {
      columnCancelRef.current = false
      return
    }
    finishColumnInput(e.currentTarget.value)
  }

  const handleDraftCellKeyDown = (rowId) => (e) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (savingRowId != null || !onSaveRow) return
    onSaveRow(rowId)
  }

  const handleEditCellKeyDown = (rowId) => (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onCancelEdit?.()
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (savingRowId != null || !onUpdateRow) return
      onUpdateRow(rowId)
    }
  }

  const handleSaveClick = (rowId) => () => {
    if (savingRowId != null || !onSaveRow) return
    onSaveRow(rowId)
  }

  const handleUpdateClick = (rowId) => () => {
    if (savingRowId != null || !onUpdateRow) return
    onUpdateRow(rowId)
  }

  const handleStartEditClick = (rowId) => () => {
    if (savingRowId != null || deletingRowId != null || !onStartEditRow) return
    onStartEditRow(rowId)
  }

  const handleDeleteClick = (rowId) => () => {
    if (savingRowId != null || deletingRowId != null || !onDeleteRow) return
    onDeleteRow(rowId)
  }

  const handleBoardMenuToggle = () => {
    if (boardLocked) return
    setBoardMenuOpen((o) => !o)
  }

  const handleBoardMenuEdit = () => {
    if (boardLocked) return
    setBoardMenuOpen(false)
    onStartEditBoard?.()
  }

  const handleBoardMenuDelete = () => {
    if (boardLocked || !onDeleteBoard) return
    setBoardMenuOpen(false)
    onDeleteBoard()
  }

  const handleBoardTitleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onCancelBoardEdit?.()
    }
  }

  return (
    <div
      className={[
        "board-table-wrap",
        "board-table-wrap--appear",
        boardLocked ? "board-table-wrap--locked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="board-table__board-header">
        {isEditingBoard ? (
          <input
            type="text"
            className="dashboard-main__board-title board-table__board-title-input board-table__board-edit-input"
            value={board.name}
            onChange={(e) => onBoardTitleChange?.(e.target.value)}
            onKeyDown={handleBoardTitleKeyDown}
            aria-label="Board name"
            disabled={boardLocked}
          />
        ) : (
          <h2 className="dashboard-main__board-title board-table__board-title">
            {board.name}
          </h2>
        )}
      </div>

      <div
        className="board-table-scroll"
        ref={tableScrollRef}
        tabIndex={-1}
        role="region"
        aria-label="Board entries table"
      >
        <table className="board-table">
          <thead>
            <tr>
              {board.columns.map((col) => (
                <th key={col.id} className="board-table__th" scope="col">
                  {isEditingBoard ? (
                    <div className="board-table__header-edit-cell">
                      <input
                        type="text"
                        className="board-table__header-input board-table__board-col-input board-table__board-edit-input"
                        value={col.name}
                        onChange={(e) =>
                          onBoardColumnNameChange?.(col.id, e.target.value)
                        }
                        aria-label={`Column name: ${col.name}`}
                        disabled={boardLocked}
                      />
                      {board.columns.length > 1 ? (
                        <button
                          type="button"
                          className="board-table__col-remove"
                          onClick={() => onRemoveBoardColumn?.(col.id)}
                          aria-label={`Remove column ${col.name}`}
                          disabled={boardLocked}
                        >
                          <BoardColumnRemoveIcon />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    col.name
                  )}
                </th>
              ))}
              {showAddColumn ? (
                <th className="board-table__th board-table__th--action" scope="col">
                  {isAddingColumn ? (
                    <input
                      type="text"
                      className="board-table__header-input auth-input"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      onKeyDown={handleColumnKeyDown}
                      onBlur={handleColumnBlur}
                      placeholder="Column name"
                      aria-label="New column name"
                      autoFocus
                      disabled={boardLocked}
                    />
                  ) : (
                    <button
                      type="button"
                      className="board-table__add-col"
                      onClick={() => {
                        setIsAddingColumn(true)
                        setNewColumnName("")
                      }}
                      aria-label="Add column"
                      disabled={boardLocked}
                    >
                      +
                    </button>
                  )}
                </th>
              ) : null}
              {showBoardMenu ? (
                <th
                  className="board-table__th board-table__th--action board-table__th--board-menu"
                  scope="col"
                >
                  <div className="board-actions" ref={boardMenuRef}>
                    <button
                      type="button"
                      className="board-actions__trigger"
                      onClick={handleBoardMenuToggle}
                      aria-expanded={boardMenuOpen}
                      aria-haspopup="menu"
                      aria-label="Board actions"
                      disabled={boardLocked}
                      aria-busy={boardLocked ? "true" : undefined}
                    >
                      <BoardMoreIcon />
                    </button>
                    {boardMenuOpen ? (
                      <ul className="board-actions__menu" role="menu">
                        <li role="none">
                          <button
                            type="button"
                            className="board-actions__menu-item"
                            role="menuitem"
                            onClick={handleBoardMenuEdit}
                          >
                            Edit Board
                          </button>
                        </li>
                        <li role="none">
                          <button
                            type="button"
                            className="board-actions__menu-item board-actions__menu-item--danger"
                            role="menuitem"
                            onClick={handleBoardMenuDelete}
                            disabled={boardLocked}
                          >
                            {boardLocked ? "Deleting…" : "Delete Board"}
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                </th>
              ) : null}
              {showRowActionsColumn ? (
                <th
                  className="board-table__th board-table__th--action"
                  scope="col"
                  aria-label="Row actions"
                />
              ) : null}
            </tr>
          </thead>
          {entriesVisible && board.rows.length > 0 ? (
            <tbody>
              {board.rows.map((row, rowIndex) => {
                  const isDraft = row.pendingSave === true
                  const isEditing =
                    !isDraft &&
                    editingRowId != null &&
                    editingRowId === row.id
                  const rowSaving = savingRowId === row.id
                  const cellsPayload = Object.fromEntries(
                    board.columns.map((c) => [c.id, row.cells[c.id] ?? ""]),
                  )
                  const canSaveEntry =
                    entryCellsHaveAtLeastOneFilledValue(cellsPayload)
                  const showInputs = isDraft || isEditing
                  const trClass = [
                    "board-table__tr",
                    !isDraft && !isEditing
                      ? "board-table__tr--interactive"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")

                  return (
                    <tr
                      key={row.id}
                      className={trClass}
                      data-board-row-index={rowIndex}
                    >
                      {board.columns.map((col) => (
                        <td key={col.id} className="board-table__td">
                          {showInputs ? (
                            <input
                              type="text"
                              className="board-table__cell-input auth-input"
                              value={row.cells[col.id] ?? ""}
                              onChange={(e) =>
                                onCellChange(row.id, col.id, e.target.value)
                              }
                              onKeyDown={
                                isDraft
                                  ? handleDraftCellKeyDown(row.id)
                                  : handleEditCellKeyDown(row.id)
                              }
                              disabled={rowSaving || rowActionsLocked}
                              aria-label={`${col.name}, row ${rowIndex + 1}`}
                            />
                          ) : (
                            <span
                              className="board-table__cell-text"
                              aria-label={`${col.name}, row ${rowIndex + 1}`}
                            >
                              {row.cells[col.id] ?? ""}
                            </span>
                          )}
                        </td>
                      ))}
                      {showAddColumn ? (
                        <td
                          className="board-table__td board-table__td--pad"
                          aria-hidden="true"
                        />
                      ) : null}
                      {showBoardMenu ? (
                        <td
                          className="board-table__td board-table__td--board-menu-spacer"
                          aria-hidden="true"
                        />
                      ) : null}
                      {showRowActionsColumn ? (
                        <td className="board-table__td board-table__td--save">
                          {isDraft ? (
                            <button
                              type="button"
                              className="dashboard-accent-btn"
                              onClick={handleSaveClick(row.id)}
                              disabled={
                                rowActionsLocked ||
                                savingRowId != null ||
                                (!rowSaving && !canSaveEntry)
                              }
                              title={
                                !rowSaving && !canSaveEntry
                                  ? ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE
                                  : undefined
                              }
                              aria-busy={rowSaving ? "true" : undefined}
                              aria-label={`Save row ${rowIndex + 1}`}
                            >
                              {rowSaving ? "Saving…" : "Save"}
                            </button>
                          ) : isEditing ? (
                            <div className="board-table__edit-actions">
                              <button
                                type="button"
                                className="dashboard-accent-btn"
                                onClick={handleUpdateClick(row.id)}
                                disabled={
                                  rowActionsLocked ||
                                  savingRowId != null ||
                                  (!rowSaving && !canSaveEntry)
                                }
                                title={
                                  !rowSaving && !canSaveEntry
                                    ? ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE
                                    : undefined
                                }
                                aria-busy={rowSaving ? "true" : undefined}
                                aria-label={`Save changes row ${rowIndex + 1}`}
                              >
                                {rowSaving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                className="board-table__cancel-edit"
                                onClick={() => onCancelEdit?.()}
                                disabled={rowSaving || rowActionsLocked}
                                aria-label={`Cancel editing row ${rowIndex + 1}`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="board-table__row-actions">
                              <button
                                type="button"
                                className="board-table__edit-btn"
                                onClick={handleStartEditClick(row.id)}
                                disabled={
                                  rowActionsLocked ||
                                  savingRowId != null ||
                                  deletingRowId != null
                                }
                                aria-label={`Edit row ${rowIndex + 1}`}
                              >
                                <BoardEditIcon />
                              </button>
                              <button
                                type="button"
                                className="board-table__delete-btn"
                                onClick={handleDeleteClick(row.id)}
                                disabled={
                                  rowActionsLocked ||
                                  savingRowId != null ||
                                  deletingRowId != null
                                }
                                aria-busy={
                                  deletingRowId === row.id ? "true" : undefined
                                }
                                aria-label={`Delete row ${rowIndex + 1}`}
                              >
                                <BoardDeleteIcon />
                              </button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
            </tbody>
          ) : null}
        </table>
      </div>

      {saveRowError && persisted && entriesEnabled ? (
        <p className="auth-form-error board-table__save-error" role="alert">
          {saveRowError}
        </p>
      ) : null}

      {saveBoardEditError && persisted && isEditingBoard ? (
        <p className="auth-form-error board-table__save-error" role="alert">
          {saveBoardEditError}
        </p>
      ) : null}

      {isEditingBoard ? (
        <div className="board-table__board-edit-actions">
          <button
            type="button"
            className="dashboard-accent-btn"
            onClick={onSaveBoardEdit}
            disabled={!canSaveBoardEdit || savingBoardEdit || boardLocked}
            aria-busy={savingBoardEdit ? "true" : undefined}
          >
            {savingBoardEdit ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            className="board-table__cancel-edit"
            onClick={onCancelBoardEdit}
            disabled={savingBoardEdit || boardLocked}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {showEntriesGate ? (
        <div className="board-table__entries-gate">
          <p className="board-table__entries-gate-text">
            Press the button below when you are ready to add entries to this
            table.
          </p>
          <button
            type="button"
            className="dashboard-accent-btn"
            onClick={onEnableEntries}
            disabled={isEditingBoard || boardLocked}
          >
            Start adding entries
          </button>
        </div>
      ) : null}

      {persisted && entriesVisible ? (
        <button
          type="button"
          className="board-table__add-row btn btn-secondary"
          ref={addRowButtonRef}
          onClick={onAddRow}
          disabled={isEditingBoard || boardLocked}
        >
          + Add New Entry
        </button>
      ) : null}

      {deleteBoardError ? (
        <p className="auth-form-error board-table__save-error" role="alert">
          {deleteBoardError}
        </p>
      ) : null}

      {boardLocked ? (
        <div
          className="board-table__deleting-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="board-table__deleting-overlay-text">Deleting board…</p>
        </div>
      ) : null}
    </div>
  )
}
