// ============================================================
// KLARITY — Theme (dark / light) toggle
// ============================================================
(function () {
  const STORAGE_KEY = 'klarity-theme';
  const DEFAULT_THEME = 'light';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update every toggle button on the page
    document.querySelectorAll('[id^="themeToggle"], [data-theme-toggle]').forEach(function (btn) {
      var icon = btn.querySelector('i') || document.getElementById('themeIcon');
      if (!icon) icon = btn.querySelector('[id^="themeIcon"]');
      if (!icon) return;
      if (theme === 'dark') {
        icon.classList.remove('bi-moon-stars-fill');
        icon.classList.add('bi-sun-fill');
      } else {
        icon.classList.remove('bi-sun-fill');
        icon.classList.add('bi-moon-stars-fill');
      }
    });
  }

  // Apply saved theme immediately (before paint)
  applyTheme(getTheme());

  // Expose toggle function globally
  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  // Wire up buttons after DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', window.toggleTheme);
    }
    // Also wire any element with data-theme-toggle attribute
    document.querySelectorAll('[data-theme-toggle]').forEach(function (el) {
      el.addEventListener('click', window.toggleTheme);
    });
    // Re-apply to refresh icons after DOM is ready
    applyTheme(getTheme());
  });
})();
