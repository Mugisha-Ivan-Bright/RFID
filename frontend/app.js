const WEBSOCKET_URL = "ws://localhost:8080"; // Local backend URL
const TEAM_ID = "team_001"; // replace with real team id if needed

// --- DOM ELEMENTS ---
const teamIdEl = document.getElementById("teamId");
const connectionStatusEl = document.getElementById("connectionStatus");
const cardStatusBadgeEl = document.getElementById("cardStatusBadge");
const cardUidDisplayEl = document.getElementById("cardUidDisplay");
const cardBalanceDisplayEl = document.getElementById("cardBalanceDisplay");
const lastUpdatedDisplayEl = document.getElementById("lastUpdatedDisplay");
const activeCardsCountEl = document.getElementById("activeCardsCount");
const totalBalanceEl = document.getElementById("totalBalance");
const todaysTopupsEl = document.getElementById("todaysTopups");

const topupFormEl = document.getElementById("topupForm");
const amountInputEl = document.getElementById("amountInput");
const amountErrorEl = document.getElementById("amountError");
const topupButtonEl = document.getElementById("topupButton");
const topupSpinnerEl = document.getElementById("topupSpinner");
const topupHelperEl = document.getElementById("topupHelper");

const transactionTableBodyEl = document.getElementById("transactionTableBody");
const txCountBadgeEl = document.getElementById("txCountBadge");
const searchUidInputEl = document.getElementById("searchUidInput");
const downloadCsvButtonEl = document.getElementById("downloadCsvButton");
const toastContainerEl = document.getElementById("toastContainer");
const themeToggleEl = document.getElementById("themeToggle");

// --- APPLICATION STATE ---
let socket = null;
let reconnectAttempts = 0;
let reconnectTimeoutId = null;
let lastHeartbeatTime = 0;

// Watchdog Polling (Checks every 1s)
setInterval(() => {
  if (currentCard.uid && (Date.now() - lastHeartbeatTime > 3000)) {
    console.log("Heartbeat lost ( > 3000ms). Clearing card.");
    updateCardInfo({ uid: null });
  }
}, 1000);

let currentCard = {
  uid: null,
  balance: 0,
  lastUpdated: null,
};

let transactions = [];

// --- UTILITIES ---
function formatCurrency(amount) {
  if (isNaN(amount)) return "0.00";
  return Number(amount).toFixed(2);
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  const date = typeof ts === "string" || typeof ts === "number" ? new Date(ts) : ts;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function setConnectionStatus(connected) {
  const dot = connectionStatusEl.querySelector(".status-dot");
  const label = connectionStatusEl.querySelector(".status-label");
  if (!dot || !label) return;

  dot.classList.toggle("status-connected", connected);
  dot.classList.toggle("status-disconnected", !connected);
  label.textContent = connected ? "Connected" : "Disconnected";
}

function showToast(type, title, message) {
  if (!toastContainerEl) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = document.createElement("div");
  icon.className = "toast-icon";

  const content = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.className = "toast-title";
  titleEl.textContent = title;
  const messageEl = document.createElement("div");
  messageEl.className = "toast-message";
  messageEl.textContent = message;
  content.appendChild(titleEl);
  content.appendChild(messageEl);

  toast.appendChild(icon);
  toast.appendChild(content);

  toastContainerEl.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px) scale(0.98)";
    setTimeout(() => {
      toast.remove();
    }, 180);
  }, 3500);
}

function setTopupLoading(isLoading) {
  if (!topupButtonEl || !topupSpinnerEl) return;
  if (isLoading) {
    topupButtonEl.disabled = true;
    topupSpinnerEl.hidden = false;
  } else {
    topupSpinnerEl.hidden = true;
    updateTopupButtonState();
  }
}

function hasValidCard() {
  return Boolean(currentCard.uid);
}

function isValidAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function updateTopupButtonState() {
  if (!topupButtonEl) return;
  const hasCard = hasValidCard();
  const validAmount = isValidAmount(amountInputEl.value);
  const shouldEnable = hasCard && validAmount;
  topupButtonEl.disabled = !shouldEnable;

  if (!hasCard) {
    topupHelperEl.textContent = "Scan a card to enable top-up.";
  } else if (!validAmount) {
    topupHelperEl.textContent = "Enter a valid amount greater than 0.";
  } else {
    topupHelperEl.textContent = "Ready to top up this card.";
  }
}

