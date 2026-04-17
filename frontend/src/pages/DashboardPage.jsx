import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import { signOut } from "../auth/cognitoStub";
import {
  addBoardEntry,
  createBoard,
  getBoard,
  isBoardsApiConfigured,
  listBoards,
} from "../api/boardsApi";
import DashboardSidebar from "../components/DashboardSidebar";
import BoardTableView from "../components/BoardTableView";
import {
  addColumnToBoard,
  addRowToBoard,
  boardFromServer,
  createEmptyBoard,
  updateCell,
} from "../dashboard/boardUtils";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [displayName, setDisplayName] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [createTableName, setCreateTableName] = useState("");

  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsLoadError, setBoardsLoadError] = useState("");
  const [createBoardError, setCreateBoardError] = useState("");

  const [savingBoardId, setSavingBoardId] = useState(null);
  const [saveBoardError, setSaveBoardError] = useState("");

  const [savingEntryRowId, setSavingEntryRowId] = useState(null);
  const [saveEntryError, setSaveEntryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setDisplayName(user.username ?? "");
          setStatus("authed");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "authed" || !isBoardsApiConfigured()) {
      return undefined;
    }
    let cancelled = false;
    setBoardsLoading(true);
    setBoardsLoadError("");
    listBoards()
      .then((data) => {
        if (cancelled) return;
        const sorted = [...(data.boards ?? [])].sort((a, b) =>
          (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
        );
        setBoards(sorted.map((b) => boardFromServer(b)));
      })
      .catch((err) => {
        if (!cancelled) {
          setBoardsLoadError(
            err instanceof Error ? err.message : "Failed to load boards.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBoardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (boards.length === 0) {
      setActiveBoardId(null);
      return;
    }
    if (
      !activeBoardId ||
      !boards.some((b) => b.id === activeBoardId)
    ) {
      setActiveBoardId(boards[0].id);
    }
  }, [boards, activeBoardId]);

  useEffect(() => {
    setSaveBoardError("");
    setSaveEntryError("");
  }, [activeBoardId]);

  const handleSelectBoard = (boardId) => {
    setActiveBoardId(boardId);
    if (!isBoardsApiConfigured()) return;
    if (boardId.startsWith("draft-")) return;
    const b = boards.find((x) => x.id === boardId);
    if (!b?.persisted) return;
    getBoard(boardId)
      .then((data) => {
        setBoards((prev) =>
          prev.map((x) =>
            x.id === boardId ? boardFromServer(data) : x,
          ),
        );
      })
      .catch(() => {
        /* keep listed copy; optional: surface toast */
      });
  };

  const handleSignOut = async () => {
    setLogoutError("");
    setSigningOut(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      setLogoutError(
        err instanceof Error ? err.message : "Could not sign out. Try again.",
      );
    } finally {
      setSigningOut(false);
    }
  };

  const handleStartCreateTable = () => {
    setCreateBoardError("");
    setIsCreatingTable(true);
    setCreateTableName("");
  };

  const handleCancelCreateTable = () => {
    setIsCreatingTable(false);
    setCreateTableName("");
    setCreateBoardError("");
  };

  const handleCommitCreateTable = () => {
    const name = createTableName.trim();
    if (!name) {
      setIsCreatingTable(false);
      setCreateTableName("");
      return;
    }

    if (isBoardsApiConfigured()) {
      setCreateBoardError("");
      const draftId = `draft-${crypto.randomUUID()}`;
      const draftBoard = {
        ...createEmptyBoard(name),
        id: draftId,
        persisted: false,
        columnsLocked: false,
      };
      setBoards((prev) => [...prev, draftBoard]);
      setActiveBoardId(draftId);
      setIsCreatingTable(false);
      setCreateTableName("");
      return;
    }

    const board = {
      ...createEmptyBoard(name),
      persisted: true,
      columnsLocked: false,
    };
    setBoards((prev) => [...prev, board]);
    setActiveBoardId(board.id);
    setIsCreatingTable(false);
    setCreateTableName("");
  };

  const handleSaveDraftBoard = (boardId) => {
    if (!isBoardsApiConfigured() || savingBoardId) return;
    const board = boards.find((b) => b.id === boardId);
    if (!board || board.persisted) return;

    const name = board.name.trim();
    if (!name) return;

    setSaveBoardError("");
    setSavingBoardId(boardId);
    const columnPayload = board.columns.map((c) => ({
      id: c.id,
      name: c.name,
    }));
    createBoard(name, columnPayload)
      .then((created) => {
        const saved = boardFromServer(created);
        setBoards((prev) =>
          prev.map((b) => (b.id === boardId ? saved : b)),
        );
        setActiveBoardId(saved.id);
      })
      .catch((err) => {
        setSaveBoardError(
          err instanceof Error ? err.message : "Could not save table.",
        );
      })
      .finally(() => {
        setSavingBoardId(null);
      });
  };

  const activeBoard =
    boards.find((b) => b.id === activeBoardId) ?? null;

  const handleAddColumn = (columnName) => {
    if (!activeBoardId) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b || b.columnsLocked) return prev;
      return prev.map((x) =>
        x.id === activeBoardId ? addColumnToBoard(x, columnName) : x,
      );
    });
  };

  const handleEnableBoardEntries = (boardId) => {
    setBoards((prev) => {
      const b = prev.find((x) => x.id === boardId);
      if (!b?.persisted) return prev;
      return prev.map((x) =>
        x.id === boardId ? { ...x, entriesEnabled: true } : x,
      );
    });
  };

  const handleAddRow = () => {
    if (!activeBoardId) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b?.persisted || !b?.entriesEnabled) return prev;
      return prev.map((x) =>
        x.id === activeBoardId ? addRowToBoard(x) : x,
      );
    });
  };

  const handleCellChange = (rowId, columnId, value) => {
    if (!activeBoardId) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b?.persisted || !b?.entriesEnabled) return prev;
      const row = b.rows.find((r) => r.id === rowId);
      if (!row?.pendingSave) return prev;
      return prev.map((x) =>
        x.id === activeBoardId
          ? updateCell(x, rowId, columnId, value)
          : x,
      );
    });
  };

  const handleSaveRow = (rowId) => {
    if (!activeBoardId || !isBoardsApiConfigured()) return;
    if (savingEntryRowId) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted || !board.entriesEnabled) return;
    const row = board.rows.find((r) => r.id === rowId);
    if (!row?.pendingSave) return;

    setSaveEntryError("");
    setSavingEntryRowId(rowId);

    const cells = Object.fromEntries(
      board.columns.map((c) => [c.id, row.cells[c.id] ?? ""]),
    );

    addBoardEntry(board.id, { cells })
      .then((data) => {
        const apiRow = data.row;
        setBoards((prev) =>
          prev.map((b) => {
            if (b.id !== board.id) return b;
            return {
              ...b,
              rows: b.rows.map((r) =>
                r.id === rowId
                  ? {
                      id: apiRow.id,
                      cells: { ...apiRow.cells },
                      pendingSave: false,
                    }
                  : r,
              ),
            };
          }),
        );
        setSaveEntryError("");
      })
      .catch((err) => {
        setSaveEntryError(
          err instanceof Error ? err.message : "Could not save entry.",
        );
      })
      .finally(() => {
        setSavingEntryRowId(null);
      });
  };

  const showDraftSaveBar =
    Boolean(activeBoard) &&
    activeBoard.persisted === false &&
    isBoardsApiConfigured();

  if (status === "checking") {
    return (
      <main className="landing-page">
        <p
          className="hero__loading page-loading"
          role="status"
          aria-live="polite"
        >
          <span className="page-loading__label">Loading</span>
          <span className="page-loading__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </p>
      </main>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={handleSelectBoard}
        isCreatingTable={isCreatingTable}
        createTableName={createTableName}
        onCreateTableNameChange={setCreateTableName}
        onStartCreate={handleStartCreateTable}
        onCommitCreate={handleCommitCreateTable}
        onCancelCreate={handleCancelCreateTable}
        boardsLoading={boardsLoading}
        createBoardError={createBoardError}
        onSignOut={handleSignOut}
        signingOut={signingOut}
        logoutError={logoutError}
      />
      <main className="dashboard-main">
        <div
          className={
            activeBoard
              ? "dashboard-main__inner dashboard-main__inner--wide"
              : "dashboard-main__inner"
          }
        >
          <h1>Dashboard</h1>
          <p>
            {displayName
              ? `Welcome back, ${displayName}.`
              : "Welcome to your AppliCache home."}
          </p>
          {boardsLoadError ? (
            <p className="auth-form-error dashboard-main__api-error" role="alert">
              {boardsLoadError}
            </p>
          ) : null}
          {activeBoard ? (
            <>
              <h2 className="dashboard-main__board-title">{activeBoard.name}</h2>
              <BoardTableView
                key={activeBoard.id}
                board={activeBoard}
                persisted={activeBoard.persisted === true}
                columnsLocked={activeBoard.columnsLocked === true}
                entriesEnabled={activeBoard.entriesEnabled === true}
                onEnableEntries={() =>
                  handleEnableBoardEntries(activeBoard.id)
                }
                onAddColumn={handleAddColumn}
                onAddRow={handleAddRow}
                onCellChange={handleCellChange}
                onSaveRow={handleSaveRow}
                savingRowId={savingEntryRowId}
                saveRowError={saveEntryError}
              />
              {showDraftSaveBar ? (
                <div
                  className="dashboard-draft-save"
                  role="region"
                  aria-label="Save new table"
                >
                  <p className="dashboard-draft-save__hint">
                    Press Create and start caching your applications!
                  </p>
                  {saveBoardError ? (
                    <p
                      className="auth-form-error dashboard-draft-save__error"
                      role="alert"
                    >
                      {saveBoardError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="dashboard-draft-save__btn"
                    onClick={() => handleSaveDraftBoard(activeBoard.id)}
                    disabled={savingBoardId === activeBoard.id}
                    aria-busy={savingBoardId === activeBoard.id ? "true" : undefined}
                  >
                    {savingBoardId === activeBoard.id ? "Saving…" : "Create"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="dashboard-main__meta dashboard-main__meta--solo">
              {boardsLoading
                ? "Loading your tables…"
                : "Create a table from the sidebar to get started."}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
