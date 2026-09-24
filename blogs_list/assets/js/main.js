(function () {
  "use strict";

  var STORAGE_KEY = "eap-theme";

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function currentTheme() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (stored) return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function setTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    applyTheme(theme);
    updateToggleIcon(theme);
  }

  function updateToggleIcon(theme) {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    btn.textContent = theme === "dark" ? "☀️" : "\u{1F319}";
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var theme = currentTheme();
    updateToggleIcon(theme);

    var btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        setTheme(next);
      });
    }

    var bar = document.querySelector("[data-progress-bar]");
    if (bar) {
      var onScroll = function () {
        var doc = document.documentElement;
        var scrollTop = window.scrollY || doc.scrollTop;
        var scrollable = (doc.scrollHeight - doc.clientHeight) || 1;
        var pct = Math.min(100, Math.max(0, (scrollTop / scrollable) * 100));
        bar.style.width = pct + "%";
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      onScroll();
    }
  });
})();
