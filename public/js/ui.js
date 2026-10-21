// Visual behaviour only: modals, mobile menu and tabs.
// No data, no API calls, no storage, no form handling.

const FOCUSABLE = "input:not([disabled]), select, textarea, button:not([disabled]), a[href]";
let lastTrigger = null;

function openModal(modal, trigger) {
  lastTrigger = trigger;
  modal.classList.add("is-open");
  const first = modal.querySelector("input:not([readonly]), select, textarea") || modal.querySelector(FOCUSABLE);
  if (first) first.focus();
}

function closeModal(modal) {
  modal.classList.remove("is-open");
  if (lastTrigger) lastTrigger.focus();
  lastTrigger = null;
}

// 1. Modals: open, close button, backdrop click
document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-open-modal]");
  if (opener) {
    const modal = document.getElementById(opener.dataset.openModal);
    if (modal) openModal(modal, opener);
    return;
  }
  const closer = event.target.closest("[data-close-modal]");
  if (closer) {
    closeModal(closer.closest(".modal"));
    return;
  }
  if (event.target.classList.contains("modal")) closeModal(event.target);
});

// Escape closes; Tab stays inside the open modal
document.addEventListener("keydown", (event) => {
  const modal = document.querySelector(".modal.is-open");
  if (!modal) return;
  if (event.key === "Escape") {
    closeModal(modal);
  } else if (event.key === "Tab") {
    const items = modal.querySelectorAll(FOCUSABLE);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

// 2. Mobile menu
const menuToggle = document.querySelector(".menu-toggle");
const sidebar = document.getElementById("sidebar");
if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// 3. Tabs: only the active look changes
document.querySelectorAll(".tabs").forEach((group) => {
  group.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (!tab) return;
    group.querySelectorAll(".tab").forEach((item) => {
      item.classList.toggle("is-active", item === tab);
      item.setAttribute("aria-pressed", String(item === tab));
    });
  });
});
