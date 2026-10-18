// Sets <html data-shortcuts> from the saved choice before the first paint, so the nav's number hints
// never flash. A classic file (the CSP allows no inline code) that blocks rendering: keep it tiny.
// shortcuts-state.test.ts holds it to the same answer as loadShortcuts().
(function () {
  var state = "on";
  try {
    if (localStorage.getItem("keyboard-shortcuts") === "off") state = "off";
  } catch {
    // Blocked site data: shortcuts stay on.
  }
  document.documentElement.dataset.shortcuts = state;
})();
