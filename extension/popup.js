/** Keep in sync with keys in background.js */
const STORAGE_KEYS = [
  "applicache_idToken",
  "applicache_accessToken",
  "applicache_refreshToken",
  "applicache_email",
  "applicache_idTokenExp",
];

function getAppOrigin() {
  const origin =
    typeof globalThis !== "undefined" && globalThis.APPLICACHE_APP_ORIGIN
      ? globalThis.APPLICACHE_APP_ORIGIN
      : "http://localhost:5173";
  return String(origin).replace(/\/$/, "");
}

function getApiBase() {
  const raw =
    typeof globalThis !== "undefined" && globalThis.APPLICACHE_API_BASE_URL
      ? globalThis.APPLICACHE_API_BASE_URL
      : "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.replace(/\/$/, "");
}

/**
 * @param {Record<string, unknown>} data
 * @returns {boolean}
 */
function isSessionValid(data) {
  const idToken = data.applicache_idToken;
  if (!idToken || typeof idToken !== "string") return false;
  const exp = data.applicache_idTokenExp;
  if (typeof exp === "number" && exp <= Date.now()) return false;
  return true;
}

/**
 * @param {Response} res
 * @returns {Promise<string>}
 */
async function parseErrorBody(res) {
  try {
    const data = await res.json();
    if (data && typeof data.message === "string") return data.message;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

/**
 * @param {"error"|"success"|"neutral"|"warning"} kind
 * @param {string} text
 */
function setCacheStatus(kind, text) {
  const el = document.getElementById("cache-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove(
    "cache-status--error",
    "cache-status--success",
    "cache-status--warning",
  );
  if (kind === "error") el.classList.add("cache-status--error");
  else if (kind === "success") el.classList.add("cache-status--success");
  else if (kind === "warning") el.classList.add("cache-status--warning");
}

function resetBoardSelect() {
  const boardSelect = document.getElementById("board-select");
  if (!boardSelect) return;
  boardSelect.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "Select a board…";
  boardSelect.appendChild(opt);
}

/**
 * @param {string | undefined} url
 * @returns {boolean}
 */
function isLinkedInJobPageUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "www.linkedin.com") return false;
    return u.pathname.includes("/jobs/");
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<Record<string, unknown>>}
 */
function getStorageData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

/**
 * @param {string} boardId
 * @param {string} rawText
 * @param {string} url
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchPreviewSmartCache(boardId, rawText, url) {
  const base = getApiBase();
  if (!base) {
    throw new Error(
      "API URL not configured. Set APPLICACHE_API_BASE_URL in config.js.",
    );
  }
  const data = await getStorageData();
  const idToken = data.applicache_idToken;
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Not signed in. Connect your account from the dashboard.");
  }

  const res = await fetch(
    `${base}/boards/${encodeURIComponent(boardId)}/smart-cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rawText, url, previewOnly: true }),
    },
  );

  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again on the web.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body && typeof body.message === "string"
        ? body.message
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

/**
 * @param {string} boardId
 * @param {Record<string, string>} cells
 * @param {string} url
 * @returns {Promise<void>}
 */
