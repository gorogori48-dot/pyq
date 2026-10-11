const searchInput = document.getElementById("search");
const subjectSelect = document.getElementById("subject");
const yearSelect = document.getElementById("year");
const questionList = document.getElementById("questions");
const statusText = document.getElementById("status");
const loadMoreButton = document.getElementById("load-more");

let allQuestions = [];
let visibleQuestions = [];
let visibleCount = 0;

const PAGE_SIZE = 20;
const expandedAnswers = new Set();

const subjectNames = {
  mathii: "Math II",
  ds: "Discrete Structures",
  oops: "Object-Oriented Programming",
  "stat-i": "Statistics I",
  microprocessor: "Microprocessor"
};

/* Turn any <i data-lucide="..."> placeholders into Lucide SVG icons. */
function refreshIcons() {
  window.lucide?.createIcons();
}

function createIcon(name, className = "") {
  const icon = document.createElement("i");
  icon.dataset.lucide = name;
  if (className) icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function typeset(element) {
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([element]).catch(console.error);
  }
}

function getSubject(file) {
  const parts = file.split("/");
  const index = parts.findIndex(part => part.toLowerCase() === "pyqs");
  const folder = index > 0 ? parts[index - 1] : parts.at(-2) || "Other";
  return subjectNames[folder.toLowerCase()] || folder;
}

function getYear(file) {
  const match = file.match(/(\d{4})(?:-new)?\.json$/i);
  return match ? match[1] : "Unknown";
}

async function loadQuestions() {
  try {
    const response = await fetch("/api/files");
    if (!response.ok) throw new Error("Could not load JSON file list");

    const files = await response.json();

    const results = await Promise.all(files.map(async file => {
      try {
        const res = await fetch("/api/questions?file=" + encodeURIComponent(file));
        if (!res.ok) throw new Error("Could not load " + file);

        const questions = await res.json();

        return questions
          .filter(item => item && typeof item.question === "string")
          .map((item, index) => ({
            ...item,
            id: file + "::" + index,
            file,
            subject: getSubject(file),
            year: getYear(file),
            number: index + 1
          }));
      } catch (error) {
        console.error(error);
        return [];
      }
    }));

    allQuestions = results.flat();

    if (files.length === 0) {
      statusText.textContent = "No JSON files found. Check the data folder.";
      return;
    }

    populateFilters();
    applyFilters();
  } catch (error) {
    console.error(error);
    statusText.textContent =
      "Could not load questions. Check your server and data folder.";
  }
}

function populateFilters() {
  const subjects = [...new Set(allQuestions.map(q => q.subject))].sort();
  const years = [...new Set(allQuestions.map(q => q.year))]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  subjects.forEach(subject => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    subjectSelect.append(option);
  });

  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.append(option);
  });
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const subject = subjectSelect.value;
  const year = yearSelect.value;

  visibleQuestions = allQuestions.filter(q => {
    const matchesSearch =
      !query ||
      q.question.toLowerCase().includes(query) ||
      q.subject.toLowerCase().includes(query) ||
      q.year.includes(query);

    return matchesSearch &&
      (!subject || q.subject === subject) &&
      (!year || q.year === year);
  });

  visibleCount = 0;
  renderQuestions();
}

function renderQuestions() {
  const fragment = document.createDocumentFragment();
  const batch = visibleQuestions.slice(visibleCount, visibleCount + PAGE_SIZE);

  batch.forEach(q => fragment.append(createQuestionCard(q)));

  if (visibleCount === 0) {
    questionList.replaceChildren();
  }

  questionList.append(fragment);
  visibleCount += batch.length;

  statusText.textContent =
    `${visibleQuestions.length} question${visibleQuestions.length === 1 ? "" : "s"} found`;

  loadMoreButton.hidden = visibleCount >= visibleQuestions.length;

  if (visibleQuestions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const heading = document.createElement("h3");
    heading.textContent = "No questions found";

    const message = document.createElement("p");
    message.textContent = "Try a different search, subject, or year.";

    empty.append(createIcon("search-x"), heading, message);
    questionList.replaceChildren(empty);
  }

  refreshIcons();
  typeset(questionList);
}

