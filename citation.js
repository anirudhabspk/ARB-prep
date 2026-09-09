(() => {
  const button = document.getElementById("copy-citation");
  const code = document.getElementById("citation-bibtex");
  const status = document.getElementById("citation-status");
  if (!button || !code || !status) return;
  let feedbackTimer;
  button.addEventListener("click", async () => {
    clearTimeout(feedbackTimer);
    try {
      await navigator.clipboard.writeText(code.textContent.trim() + "\n");
      status.textContent = "Citation copied.";
      feedbackTimer = setTimeout(() => { status.textContent = ""; }, 2500);
    } catch {
      status.textContent = "Could not copy automatically. Select the citation or use Download.";
      code.parentElement.focus();
    }
  });
})();