async function saveBoardRow(boardId, cells, url) {
  const base = getApiBase();
  if (!base) {
    throw new Error(
      "API URL not configured. Set APPLICACHE_API_BASE_URL in config.js.",
    );
  }
  const data = await getStorageData();
  const idToken = data.applicache_idToken;
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Not signed in. Connect your account from the dashboard.");
  }

  const res = await fetch(
    `${base}/boards/${encodeURIComponent(boardId)}/entries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cells, url }),
    },
  );

  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again on the web.");
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res));
  }
}

/**
 * @param {"error"|"success"|"neutral"|"warning"} kind
 * @param {string} text
 */
function setPreviewStatus(kind, text) {
  const el = document.getElementById("preview-cache-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove(
    "cache-status--error",
    "cache-status--success",
    "cache-status--warning",
    "hidden",
  );
  if (!text) {
    el.classList.add("hidden");
    return;
  }
  if (kind === "error") el.classList.add("cache-status--error");
  else if (kind === "success") el.classList.add("cache-status--success");
  else if (kind === "warning") el.classList.add("cache-status--warning");
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isLongTextColumn(name) {
  const n = String(name).toLowerCase();
  return n.includes("note") || n.includes("description");
}

/**
 * @param {Record<string, string>} cells
 * @param {{ id: string, name: string }[]} columns
 * @param {{ isDuplicate?: boolean, message?: string }} meta
 */
function renderEditablePreview(cells, columns, meta) {
  const body = document.getElementById("preview-body");
  if (!body) return;
  body.innerHTML = "";

  if (meta && meta.isDuplicate) {
    const banner = document.createElement("p");
    banner.className = "preview-banner";
    banner.textContent =
      meta.message && String(meta.message).trim()
        ? String(meta.message)
        : "This job may already be on your board.";
    body.appendChild(banner);
  }

  const fields = document.createElement("div");
  fields.className = "preview-fields";

  for (const col of columns) {
    if (!col || typeof col.id !== "string") continue;
    const id = col.id;
    const name =
      typeof col.name === "string" && col.name.trim()
        ? col.name
        : "Column";
    const val = cells[id] != null ? String(cells[id]) : "";

    const wrap = document.createElement("div");
    wrap.className = "preview-field";

    const label = document.createElement("label");
    label.className = "preview-field__label";
    label.htmlFor = `preview-col-${id}`;
    label.textContent = name;

    const long = isLongTextColumn(name);
    const control = long
      ? document.createElement("textarea")
      : document.createElement("input");
    control.className = "preview-field__control";
    control.id = `preview-col-${id}`;
    control.dataset.columnId = id;
    if (!long) control.type = "text";
    control.value = val;

    wrap.appendChild(label);
    wrap.appendChild(control);
    fields.appendChild(wrap);
  }

  body.appendChild(fields);

  const actions = document.createElement("div");
  actions.className = "preview-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.id = "btn-preview-save";
  saveBtn.className = "btn btn-primary";
  saveBtn.setAttribute("aria-busy", "false");
  saveBtn.innerHTML =
    '<span class="btn__spinner" aria-hidden="true"></span><span class="btn__label">Save to Board</span>';

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.id = "btn-preview-cancel";
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.textContent = "Cancel";

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  body.appendChild(actions);
}

/**
 * @returns {Record<string, string>}
 */
function collectCellsFromPreview() {
  /** @type {Record<string, string>} */
  const cells = {};
  const controls = document.querySelectorAll(
    "#preview-body .preview-field__control",
  );
  controls.forEach((el) => {
    const id = el.dataset.columnId;
    if (!id) return;
    cells[id] = el.value != null ? String(el.value) : "";
  });
  return cells;
}

/**
 * @param {string | undefined} msg
 * @returns {boolean}
 */
function isContentScriptConnectionError(msg) {
  if (!msg || typeof msg !== "string") return false;
  return (
    msg.includes("Could not establish connection") ||
    msg.includes("Receiving end does not exist")
  );
}

/**
 * @param {string} idToken
 * @returns {Promise<void>}
 */
async function loadBoards(idToken) {
  resetBoardSelect();
  const base = getApiBase();
  if (!base) {
    setCacheStatus(
      "error",
      "API URL not configured. Set APPLICACHE_API_BASE_URL in config.js.",
    );
    return;
  }

  try {
    const res = await fetch(`${base}/boards`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (res.status === 401) {
      setCacheStatus(
        "error",
        "Session expired. Please sign in again on the web.",
      );
      return;
    }

    if (!res.ok) {
      setCacheStatus("error", await parseErrorBody(res));
      return;
    }

    const json = await res.json();
    const boards = Array.isArray(json.boards) ? json.boards : [];
    const boardSelect = document.getElementById("board-select");
    if (!boardSelect) return;

    boardSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a board…";
    boardSelect.appendChild(placeholder);

    if (boards.length === 0) {
      setCacheStatus(
        "neutral",
        "No boards yet. Create one in the dashboard.",
      );
      return;
    }

    for (const b of boards) {
      const id = b.boardId;
      if (typeof id !== "string" || !id) continue;
      const opt = document.createElement("option");
      opt.value = id;
      const name =
        typeof b.boardName === "string" && b.boardName.trim()
          ? b.boardName.trim()
          : id;
      opt.textContent = name;
      boardSelect.appendChild(opt);
    }

    setCacheStatus("neutral", "");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load boards.";
    setCacheStatus("error", msg);
  }
}

/**
 * @param {Record<string, unknown>} data
 */
function render(data) {
  const authSection = document.getElementById("auth-section");
  const loginSection = document.getElementById("login-section");
  const emailEl = document.getElementById("user-email");
  const loginMessage = document.getElementById("login-message");

  if (!authSection || !loginSection || !emailEl) return;

  const authed = isSessionValid(data);

  if (authed) {
    loginSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    const email =
      typeof data.applicache_email === "string" && data.applicache_email
        ? data.applicache_email
        : "Account";
    emailEl.textContent = email;
    setCacheStatus("neutral", "");
    const idToken =
      typeof data.applicache_idToken === "string" ? data.applicache_idToken : "";
    if (idToken) {
      void loadBoards(idToken);
    }
  } else {
    authSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    resetBoardSelect();
    if (loginMessage) {
      const expired =
        typeof data.applicache_idTokenExp === "number" &&
        data.applicache_idTokenExp <= Date.now();
      loginMessage.textContent = expired
        ? "Session expired — sign in again on the web, then connect from the dashboard."
        : "Please log in to start caching jobs.";
    }
  }
}

function refreshFromStorage() {
  chrome.storage.local.get(STORAGE_KEYS, (result) => {
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message);
      return;
    }
    render(result);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  refreshFromStorage();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const touched = STORAGE_KEYS.some((k) =>
      Object.prototype.hasOwnProperty.call(changes, k),
    );
    if (touched) refreshFromStorage();
  });

  const loginBtn = document.getElementById("btn-login");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const id = chrome.runtime.id;
      const origin = getAppOrigin();
      const url = `${origin}/dashboard?from=extension&extensionId=${encodeURIComponent(id)}`;
      chrome.tabs.create({ url });
    });
  }

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      chrome.storage.local.remove(STORAGE_KEYS, () => {
        refreshFromStorage();
      });
    });
  }

  const btnCache = document.getElementById("btn-cache");
  /** @type {boolean} */
  let cacheRequestInFlight = false;
  /** @type {boolean} */
  let previewSaveInFlight = false;
  /** @type {{ boardId: string, pageUrl: string } | null} */
  let previewContext = null;

  const authSection = document.getElementById("auth-section");
  const previewArea = document.getElementById("preview-area");

  /**
   * @param {boolean} loading
   */
  const setPreviewSaveLoading = (loading) => {
    previewSaveInFlight = loading;
    const saveBtn = document.getElementById("btn-preview-save");
    if (saveBtn) {
      if (loading) {
        saveBtn.classList.add("preview-btn--loading");
        saveBtn.disabled = true;
        saveBtn.setAttribute("aria-busy", "true");
      } else {
        saveBtn.classList.remove("preview-btn--loading");
        saveBtn.disabled = false;
        saveBtn.setAttribute("aria-busy", "false");
      }
    }
    document
      .querySelectorAll("#preview-body .preview-field__control")
      .forEach((el) => {
        el.disabled = loading;
      });
    const cancelBtn = document.getElementById("btn-preview-cancel");
    if (cancelBtn) cancelBtn.disabled = loading;
  };

  const hidePreviewView = () => {
    previewContext = null;
    const body = document.getElementById("preview-body");
    if (body) body.innerHTML = "";
    setPreviewStatus("neutral", "");
    if (previewArea) {
      previewArea.classList.add("hidden");
      previewArea.setAttribute("aria-hidden", "true");
    }
    if (authSection) authSection.classList.remove("hidden");
  };

  const showPreviewView = () => {
    if (authSection) authSection.classList.add("hidden");
    if (previewArea) {
      previewArea.classList.remove("hidden");
      previewArea.setAttribute("aria-hidden", "false");
    }
    setPreviewStatus("neutral", "");
  };

  const wirePreviewActions = () => {
    const saveEl = document.getElementById("btn-preview-save");
    const cancelEl = document.getElementById("btn-preview-cancel");
    if (saveEl) {
      saveEl.addEventListener("click", () => {
        if (!previewContext || previewSaveInFlight) return;
        void (async () => {
          setPreviewSaveLoading(true);
          setPreviewStatus("neutral", "");
          try {
            const cells = collectCellsFromPreview();
            await saveBoardRow(
              previewContext.boardId,
              cells,
              previewContext.pageUrl,
            );
            setCacheStatus("success", "Saved to your board!");
            hidePreviewView();
          } catch (e) {
            const msg =
              e instanceof Error
                ? e.message
                : "Could not save to your board.";
            setPreviewStatus("error", msg);
          } finally {
            setPreviewSaveLoading(false);
          }
        })();
      });
    }
    if (cancelEl) {
      cancelEl.addEventListener("click", () => {
        if (previewSaveInFlight) return;
        setCacheStatus("neutral", "");
        hidePreviewView();
      });
    }
  };

  if (btnCache) {
    btnCache.addEventListener("click", () => {
      const boardSelect = document.getElementById("board-select");
      const boardId = boardSelect && boardSelect.value ? boardSelect.value : "";
      if (!boardId) {
        setCacheStatus("error", "Select a board first.");
        return;
      }

      if (cacheRequestInFlight) {
        return;
      }

      const finishLoading = () => {
        cacheRequestInFlight = false;
        btnCache.classList.remove("btn--loading");
        btnCache.disabled = false;
        btnCache.setAttribute("aria-busy", "false");
      };

      cacheRequestInFlight = true;
      btnCache.classList.add("btn--loading");
      btnCache.disabled = true;
      btnCache.setAttribute("aria-busy", "true");
      setCacheStatus("neutral", "AI is analyzing the page...");

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          finishLoading();
          setCacheStatus("error", "No active tab.");
          return;
        }

        if (!isLinkedInJobPageUrl(tab.url)) {
          finishLoading();
          setCacheStatus(
            "error",
            "Open a LinkedIn jobs page (linkedin.com/jobs/…) and try again.",
          );
          return;
        }

        try {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "GET_JOB_DATA" },
            (response) => {
              if (chrome.runtime.lastError) {
                finishLoading();
                const errMsg = chrome.runtime.lastError.message || "";
                if (isContentScriptConnectionError(errMsg)) {
                  setCacheStatus(
                    "error",
                    "Please refresh the LinkedIn page and try again.",
                  );
                } else {
                  setCacheStatus(
                    "error",
                    "Open a LinkedIn jobs page and try again.",
                  );
                }
                return;
              }

              void (async () => {
                try {
                  if (
                    !response ||
                    typeof response !== "object" ||
                    typeof response.rawText !== "string" ||
                    typeof response.url !== "string"
                  ) {
                    setCacheStatus(
                      "error",
                      "Could not read this page. Open a LinkedIn jobs page and try again.",
                    );
                    return;
                  }

                  const raw = response.rawText.trim();
                  if (raw.length <= 100) {
                    setCacheStatus(
                      "warning",
                      "Not enough text on this page. Open a job or scroll to load content, then try again.",
                    );
                    return;
                  }

                  const data = await fetchPreviewSmartCache(
                    boardId,
                    response.rawText,
                    response.url,
                  );

                  const cells =
                    data.cells &&
                    typeof data.cells === "object" &&
                    !Array.isArray(data.cells)
                      ? /** @type {Record<string, string>} */ (data.cells)
                      : {};
                  const columns = Array.isArray(data.columns) ? data.columns : [];
                  if (columns.length === 0) {
                    setCacheStatus(
                      "error",
                      "Could not load board columns. Try again or reopen the extension.",
                    );
                    return;
                  }

                  previewContext = {
                    boardId,
                    pageUrl: response.url,
                  };

                  const isDuplicate = Boolean(data.isDuplicate);
                  const message =
                    typeof data.message === "string" ? data.message : "";

                  renderEditablePreview(cells, columns, {
                    isDuplicate,
                    message,
                  });
                  showPreviewView();
                  wirePreviewActions();
                } catch (e) {
                  const msg =
                    e instanceof Error
                      ? e.message
                      : "Could not analyze this page.";
                  setCacheStatus("error", msg);
                } finally {
                  finishLoading();
                }
              })();
            },
          );
        } catch {
          finishLoading();
          setCacheStatus(
            "error",
            "Please refresh the LinkedIn page and try again.",
          );
        }
      });
    });
  }
});
