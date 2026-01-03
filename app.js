const STORAGE_KEY = "plannerData";
const QUADRANT_ORDER = ["Q1", "Q2", "Q3", "Q4"];
const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  data: loadData(),
  currentDate: new Date(),
  notificationTimers: [],
};

const elements = {
  currentDate: document.getElementById("current-date"),
  prevDay: document.getElementById("prev-day"),
  nextDay: document.getElementById("next-day"),
  dayStart: document.getElementById("day-start"),
  taskTitle: document.getElementById("task-title"),
  taskQuadrant: document.getElementById("task-quadrant"),
  taskDuration: document.getElementById("task-duration"),
  addTask: document.getElementById("add-task"),
  taskList: document.getElementById("task-list"),
  templateSelect: document.getElementById("template-select"),
  applyTemplate: document.getElementById("apply-template"),
  saveTemplate: document.getElementById("save-template"),
  deleteTemplate: document.getElementById("delete-template"),
  weekView: document.getElementById("week-view"),
  monthView: document.getElementById("month-view"),
  yearView: document.getElementById("year-view"),
  notifyToggle: document.getElementById("notify-toggle"),
  tabButtons: document.querySelectorAll(".tab"),
};

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { days: {}, templates: {} };
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { days: {}, templates: {} };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayData(dateKey) {
  if (!state.data.days[dateKey]) {
    state.data.days[dateKey] = {
      startTime: "08:00",
      tasks: [],
    };
  }
  return state.data.days[dateKey];
}

function parseTimeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = Math.floor(value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getSortedTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const quadrantDiff = QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant);
    if (quadrantDiff !== 0) {
      return quadrantDiff;
    }
    return a.createdAt - b.createdAt;
  });
}

function buildSchedule(tasks, startTime) {
  let current = parseTimeToMinutes(startTime);
  return getSortedTasks(tasks).map((task) => {
    const start = current;
    const end = current + task.duration;
    current = end;
    return { ...task, start, end };
  });
}

function renderDay() {
  const dateKey = formatDate(state.currentDate);
  elements.currentDate.value = dateKey;
  const day = getDayData(dateKey);
  elements.dayStart.value = day.startTime;

  const schedule = buildSchedule(day.tasks, day.startTime);
  elements.taskList.innerHTML = "";

  if (schedule.length === 0) {
    elements.taskList.innerHTML = "<p class=\"task-meta\">Задач нет. Добавьте первую.</p>";
    return;
  }

  const template = document.getElementById("task-item-template");
  schedule.forEach((task) => {
    const clone = template.content.cloneNode(true);
    const item = clone.querySelector(".task-item");
    const title = clone.querySelector(".task-title");
    const meta = clone.querySelector(".task-meta");
    const toggleDone = clone.querySelector(".toggle-done");
    const moveTomorrow = clone.querySelector(".move-tomorrow");
    const deleteTask = clone.querySelector(".delete-task");

    title.textContent = task.title;
    meta.textContent = `${task.quadrant} · ${minutesToTime(task.start)}–${minutesToTime(task.end)} · ${task.duration} мин`;
    if (task.done) {
      item.style.opacity = "0.6";
      toggleDone.textContent = "Вернуть";
    }

    toggleDone.addEventListener("click", () => toggleTaskDone(dateKey, task.id));
    moveTomorrow.addEventListener("click", () => moveTaskTomorrow(dateKey, task.id));
    deleteTask.addEventListener("click", () => removeTask(dateKey, task.id));

    elements.taskList.appendChild(clone);
  });
}

function renderTemplates() {
  const select = elements.templateSelect;
  select.innerHTML = "";
  const templateNames = Object.keys(state.data.templates);
  const defaultOption = document.createElement("option");
  defaultOption.textContent = "Выбрать шаблон";
  defaultOption.value = "";
  select.appendChild(defaultOption);

  templateNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
}

function renderWeek() {
  const start = new Date(state.currentDate);
  const dayIndex = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayIndex);
  elements.weekView.innerHTML = "";

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start.getTime() + i * DAY_MS);
    const key = formatDate(day);
    const dayData = state.data.days[key];
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.innerHTML = `<strong>${day.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric" })}</strong>`;
    if (dayData) {
      const total = dayData.tasks.length;
      const done = dayData.tasks.filter((task) => task.done).length;
      cell.innerHTML += `${done}/${total} выполнено`;
    } else {
      cell.innerHTML += "Нет задач";
    }
    elements.weekView.appendChild(cell);
  }
}

function renderMonth() {
  const date = new Date(state.currentDate);
  date.setDate(1);
  const startDay = (date.getDay() + 6) % 7;
  elements.monthView.innerHTML = "";

  for (let i = 0; i < startDay; i += 1) {
    const empty = document.createElement("div");
    empty.className = "day-cell";
    elements.monthView.appendChild(empty);
  }

  while (date.getMonth() === state.currentDate.getMonth()) {
    const key = formatDate(date);
    const dayData = state.data.days[key];
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.innerHTML = `<strong>${date.getDate()}</strong>`;
    if (dayData) {
      cell.innerHTML += `${dayData.tasks.length} задач`;
    }
    elements.monthView.appendChild(cell);
    date.setDate(date.getDate() + 1);
  }
}

