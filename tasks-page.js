(() => {
  const catalog = window.ARB_TASK_CATALOG || [];
  const tasks = window.ARB_DATA?.tasks || [];
  const bySlug = new Map(catalog.map(entry => [entry.slug, entry]));
  const taskIndexByName = new Map(tasks.map((task, index) => [task.name, index]));
  const categoryIndex = new Map(CATEGORIES.map((category, index) => [category.name, index]));
  const categoryByTask = new Map(CATEGORIES.flatMap(category => category.specimens.map(name => [name, category.name])));
  const detailView = document.getElementById("detail-view");
  const missingView = document.getElementById("task-missing");
  const taskFilesSection = document.getElementById("task-files-section");
  const taskFilesContainer = document.getElementById("task-files-viewer");
  let disposeTaskFiles = null;

  if (!location.hash.slice(1)) {
    location.replace("blog.html#examples");
    return;
  }

  catalog.forEach(entry => {
    if (!taskIndexByName.has(entry.blogName)) {
      console.warn(`Task catalog entry is missing from site data: ${entry.blogName}`);
    }
    const specimenCategory = categoryByTask.get(entry.blogName);
    if (specimenCategory !== entry.category) {
      console.warn(`Task category differs for ${entry.blogName}: catalog is ${entry.category}, task areas are ${specimenCategory || "missing"}`);
    }
  });

  function parseSlug() {
    const raw = location.hash.slice(1);
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  function show(view) {
    detailView.hidden = view !== detailView;
    missingView.hidden = view !== missingView;
  }

  function appendMeta(list, value, options = {}) {
    if (value == null || value === "") return;
    const item = document.createElement("li");
    if (options.className) item.className = options.className;
    if (options.color) item.style.setProperty("--category-color", options.color);
    item.textContent = value;
    list.appendChild(item);
  }

  function clearTaskFiles() {
    disposeTaskFiles?.();
    disposeTaskFiles = null;
    taskFilesSection.hidden = true;
    taskFilesContainer.replaceChildren();
  }

  function renderTaskFiles(slug) {
    clearTaskFiles();
    const hasBundle = Boolean(window.ARB_TASK_FILES?.tasks?.[slug]);
    if (!hasBundle || !window.ARBTaskFilesViewer?.render) return;
    taskFilesSection.hidden = false;
    const dispose = window.ARBTaskFilesViewer.render({ slug, container: taskFilesContainer });
    if (typeof dispose === "function") disposeTaskFiles = dispose;
  }

  function renderDetail(slug) {
    const entry = bySlug.get(slug);
    if (!entry) {
      clearTaskFiles();
      show(missingView);
      document.getElementById("missing-slug").textContent = slug;
      document.title = "Task not found · AutoResearchBench";
      return;
    }

    const taskIndex = taskIndexByName.get(entry.blogName);
    const task = taskIndex == null ? null : tasks[taskIndex];
    const color = CATEGORIES[categoryIndex.get(entry.category)]?.color || "var(--ink)";
    show(detailView);
    document.getElementById("detail-slug").textContent = entry.slug;
    document.getElementById("detail-title").textContent = entry.title;

    const meta = document.getElementById("detail-meta");
    meta.replaceChildren();
    appendMeta(meta, entry.category, { className: "category-chip", color });
    appendMeta(meta, entry.subcategory);
    appendMeta(meta, task?.compute);
    if (entry.github) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = entry.github;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "View task on GitHub ↗";
      item.appendChild(link);
      meta.appendChild(item);
    }

    const paragraphs = Array.isArray(entry.paragraphs) ? entry.paragraphs : [];
    document.getElementById("detail-readme").replaceChildren(...paragraphs.map(text => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      return paragraph;
    }));

    const taskView = document.getElementById("task-view");
    const hasPoints = task?.models?.some(model => model.points?.length);
    if (task && hasPoints) {
      hiddenModels.clear();
      renderTask(taskIndex);
    } else {
      taskView.innerHTML = '<p class="plot-note">No runs recorded for this task yet.</p>';
    }
    renderTaskFiles(slug);
    document.title = `${entry.title} · AutoResearchBench`;
  }

  function route() {
    const slug = parseSlug();
    if (!slug) {
      location.replace("blog.html#examples");
      return;
    }
    renderDetail(slug);
    window.scrollTo(0, 0);
    const focusTarget = bySlug.has(slug)
      ? document.getElementById("detail-title")
      : missingView.querySelector("h1");
    focusTarget?.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", route);
  route();
})();
