import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getCurrentUser } from "aws-amplify/auth";
import { signOut } from "../auth/cognitoStub";
import { createBoard, isBoardsApiConfigured, listBoards } from "../api/boardsApi";
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
  const [createBoardSubmitting, setCreateBoardSubmitting] = useState(false);
  const [createBoardError, setCreateBoardError] = useState("");

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
    setCreateBoardSubmitting(false);
    setIsCreatingTable(true);
    setCreateTableName("");
  };

  const handleCancelCreateTable = () => {
    if (createBoardSubmitting) return;
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
    if (createBoardSubmitting) return;

    if (isBoardsApiConfigured()) {
      setCreateBoardError("");
      const pendingId = `pending-${crypto.randomUUID()}`;
      const optimisticBoard = {
        ...createEmptyBoard(name),
        id: pendingId,
        pending: true,
      };
      setBoards((prev) => [...prev, optimisticBoard]);
      setActiveBoardId(pendingId);
      setIsCreatingTable(false);
      setCreateTableName("");
      setCreateBoardSubmitting(true);
      createBoard(name)
        .then((created) => {
          const board = boardFromServer(created);
          setBoards((prev) =>
            prev.map((b) => (b.id === pendingId ? board : b)),
          );
          setActiveBoardId(board.id);
        })
        .catch((err) => {
          setBoards((prev) => {
            const next = prev.filter((b) => b.id !== pendingId);
            setActiveBoardId((current) => {
              if (current !== pendingId) return current;
              return next[0]?.id ?? null;
            });
            return next;
          });
          setCreateBoardError(
            err instanceof Error ? err.message : "Could not create table.",
          );
        })
        .finally(() => {
          setCreateBoardSubmitting(false);
        });
      return;
    }

    const board = createEmptyBoard(name);
    setBoards((prev) => [...prev, board]);
    setActiveBoardId(board.id);
    setIsCreatingTable(false);
    setCreateTableName("");
  };

  const activeBoard =
    boards.find((b) => b.id === activeBoardId) ?? null;

  const handleAddColumn = (columnName) => {
    if (!activeBoardId) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b || b.pending) return prev;
      return prev.map((x) =>
        x.id === activeBoardId ? addColumnToBoard(x, columnName) : x,
      );
    });
  };

  const handleEnableBoardEntries = (boardId) => {
    setBoards((prev) => {
      const b = prev.find((x) => x.id === boardId);
      if (!b || b.pending) return prev;
      return prev.map((x) =>
        x.id === boardId ? { ...x, entriesEnabled: true } : x,
      );
    });
  };

  const handleAddRow = () => {
    if (!activeBoardId) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b?.entriesEnabled || b.pending) return prev;
      return prev.map((x) =>
        x.id === activeBoardId ? addRowToBoard(x) : x,
      );
    });
  };

  const handleCellChange = (rowId, columnId, value) => {
    if (!activeBoardId) return;
    setBoards((prev) => {
      const b = prev.find((x) => x.id === activeBoardId);
      if (!b?.entriesEnabled || b.pending) return prev;
      return prev.map((x) =>
        x.id === activeBoardId
          ? updateCell(x, rowId, columnId, value)
          : x,
      );
    });
  };

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
        onSelectBoard={setActiveBoardId}
        isCreatingTable={isCreatingTable}
        createTableName={createTableName}
        onCreateTableNameChange={setCreateTableName}
        onStartCreate={handleStartCreateTable}
        onCommitCreate={handleCommitCreateTable}
        onCancelCreate={handleCancelCreateTable}
        boardsLoading={boardsLoading}
        createBoardSubmitting={createBoardSubmitting}
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
                entriesEnabled={activeBoard.entriesEnabled === true}
                onEnableEntries={() =>
                  handleEnableBoardEntries(activeBoard.id)
                }
                onAddColumn={handleAddColumn}
                onAddRow={handleAddRow}
                onCellChange={handleCellChange}
              />
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
