import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import { signOut } from "../auth/cognitoStub";
import { syncAuthTokensToExtensionIfNeeded } from "../auth/extensionAuthSync";
import {
  addBoardEntry,
  createBoard,
  deleteBoard,
  deleteBoardEntry,
  getBoard,
  isBoardsApiConfigured,
  listBoards,
  updateBoard,
  updateBoardEntry,
} from "../api/boardsApi";
import {
  createResumeMetadata,
  getResumeUploadUrl,
  isResumesApiConfigured,
  listResumes,
  resolveResumeContentType,
  resumeFromServer,
  uploadFileToS3,
} from "../api/resumesApi";
import DashboardSidebar from "../components/DashboardSidebar";
import BoardTableView from "../components/BoardTableView";
import {
  addColumnToBoard,
  addRowToBoard,
  boardFromServer,
  createEmptyBoard,
  ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE,
  entryCellsHaveAtLeastOneFilledValue,
  updateCell,
} from "../dashboard/boardUtils";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromExtensionParam = searchParams.get("from");
  const extensionIdParam = searchParams.get("extensionId");
  const [status, setStatus] = useState("checking");
  const [username, setUsername] = useState("");
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

  const [editingRowId, setEditingRowId] = useState(null);
  const [originalEditRowData, setOriginalEditRowData] = useState(null);

  const [deletingRowId, setDeletingRowId] = useState(null);
  const [focusAfterDelete, setFocusAfterDelete] = useState(null);

  const [isEditingBoard, setIsEditingBoard] = useState(false);
  const [boardEditDraft, setBoardEditDraft] = useState(null);
  const [savingBoardEdit, setSavingBoardEdit] = useState(false);
  const [saveBoardEditError, setSaveBoardEditError] = useState("");

  const [deletingBoardId, setDeletingBoardId] = useState(null);
  const [deleteBoardError, setDeleteBoardError] = useState("");

  const [resumes, setResumes] = useState([]);
  const [resumesLoading, setResumesLoading] = useState(false);
  const [resumesLoadError, setResumesLoadError] = useState("");
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  const handleFocusAfterDeleteComplete = useCallback(() => {
    setFocusAfterDelete(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setUsername(user.username ?? "");
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
    if (status !== "authed") return undefined;

    if (fromExtensionParam !== "extension" || !extensionIdParam) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      await syncAuthTokensToExtensionIfNeeded(extensionIdParam);
      if (cancelled) return;
      navigate("/dashboard", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [status, navigate, fromExtensionParam, extensionIdParam]);

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
    if (status !== "authed" || !isResumesApiConfigured()) {
      return undefined;
    }
    let cancelled = false;
    setResumesLoading(true);
    setResumesLoadError("");
    listResumes()
      .then((data) => {
        if (cancelled) return;
        const rows = (data.resumes ?? []).map((r) => resumeFromServer(r));
        setResumes(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setResumesLoadError(
            err instanceof Error ? err.message : "Failed to load resumes.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setResumesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (boardsLoading) return;
    if (boards.length === 0) {
      setActiveBoardId(null);
      return;
    }
    const boardFromUrl = searchParams.get("board");
    if (boardFromUrl && boards.some((b) => b.id === boardFromUrl)) {
      setActiveBoardId(boardFromUrl);
      navigate("/dashboard", { replace: true });
      return;
    }
    if (activeBoardId && !boards.some((b) => b.id === activeBoardId)) {
      setActiveBoardId(null);
    }
  }, [boardsLoading, boards, activeBoardId, searchParams, navigate]);

  useEffect(() => {
    setSaveBoardError("");
    setSaveEntryError("");
    setEditingRowId(null);
    setOriginalEditRowData(null);
    setFocusAfterDelete(null);
    setIsEditingBoard(false);
    setBoardEditDraft(null);
    setSaveBoardEditError("");
    setDeleteBoardError("");
  }, [activeBoardId]);

  const boardInteractionsLocked = deletingBoardId != null;

  const handleAddResume = async (file) => {
    if (!isResumesApiConfigured()) {
      console.error("VITE_API_URL is not set; cannot upload resume");
      return;
    }
    setIsUploadingResume(true);
    try {
      const contentType = resolveResumeContentType(file);
      const presign = await getResumeUploadUrl(file.name, contentType);
      await uploadFileToS3(presign.uploadUrl, file, presign.contentType);
      const metadata = await createResumeMetadata(
        presign.resumeId,
        file.name,
        presign.s3Key,
        presign.contentType,
      );
      setResumes((prev) => {
        const next = resumeFromServer(metadata);
        if (prev.some((x) => x.id === next.id)) return prev;
        return [next, ...prev];
      });
    } catch (err) {
      console.error("Resume upload failed", err);
      alert("Failed to upload resume. Please try again.");
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleSelectBoard = (boardId) => {
    if (boardInteractionsLocked) return;
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
    if (boardInteractionsLocked) return;
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
    if (boardInteractionsLocked) return;
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
    if (boardInteractionsLocked) return;
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

  const canSaveBoardEdit =
    Boolean(isEditingBoard && boardEditDraft) &&
    boardEditDraft.name.trim().length > 0 &&
    boardEditDraft.columns.length > 0 &&
    boardEditDraft.columns.every((c) => c.name.trim().length > 0);

  const boardForTable =
    activeBoard && isEditingBoard && boardEditDraft
      ? {
          ...activeBoard,
          name: boardEditDraft.name,
          columns: boardEditDraft.columns,
        }
      : activeBoard;

  const handleStartEditBoard = () => {
    if (boardInteractionsLocked) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted) return;

    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b) return prev;
      let rows = b.rows;
      if (editingRowId && originalEditRowData?.rowId === editingRowId) {
        rows = rows.map((r) =>
          r.id === editingRowId
            ? { ...r, cells: { ...originalEditRowData.cells } }
            : r,
        );
      }
      rows = rows.filter((r) => !r.pendingSave);
      return prev.map((x) =>
        x.id === activeBoardId ? { ...x, rows } : x,
      );
    });

    setEditingRowId(null);
    setOriginalEditRowData(null);
    setSaveEntryError("");

    setBoardEditDraft({
      name: board.name,
      columns: board.columns.map((c) => ({ ...c })),
    });
    setIsEditingBoard(true);
    setSaveBoardEditError("");
  };

  const handleCancelBoardEdit = () => {
    if (boardInteractionsLocked) return;
    setIsEditingBoard(false);
    setBoardEditDraft(null);
    setSaveBoardEditError("");
  };

  const handleBoardTitleDraftChange = (value) => {
    if (boardInteractionsLocked) return;
    setBoardEditDraft((prev) => (prev ? { ...prev, name: value } : prev));
  };

  const handleBoardColumnDraftChange = (columnId, value) => {
    if (boardInteractionsLocked) return;
    setBoardEditDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) =>
          c.id === columnId ? { ...c, name: value } : c,
        ),
      };
    });
  };

  const handleRemoveBoardColumnDraft = (columnId) => {
    if (boardInteractionsLocked) return;
    setBoardEditDraft((prev) => {
      if (!prev || prev.columns.length <= 1) return prev;
      return {
        ...prev,
        columns: prev.columns.filter((c) => c.id !== columnId),
      };
    });
  };

  const handleUpdateBoard = () => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || !isBoardsApiConfigured()) return;
    if (!boardEditDraft || !canSaveBoardEdit) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted) return;

    setSaveBoardEditError("");
    setSavingBoardEdit(true);

    updateBoard(board.id, {
      boardName: boardEditDraft.name.trim(),
      columns: boardEditDraft.columns.map((c) => ({
        id: c.id,
        name: c.name.trim(),
      })),
    })
      .then((data) => {
        const saved = boardFromServer(data);
        setBoards((prev) =>
          prev.map((b) => (b.id === saved.id ? saved : b)),
        );
        setIsEditingBoard(false);
        setBoardEditDraft(null);
        setSaveBoardEditError("");
      })
      .catch((err) => {
        setSaveBoardEditError(
          err instanceof Error ? err.message : "Could not update board.",
        );
      })
      .finally(() => {
        setSavingBoardEdit(false);
      });
  };

  const handleAddColumn = (columnName) => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId) return;
    if (isEditingBoard && boardEditDraft) {
      const trimmed = columnName.trim();
      if (!trimmed) return;
      setBoardEditDraft((prev) => {
        if (!prev) return prev;
        const col = { id: crypto.randomUUID(), name: trimmed };
        return { ...prev, columns: [...prev.columns, col] };
      });
      return;
    }
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b || b.columnsLocked) return prev;
      return prev.map((x) =>
        x.id === activeBoardId ? addColumnToBoard(x, columnName) : x,
      );
    });
  };

  const handleEnableBoardEntries = (boardId) => {
    if (boardInteractionsLocked) return;
    if (isEditingBoard) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === boardId);
      if (!b?.persisted) return prev;
      return prev.map((x) =>
        x.id === boardId ? { ...x, entriesEnabled: true } : x,
      );
    });
  };

  const handleAddRow = () => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || isEditingBoard) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b?.persisted || !b?.entriesEnabled) return prev;
      return prev.map((x) =>
        x.id === activeBoardId ? addRowToBoard(x) : x,
      );
    });
  };

  const handleCellChange = (rowId, columnId, value) => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || isEditingBoard) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b?.persisted || !b?.entriesEnabled) return prev;
      const row = b.rows.find((r) => r.id === rowId);
      const canEdit =
        row?.pendingSave === true ||
        (editingRowId === rowId && row && !row.pendingSave);
      if (!canEdit) return prev;
      return prev.map((x) =>
        x.id === activeBoardId
          ? updateCell(x, rowId, columnId, value)
          : x,
      );
    });
  };

  const handleStartEditRow = (rowId) => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || isEditingBoard) return;
    if (savingEntryRowId) return;
    if (deletingRowId) return;
    const board = boards.find((b) => b.id === activeBoardId);
    const row = board?.rows.find((r) => r.id === rowId);
    if (!board?.persisted || !row || row.pendingSave) return;

    if (
      editingRowId &&
      editingRowId !== rowId &&
      originalEditRowData?.rowId === editingRowId
    ) {
      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== activeBoardId) return b;
          return {
            ...b,
            rows: b.rows.map((r) =>
              r.id === editingRowId
                ? { ...r, cells: { ...originalEditRowData.cells } }
                : r,
            ),
          };
        }),
      );
    }

    setOriginalEditRowData({ rowId, cells: { ...row.cells } });
    setEditingRowId(rowId);
    setSaveEntryError("");
  };

  const handleCancelEdit = () => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || !editingRowId) {
      setEditingRowId(null);
      setOriginalEditRowData(null);
      return;
    }
    if (originalEditRowData?.rowId !== editingRowId) {
      setEditingRowId(null);
      setOriginalEditRowData(null);
      return;
    }
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id !== activeBoardId) return b;
        return {
          ...b,
          rows: b.rows.map((r) =>
            r.id === editingRowId
              ? { ...r, cells: { ...originalEditRowData.cells } }
              : r,
          ),
        };
      }),
    );
    setEditingRowId(null);
    setOriginalEditRowData(null);
  };

  const handleUpdateRow = (rowId) => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || !isBoardsApiConfigured() || isEditingBoard) return;
    if (savingEntryRowId) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted || !board.entriesEnabled) return;
    if (editingRowId !== rowId) return;
    const row = board.rows.find((r) => r.id === rowId);
    if (!row || row.pendingSave) return;

    setSaveEntryError("");

    const cells = Object.fromEntries(
      board.columns.map((c) => [c.id, row.cells[c.id] ?? ""]),
    );

    if (!entryCellsHaveAtLeastOneFilledValue(cells)) {
      setSaveEntryError(ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE);
      return;
    }

    setSavingEntryRowId(rowId);

    updateBoardEntry(board.id, rowId, { cells })
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
        setEditingRowId(null);
        setOriginalEditRowData(null);
        setSaveEntryError("");
      })
      .catch((err) => {
        setSaveEntryError(
          err instanceof Error ? err.message : "Could not update entry.",
        );
      })
      .finally(() => {
        setSavingEntryRowId(null);
      });
  };

  const handleSaveRow = (rowId) => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || !isBoardsApiConfigured() || isEditingBoard) return;
    if (savingEntryRowId) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted || !board.entriesEnabled) return;
    const row = board.rows.find((r) => r.id === rowId);
    if (!row?.pendingSave) return;

    setSaveEntryError("");

    const cells = Object.fromEntries(
      board.columns.map((c) => [c.id, row.cells[c.id] ?? ""]),
    );

    if (!entryCellsHaveAtLeastOneFilledValue(cells)) {
      setSaveEntryError(ENTRY_SAVE_REQUIRES_FILLED_FIELD_MESSAGE);
      return;
    }

    setSavingEntryRowId(rowId);

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

  const handleDeleteRow = (rowId) => {
    if (boardInteractionsLocked) return;
    if (!activeBoardId || !isBoardsApiConfigured() || isEditingBoard) return;
    if (savingEntryRowId || deletingRowId) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted || !board.entriesEnabled) return;
    const deletedIndex = board.rows.findIndex((r) => r.id === rowId);
    if (deletedIndex < 0) return;
    if (
      !window.confirm("Are you sure you want to delete this entry?")
    ) {
      return;
    }

    setSaveEntryError("");
    setDeletingRowId(rowId);

    deleteBoardEntry(board.id, rowId)
      .then(() => {
        setBoards((prev) =>
          prev.map((b) => {
            if (b.id !== board.id) return b;
            return {
              ...b,
              rows: b.rows.filter((r) => r.id !== rowId),
            };
          }),
        );
        if (editingRowId === rowId) {
          setEditingRowId(null);
          setOriginalEditRowData(null);
        }
        setFocusAfterDelete({ deletedIndex });
        setSaveEntryError("");
      })
      .catch((err) => {
        setSaveEntryError(
          err instanceof Error ? err.message : "Could not delete entry.",
        );
      })
      .finally(() => {
        setDeletingRowId(null);
      });
  };

  const handleDeleteBoard = () => {
    if (boardInteractionsLocked) return;
    if (!isBoardsApiConfigured()) return;
    const board = boards.find((b) => b.id === activeBoardId);
    if (!board?.persisted) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this board and all its jobs? This action cannot be undone.",
      )
    ) {
      return;
    }
    setDeleteBoardError("");
    setDeletingBoardId(board.id);
    deleteBoard(board.id)
      .then(() => {
        setBoards((prev) => prev.filter((b) => b.id !== board.id));
      })
      .catch((err) => {
        setDeleteBoardError(
          err instanceof Error ? err.message : "Could not delete board.",
        );
      })
      .finally(() => {
        setDeletingBoardId(null);
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
    const qs = searchParams.toString();
    return <Navigate to={qs ? `/login?${qs}` : "/login"} replace />;
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar
        signedInUsername={username}
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
        boardInteractionsLocked={boardInteractionsLocked}
        createBoardError={createBoardError}
        onSignOut={handleSignOut}
        signingOut={signingOut}
        logoutError={logoutError}
        resumes={resumes}
        resumesLoading={resumesLoading}
        isUploadingResume={isUploadingResume}
        onAddResume={handleAddResume}
      />
      <main className="dashboard-main">
        <div
          className={
            activeBoard
              ? "dashboard-main__inner dashboard-main__inner--wide"
              : "dashboard-main__inner"
          }
        >
          {boardsLoadError ? (
            <p className="auth-form-error dashboard-main__api-error" role="alert">
              {boardsLoadError}
            </p>
          ) : null}
          {resumesLoadError ? (
            <p className="auth-form-error dashboard-main__api-error" role="alert">
              {resumesLoadError}
            </p>
          ) : null}
          {activeBoard ? (
            <>
              <h1 className="dashboard-main__page-title">Dashboard</h1>
              <BoardTableView
                key={activeBoard.id}
                board={boardForTable ?? activeBoard}
                persisted={activeBoard.persisted === true}
                columnsLocked={activeBoard.columnsLocked === true}
                entriesEnabled={activeBoard.entriesEnabled === true}
                isEditingBoard={isEditingBoard}
                canSaveBoardEdit={canSaveBoardEdit}
                savingBoardEdit={savingBoardEdit}
                saveBoardEditError={saveBoardEditError}
                onBoardTitleChange={handleBoardTitleDraftChange}
                onStartEditBoard={handleStartEditBoard}
                onSaveBoardEdit={handleUpdateBoard}
                onCancelBoardEdit={handleCancelBoardEdit}
                onBoardColumnNameChange={handleBoardColumnDraftChange}
                onRemoveBoardColumn={handleRemoveBoardColumnDraft}
                onEnableEntries={() =>
                  handleEnableBoardEntries(activeBoard.id)
                }
                onAddColumn={handleAddColumn}
                onAddRow={handleAddRow}
                onCellChange={handleCellChange}
                onSaveRow={handleSaveRow}
                savingRowId={savingEntryRowId}
                saveRowError={saveEntryError}
                editingRowId={editingRowId}
                onStartEditRow={handleStartEditRow}
                onCancelEdit={handleCancelEdit}
                onUpdateRow={handleUpdateRow}
                deletingRowId={deletingRowId}
                onDeleteRow={handleDeleteRow}
                focusAfterDelete={focusAfterDelete}
                onFocusAfterDeleteComplete={handleFocusAfterDeleteComplete}
                deletingBoardId={deletingBoardId}
                onDeleteBoard={handleDeleteBoard}
                deleteBoardError={deleteBoardError}
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
          ) : null}
        </div>
      </main>
    </div>
  );
}