function fillAnswer(answer, q) {
  // Answers contain trusted HTML from your own JSON files.
  answer.innerHTML = q.answer || "<p>No answer available.</p>";
  typeset(answer);
}

function createQuestionCard(q) {
  const card = document.createElement("article");
  card.className = "question-card";

  const meta = document.createElement("div");
  meta.className = "question-meta";

  const year = document.createElement("span");
  year.className = "year-tag";
  year.textContent = q.year;

  const subject = document.createElement("span");
  subject.textContent = q.subject;

  meta.append(year, subject);

  const title = document.createElement("div");
  title.className = "question-title";
  // Questions may contain LaTeX and existing HTML entities.
  title.innerHTML = q.question;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "answer-toggle";

  const answer = document.createElement("div");
  answer.className = "answer";
  answer.id = "answer-" + q.id.replace(/[^a-z0-9_-]/gi, "-");
  answer.hidden = !expandedAnswers.has(q.id);

  // Restore answers that were open before a filter or re-render.
  if (!answer.hidden) fillAnswer(answer, q);

  toggle.setAttribute("aria-controls", answer.id);

  const label = document.createElement("span");
  label.className = "toggle-label";

  function updateToggle() {
    const isOpen = !answer.hidden;
    label.textContent = isOpen ? "Hide answer" : "Show answer";
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  toggle.addEventListener("click", () => {
    answer.hidden = !answer.hidden;

    if (answer.hidden) {
      expandedAnswers.delete(q.id);
    } else {
      expandedAnswers.add(q.id);
      fillAnswer(answer, q);
    }

    updateToggle();
  });

  updateToggle();
  toggle.append(label, createIcon("chevron-down", "chev"));

  card.append(meta, title, toggle, answer);
  return card;
}

searchInput.addEventListener("input", applyFilters);
subjectSelect.addEventListener("change", applyFilters);
yearSelect.addEventListener("change", applyFilters);
loadMoreButton.addEventListener("click", renderQuestions);

function setAllAnswers(show) {
  visibleQuestions.slice(0, visibleCount).forEach(q => {
    if (show) expandedAnswers.add(q.id);
    else expandedAnswers.delete(q.id);
  });

  renderVisibleAnswers(show);
}

function renderVisibleAnswers(show) {
  const cards = questionList.querySelectorAll(".question-card");

  cards.forEach((card, index) => {
    const q = visibleQuestions[index];
    if (!q) return;

    const toggle = card.querySelector(".answer-toggle");
    const answer = card.querySelector(".answer");

    answer.hidden = !show;
    if (show) fillAnswer(answer, q);

    toggle.querySelector(".toggle-label").textContent =
      show ? "Hide answer" : "Show answer";
    toggle.setAttribute("aria-expanded", String(show));
  });
}

document.getElementById("show-all").addEventListener("click", () => setAllAnswers(true));
document.getElementById("hide-all").addEventListener("click", () => setAllAnswers(false));

/* ---------- Theme ---------- */
const themeToggle = document.getElementById("theme-toggle");
const themeLabel = document.getElementById("theme-label");
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const isDark = theme === "dark";

  themeLabel.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light theme" : "Switch to dark theme"
  );
  if (themeMeta) themeMeta.content = isDark ? "#0E0F11" : "#F6F6F5";
}

let savedTheme = "light";

try {
  savedTheme = localStorage.getItem("question-bank-theme") || "light";
} catch (error) {
  console.warn("Theme preference could not be loaded.");
}

applyTheme(savedTheme === "dark" ? "dark" : "light");

themeToggle.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);

  try {
    localStorage.setItem("question-bank-theme", nextTheme);
  } catch (error) {
    console.warn("Theme preference could not be saved.");
  }
});

refreshIcons();
loadQuestions();