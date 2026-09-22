// ===== 起動画面(スプラッシュ)の制御 =====
// 1. ロゴを1.5秒表示する
// 2. その後、フェードアウトさせながらアプリ本体をフェードインさせる

const SPLASH_DURATION_MS = 2000;
const FADE_DURATION_MS = 600;

window.addEventListener("DOMContentLoaded", () => {
  const splashScreen = document.getElementById("splash-screen");
  const app = document.getElementById("app");

  setTimeout(() => {
    splashScreen.classList.add("fade-out");

    app.hidden = false;
    // hidden を外した直後だと transition が効かないことがあるため
    // 1フレーム待ってから visible クラスを付ける
    requestAnimationFrame(() => {
      app.classList.add("visible");
    });

    setTimeout(() => {
      splashScreen.remove();
    }, FADE_DURATION_MS);
  }, SPLASH_DURATION_MS);
});

// ===== ひとこと欄の文字数カウンター =====

const commentInput = document.getElementById("comment");
const charCount = document.getElementById("char-count");

commentInput.addEventListener("input", () => {
  charCount.textContent = commentInput.value.length;
});

// ===== 保存機能 =====

const STORAGE_KEY = "todayMeRecords";

function getTodayDateString() {
  // ローカルの日付で "YYYY-MM-DD" を作る(タイムゾーンずれを避けるため手動で組み立てる)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function buildPraiseMessage(taskCount, tasks) {
  if (taskCount === 0) {
    return "今日は「できたこと」がなくても大丈夫。\nここに来て記録できたこと自体が、もう素敵な一歩です。\nゆっくり休んでくださいね。";
  }
  return `今日は「${tasks.join("、")}」など、\n${taskCount}個のことができましたね。\nよくがんばりました。`;
}

const saveBtn = document.getElementById("save-btn");
const moodError = document.getElementById("mood-error");
const recordForm = document.querySelector(".record-form");
const praiseCard = document.getElementById("praise-card");
const praiseMessage = document.getElementById("praise-message");
const editBtn = document.getElementById("edit-btn");
const todayReminder = document.getElementById("today-reminder");

function getTodayRecord() {
  const records = loadRecords();
  return records.find((r) => r.date === getTodayDateString());
}

function populateForm(record) {
  const moodRadio = document.querySelector(`input[name="mood"][value="${record.mood}"]`);
  if (moodRadio) moodRadio.checked = true;

  document.querySelectorAll('#tasks-grid input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = record.tasks.includes(checkbox.value);
  });

  commentInput.value = record.comment;
  charCount.textContent = commentInput.value.length;
}

function refreshTodayStatus() {
  const todayRecord = getTodayRecord();

  if (todayRecord) {
    todayReminder.hidden = true;
    praiseMessage.textContent = buildPraiseMessage(todayRecord.tasks.length, todayRecord.tasks);
    praiseCard.hidden = false;
    populateForm(todayRecord);
  } else {
    todayReminder.hidden = false;
    praiseCard.hidden = true;
  }
}

saveBtn.addEventListener("click", () => {
  const moodInput = document.querySelector('input[name="mood"]:checked');

  if (!moodInput) {
    moodError.hidden = false;
    return;
  }
  moodError.hidden = true;

  const mood = Number(moodInput.value);

  const tasks = Array.from(
    document.querySelectorAll('#tasks-grid input[type="checkbox"]:checked')
  ).map((el) => el.value);

  const comment = commentInput.value.trim();

  const record = {
    date: getTodayDateString(),
    mood,
    tasks,
    comment,
  };

  const records = loadRecords();
  const existingIndex = records.findIndex((r) => r.date === record.date);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }
  saveRecords(records);

  refreshTodayStatus();
  recordForm.hidden = true;
  renderHistory();
  renderChart();
});

editBtn.addEventListener("click", () => {
  praiseCard.hidden = true;
  recordForm.hidden = false;
});

refreshTodayStatus();

// ===== 過去の記録の一覧表示 =====

const MOOD_EMOJI = { 1: "😫", 2: "😢", 3: "😐", 4: "🙂", 5: "😊" };

const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");

function formatDateLabel(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function renderHistory() {
  const records = loadRecords();
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  historyList.innerHTML = "";

  if (sorted.length === 0) {
    historyEmpty.hidden = false;
    return;
  }
  historyEmpty.hidden = true;

  sorted.forEach((record) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const rowTop = document.createElement("div");
    rowTop.className = "history-row-top";

    const dateSpan = document.createElement("span");
    dateSpan.className = "history-date";
    dateSpan.textContent = formatDateLabel(record.date);

    const moodSpan = document.createElement("span");
    moodSpan.className = "history-mood";
    moodSpan.textContent = MOOD_EMOJI[record.mood] || "";

    rowTop.appendChild(dateSpan);
    rowTop.appendChild(moodSpan);
    li.appendChild(rowTop);

    const tasksDiv = document.createElement("div");
    tasksDiv.className = "history-tasks";
    tasksDiv.textContent = record.tasks.length ? record.tasks.join("・") : "できたこと:なし";
    li.appendChild(tasksDiv);

    if (record.comment) {
      const commentDiv = document.createElement("div");
      commentDiv.className = "history-comment";
      commentDiv.textContent = record.comment;
      li.appendChild(commentDiv);
    }

    historyList.appendChild(li);
  });
}