function renderYear() {
  elements.yearView.innerHTML = "";
  const year = state.currentDate.getFullYear();
  for (let month = 0; month < 12; month += 1) {
    const first = new Date(year, month, 1);
    const keyPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const tasksCount = Object.keys(state.data.days)
      .filter((key) => key.startsWith(keyPrefix))
      .reduce((total, key) => total + state.data.days[key].tasks.length, 0);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.innerHTML = `<strong>${first.toLocaleDateString("ru-RU", { month: "short" })}</strong>`;
    cell.innerHTML += `${tasksCount} задач`;
    elements.yearView.appendChild(cell);
  }
}

function renderAll() {
  renderDay();
  renderTemplates();
  renderWeek();
  renderMonth();
  renderYear();
  scheduleNotifications();
}

function addTask() {
  const title = elements.taskTitle.value.trim();
  const duration = Number(elements.taskDuration.value);
  if (!title || Number.isNaN(duration) || duration <= 0) {
    return;
  }

  const dateKey = formatDate(state.currentDate);
  const day = getDayData(dateKey);
  day.tasks.push({
    id: crypto.randomUUID(),
    title,
    quadrant: elements.taskQuadrant.value,
    duration,
    done: false,
    createdAt: Date.now(),
  });

  elements.taskTitle.value = "";
  saveData();
  renderAll();
}

function toggleTaskDone(dateKey, taskId) {
  const day = getDayData(dateKey);
  const task = day.tasks.find((item) => item.id === taskId);
  if (task) {
    task.done = !task.done;
    saveData();
    renderAll();
  }
}

function removeTask(dateKey, taskId) {
  const day = getDayData(dateKey);
  day.tasks = day.tasks.filter((task) => task.id !== taskId);
  saveData();
  renderAll();
}

function moveTaskTomorrow(dateKey, taskId) {
  const day = getDayData(dateKey);
  const index = day.tasks.findIndex((task) => task.id === taskId);
  if (index === -1) return;
  const [task] = day.tasks.splice(index, 1);
  const tomorrow = new Date(state.currentDate.getTime() + DAY_MS);
  const tomorrowKey = formatDate(tomorrow);
  getDayData(tomorrowKey).tasks.push(task);
  saveData();
  renderAll();
}

function saveTemplate() {
  const name = prompt("Название шаблона:");
  if (!name) return;
  const dateKey = formatDate(state.currentDate);
  const day = getDayData(dateKey);
  state.data.templates[name] = {
    startTime: day.startTime,
    tasks: day.tasks.map((task) => ({
      ...task,
      id: crypto.randomUUID(),
    })),
  };
  saveData();
  renderTemplates();
}

function applyTemplate() {
  const name = elements.templateSelect.value;
  if (!name) return;
  const template = state.data.templates[name];
  const dateKey = formatDate(state.currentDate);
  state.data.days[dateKey] = {
    startTime: template.startTime,
    tasks: template.tasks.map((task) => ({
      ...task,
      id: crypto.randomUUID(),
      done: false,
      createdAt: Date.now(),
    })),
  };
  saveData();
  renderAll();
}

function deleteTemplate() {
  const name = elements.templateSelect.value;
  if (!name) return;
  delete state.data.templates[name];
  saveData();
  renderTemplates();
}

function updateStartTime() {
  const dateKey = formatDate(state.currentDate);
  const day = getDayData(dateKey);
  day.startTime = elements.dayStart.value;
  saveData();
  renderAll();
}

function changeDate(offset) {
  state.currentDate = new Date(state.currentDate.getTime() + offset * DAY_MS);
  renderAll();
}

function onDateInput() {
  state.currentDate = new Date(`${elements.currentDate.value}T00:00:00`);
  renderAll();
}

function setupTabs() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.tabButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
      document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
    });
  });
}

function clearNotificationTimers() {
  state.notificationTimers.forEach((timer) => clearTimeout(timer));
  state.notificationTimers = [];
}

function scheduleNotifications() {
  clearNotificationTimers();
  if (Notification.permission !== "granted") {
    return;
  }
  const dateKey = formatDate(state.currentDate);
  if (dateKey !== formatDate(new Date())) {
    return;
  }
  const day = getDayData(dateKey);
  const schedule = buildSchedule(day.tasks, day.startTime);
  const now = Date.now();

  schedule.forEach((task) => {
    if (task.done) return;
    const startTime = new Date();
    const [hours, minutes] = minutesToTime(task.start).split(":");
    startTime.setHours(Number(hours), Number(minutes), 0, 0);

    const fiveMinutesBefore = startTime.getTime() - 5 * 60 * 1000;
    [fiveMinutesBefore, startTime.getTime()].forEach((time, index) => {
      if (time <= now) return;
      const timer = setTimeout(() => {
        new Notification(index === 0 ? "Через 5 минут" : "Старт задачи", {
          body: `${task.title} (${task.quadrant})`,
        });
      }, time - now);
      state.notificationTimers.push(timer);
    });
  });
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Уведомления не поддерживаются этим браузером.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    scheduleNotifications();
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

// Event listeners
setupTabs();

const today = new Date();
state.currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
renderAll();

elements.prevDay.addEventListener("click", () => changeDate(-1));
elements.nextDay.addEventListener("click", () => changeDate(1));
elements.currentDate.addEventListener("change", onDateInput);
elements.dayStart.addEventListener("change", updateStartTime);
elements.addTask.addEventListener("click", addTask);

elements.taskTitle.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});

elements.applyTemplate.addEventListener("click", applyTemplate);
elements.saveTemplate.addEventListener("click", saveTemplate);
elements.deleteTemplate.addEventListener("click", deleteTemplate);

elements.notifyToggle.addEventListener("click", requestNotificationPermission);
