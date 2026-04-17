import { useRef, useState } from "react"

/**
 * @param {object} props
 * @param {import('../dashboard/boardUtils').Board} props.board
 * @param {boolean} props.persisted
 * @param {boolean} props.columnsLocked
 * @param {boolean} props.entriesEnabled
 * @param {() => void} props.onEnableEntries
 * @param {(name: string) => void} props.onAddColumn
 * @param {() => void} props.onAddRow
 * @param {(rowId: string, columnId: string, value: string) => void} props.onCellChange
 * @param {(rowId: string) => void} [props.onSaveRow]
 * @param {string | null} [props.savingRowId]
 * @param {string} [props.saveRowError]
 */
export default function BoardTableView({
  board,
  persisted,
  columnsLocked,
  entriesEnabled,
  onEnableEntries,
  onAddColumn,
  onAddRow,
  onCellChange,
  onSaveRow,
  savingRowId,
  saveRowError,
}) {
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")
  const columnCancelRef = useRef(false)

  const showAddColumn = !columnsLocked
  /** Show entry rows / Add row when entry mode is on or the board already has saved rows */
  const entriesVisible =
    entriesEnabled || (Boolean(persisted) && board.rows.length > 0)
  const showEntriesGate =
    Boolean(persisted) &&
    !entriesEnabled &&
    board.rows.length === 0
  const showSaveColumn =
    Boolean(persisted) &&
    entriesEnabled &&
    board.rows.some((r) => r.pendingSave === true)

  const finishColumnInput = (value) => {
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

  const handleSaveClick = (rowId) => () => {
    if (savingRowId != null || !onSaveRow) return
    onSaveRow(rowId)
  }

  return (
    <div className="board-table-wrap board-table-wrap--appear">
      <div className="board-table-scroll">
        <table className="board-table">
          <thead>
            <tr>
              {board.columns.map((col) => (
                <th key={col.id} className="board-table__th" scope="col">
                  {col.name}
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
                    >
                      +
                    </button>
                  )}
                </th>
              ) : null}
              {showSaveColumn ? (
                <th
                  className="board-table__th board-table__th--action"
                  scope="col"
                  aria-label="Row actions"
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {entriesVisible
              ? board.rows.map((row, rowIndex) => (
                  <tr key={row.id} className="board-table__tr">
                    {board.columns.map((col) => (
                      <td key={col.id} className="board-table__td">
                        {row.pendingSave ? (
                          <input
                            type="text"
                            className="board-table__cell-input auth-input"
                            value={row.cells[col.id] ?? ""}
                            onChange={(e) =>
                              onCellChange(row.id, col.id, e.target.value)
                            }
                            onKeyDown={handleDraftCellKeyDown(row.id)}
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
                    {showSaveColumn ? (
                      <td className="board-table__td board-table__td--save">
                        {row.pendingSave ? (
                          <button
                            type="button"
                            className="dashboard-accent-btn"
                            onClick={handleSaveClick(row.id)}
                            disabled={savingRowId != null}
                            aria-busy={
                              savingRowId === row.id ? "true" : undefined
                            }
                            aria-label={`Save row ${rowIndex + 1}`}
                          >
                            {savingRowId === row.id ? "Saving…" : "Save"}
                          </button>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {saveRowError && showSaveColumn ? (
        <p className="auth-form-error board-table__save-error" role="alert">
          {saveRowError}
        </p>
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
          >
            Start adding entries
          </button>
        </div>
      ) : null}

      {persisted && entriesVisible ? (
        <button
          type="button"
          className="board-table__add-row btn btn-secondary"
          onClick={onAddRow}
        >
          + Add New Entry
        </button>
      ) : null}
    </div>
  )
}