// --- CARD & TRANSACTION UI UPDATES ---
function updateCardInfo(card) {
  currentCard = {
    ...currentCard,
    ...card,
  };

  const { uid, balance, lastUpdated } = currentCard;

  cardUidDisplayEl.textContent = uid || "— — — —";
  cardBalanceDisplayEl.textContent = formatCurrency(balance || 0);
  lastUpdatedDisplayEl.textContent = formatTimestamp(lastUpdated);

  // badge
  if (uid) {
    cardStatusBadgeEl.textContent = "Card detected";
  } else {
    cardStatusBadgeEl.textContent = "Waiting for card…";
  }

  // animate balance change
  const cardInfoCard = document.getElementById("cardInfoCard");
  if (cardInfoCard) {
    cardInfoCard.classList.remove("balance-animate");
    void cardInfoCard.offsetWidth; // force reflow
    cardInfoCard.classList.add("balance-animate");
    setTimeout(() => cardInfoCard.classList.remove("balance-animate"), 420);
  }

  updateTopupButtonState();
}

function addTransactionRow(tx) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${tx.uid || ""}</td>
    <td>₹${formatCurrency(tx.amount)}</td>
    <td>₹${formatCurrency(tx.newBalance)}</td>
    <td>${formatTimestamp(tx.timestamp)}</td>
  `;
  return row;
}

function renderTransactions() {
  if (!transactionTableBodyEl) return;
  transactionTableBodyEl.innerHTML = "";

  const filterUid = searchUidInputEl.value.trim();
  const filtered = filterUid
    ? transactions.filter((t) => (t.uid || "").includes(filterUid))
    : transactions;

  if (!filtered.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "empty-row";
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No transactions yet.";
    emptyRow.appendChild(td);
    transactionTableBodyEl.appendChild(emptyRow);
  } else {
    filtered.forEach((tx) => {
      transactionTableBodyEl.appendChild(addTransactionRow(tx));
    });
  }

  txCountBadgeEl.textContent = `${transactions.length} record${transactions.length === 1 ? "" : "s"
    }`;
}

function addTransaction(tx) {
  transactions.unshift(tx);
  renderTransactions();
}

// --- CSV DOWNLOAD ---
function downloadTransactionsCsv() {
  if (!transactions.length) {
    showToast("info", "No data", "There are no transactions to export yet.");
    return;
  }
  const headers = ["UID", "Amount", "New Balance", "Timestamp"];
  const rows = transactions.map((t) => [
    t.uid || "",
    formatCurrency(t.amount),
    formatCurrency(t.newBalance),
    formatTimestamp(t.timestamp),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- WEBSOCKET HANDLING ---
function handleSocketMessage(event) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch (e) {
    console.warn("Non-JSON WebSocket message:", event.data);
    return;
  }

  // You can adapt these message shapes to your backend
  const { type, data } = payload;

  switch (type) {
    case "team":
      if (data && data.team_id && teamIdEl) {
        teamIdEl.textContent = data.team_id;
      }
      break;

    case "card_status":
      // Example: { type: "card_status", data: { uid: "1234ABCD", present: true } }
      if (data && data.present) {
        updateCardInfo({
          uid: data.uid,
          lastUpdated: Date.now(),
        });

        // Refresh the heartbeat timestamp
        lastHeartbeatTime = Date.now();
      } else {
        // Explicit 'present: false' message (if ever supported)
        updateCardInfo({ uid: null });
      }
      break;

    case "balance_update":
      // Example: { type: "balance_update", data: { uid, new_balance, amount, ts } }
      if (data) {
        const tx = {
          uid: data.uid || currentCard.uid,
          amount: data.amount ?? 0,
          newBalance: data.new_balance ?? data.balance ?? 0,
          timestamp: data.ts || Date.now(),
        };
        // update card balance if this is the current card
        if (tx.uid && tx.uid === currentCard.uid) {
          updateCardInfo({
            balance: tx.newBalance,
            lastUpdated: tx.timestamp,
          });
        }
        addTransaction(tx);
      }
      break;

    case "stats":
      // Optional system stats message
      if (data) {
        if (typeof data.active_cards === "number") {
          activeCardsCountEl.textContent = String(data.active_cards);
        }
        if (typeof data.total_balance === "number") {
          totalBalanceEl.textContent = formatCurrency(data.total_balance);
        }
        if (typeof data.todays_topups === "number") {
          todaysTopupsEl.textContent = formatCurrency(data.todays_topups);
        }
      }
      break;

    default:
      console.debug("Unhandled message", payload);
  }
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(WEBSOCKET_URL);
  } catch (err) {
    console.error("Failed to create WebSocket:", err);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    setConnectionStatus(true);
    reconnectAttempts = 0;
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
    showToast("success", "Connected", "WebSocket connection established.");
  };

  socket.onmessage = handleSocketMessage;

  socket.onclose = () => {
    setConnectionStatus(false);
    showToast("error", "Disconnected", "WebSocket connection closed. Reconnecting…");
    scheduleReconnect();
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    socket.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimeoutId) return;
  reconnectAttempts += 1;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempts, 5)); // exponential backoff
  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    connectWebSocket();
  }, delay);
}

// --- HTTP TOP-UP ---
async function submitTopup(event) {
  event.preventDefault();
  amountErrorEl.textContent = "";

  const amountValue = amountInputEl.value;
  if (!hasValidCard()) {
    showToast("error", "No card", "Scan a card before topping up.");
    updateTopupButtonState();
    return;
  }
  if (!isValidAmount(amountValue)) {
    amountErrorEl.textContent = "Please enter a valid amount greater than 0.";
    updateTopupButtonState();
    return;
  }

  const payload = {
    uid: currentCard.uid,
    amount: Number(amountValue),
  };

  setTopupLoading(true);

  try {
    const res = await fetch("/topup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorText = "Top-up failed.";
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) {
          errorText = errJson.error;
        }
      } catch {
        // ignore
      }
      showToast("error", "Top-up failed", errorText);
      return;
    }

    const data = await res.json().catch(() => ({}));
    showToast("success", "Top-up requested", "Top-up has been sent to the server.");

    // If backend returns updated balance immediately, reflect it
    if (data && (data.new_balance != null || data.balance != null)) {
      const newBalance = data.new_balance ?? data.balance;
      updateCardInfo({
        balance: newBalance,
        lastUpdated: Date.now(),
      });
    }

    amountInputEl.value = "";
    updateTopupButtonState();
  } catch (err) {
    console.error("Top-up error:", err);
    showToast("error", "Network error", "Unable to reach the server.");
  } finally {
    setTopupLoading(false);
  }
}

// --- THEME TOGGLE ---
function initTheme() {
  const stored = localStorage.getItem("rfid_theme");
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = stored ? stored === "dark" : prefersDark;
  document.body.classList.toggle("dark", isDark);
  if (themeToggleEl) {
    themeToggleEl.checked = isDark;
  }
}

function toggleTheme() {
  const isDark = themeToggleEl.checked;
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem("rfid_theme", isDark ? "dark" : "light");
}

// --- INIT ---
function init() {
  if (teamIdEl) teamIdEl.textContent = TEAM_ID;
  setConnectionStatus(false);
  updateTopupButtonState();
  renderTransactions();
  initTheme();

  if (topupFormEl) {
    topupFormEl.addEventListener("submit", submitTopup);
  }

  if (amountInputEl) {
    amountInputEl.addEventListener("input", () => {
      amountErrorEl.textContent = "";
      updateTopupButtonState();
    });
  }

  if (searchUidInputEl) {
    searchUidInputEl.addEventListener("input", () => {
      renderTransactions();
    });
  }

  if (downloadCsvButtonEl) {
    downloadCsvButtonEl.addEventListener("click", downloadTransactionsCsv);
  }

  if (themeToggleEl) {
    themeToggleEl.addEventListener("change", toggleTheme);
  }

  connectWebSocket();
}

window.addEventListener("load", init);