renderHistory();

// ===== 気分の変化グラフ(直近7日間) =====

const SVG_NS = "http://www.w3.org/2000/svg";
const chartSvg = document.getElementById("mood-chart");
const chartEmpty = document.getElementById("chart-empty");
const chartHint = document.getElementById("chart-hint");

const detailModal = document.getElementById("detail-modal");
const modalContent = document.getElementById("modal-content");
const modalCloseBtn = document.getElementById("modal-close");

function getLast7Dates() {
  const dates = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dates.push(dateStr);
  }
  return dates;
}

function formatShortDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function renderChart() {
  const records = loadRecords();
  const recordsByDate = Object.fromEntries(records.map((r) => [r.date, r]));
  const dates = getLast7Dates();

  const hasAnyData = dates.some((d) => recordsByDate[d]);
  chartSvg.innerHTML = "";

  if (!hasAnyData) {
    chartEmpty.hidden = false;
    chartHint.hidden = true;
    return;
  }
  chartEmpty.hidden = true;
  chartHint.hidden = false;

  const left = 40;
  const right = 12;
  const top = 16;
  const bottom = 30;
  const width = 320;
  const height = 200;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const xForIndex = (i) => left + (innerWidth * i) / (dates.length - 1);
  const yForMood = (mood) => top + (innerHeight * (5 - mood)) / 4;

  // 縦軸:数字の代わりに顔を表示するための目盛り線
  for (let mood = 1; mood <= 5; mood++) {
    const y = yForMood(mood);
    chartSvg.appendChild(
      svgEl("line", {
        x1: left,
        y1: y,
        x2: width - right,
        y2: y,
        stroke: "var(--color-surface-2)",
        "stroke-width": 1,
      })
    );
    const faceLabel = svgEl("text", {
      x: left - 12,
      y: y + 5,
      "text-anchor": "middle",
      "font-size": 13,
    });
    faceLabel.textContent = MOOD_EMOJI[mood];
    chartSvg.appendChild(faceLabel);
  }

  // 横軸:日付ラベル
  dates.forEach((dateStr, i) => {
    const label = svgEl("text", {
      x: xForIndex(i),
      y: height - 8,
      "text-anchor": "middle",
      "font-size": 9,
      fill: "var(--color-brown)",
    });
    label.textContent = formatShortDate(dateStr);
    chartSvg.appendChild(label);
  });

  // 折れ線(記録がある日同士だけをつなぐ)
  let pathData = "";
  let drawing = false;
  dates.forEach((dateStr, i) => {
    const record = recordsByDate[dateStr];
    if (!record) {
      drawing = false;
      return;
    }
    const x = xForIndex(i);
    const y = yForMood(record.mood);
    pathData += `${drawing ? "L" : "M"}${x},${y} `;
    drawing = true;
  });
  if (pathData) {
    chartSvg.appendChild(
      svgEl("path", {
        d: pathData.trim(),
        fill: "none",
        stroke: "var(--color-olive-dark)",
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      })
    );
  }

  // データ点(タップで詳細を表示)
  dates.forEach((dateStr, i) => {
    const record = recordsByDate[dateStr];
    if (!record) return;
    const x = xForIndex(i);
    const y = yForMood(record.mood);

    const circle = svgEl("circle", {
      cx: x,
      cy: y,
      r: 7,
      fill: "var(--color-olive)",
      stroke: "var(--color-bg)",
      "stroke-width": 2,
      class: "chart-point",
    });
    circle.addEventListener("click", () => showDetailModal(record));
    chartSvg.appendChild(circle);
  });
}

function showDetailModal(record) {
  modalContent.innerHTML = "";

  const dateP = document.createElement("p");
  dateP.className = "modal-date";
  dateP.textContent = formatDateLabel(record.date);
  modalContent.appendChild(dateP);

  const moodP = document.createElement("p");
  moodP.className = "modal-mood";
  moodP.textContent = MOOD_EMOJI[record.mood] || "";
  modalContent.appendChild(moodP);

  const tasksP = document.createElement("p");
  tasksP.className = "modal-tasks";
  tasksP.textContent = record.tasks.length ? record.tasks.join("・") : "できたこと:なし";
  modalContent.appendChild(tasksP);

  if (record.comment) {
    const commentP = document.createElement("p");
    commentP.className = "modal-comment";
    commentP.textContent = record.comment;
    modalContent.appendChild(commentP);
  }

  detailModal.hidden = false;
}

modalCloseBtn.addEventListener("click", () => {
  detailModal.hidden = true;
});

detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) {
    detailModal.hidden = true;
  }
});

renderChart();
