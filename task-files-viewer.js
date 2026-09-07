(() => {
  "use strict";

  const MOBILE_QUERY = "(max-width: 640px)";
  const loadedFiles = new Map();
  let disposeCurrent = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function isSafePath(path) {
    if (typeof path !== "string" || !path || path.includes("..") || path.includes("\\") || path.includes("\0")) return false;
    if (path.startsWith("/") || path.endsWith("/")) return false;
    return path.split("/").every(part => part && part !== "." && part !== "..");
  }

  function isSafeSlug(slug) {
    return typeof slug === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(slug) && !slug.includes("..");
  }

  function sourceUrl(slug, path) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `task-files/${encodeURIComponent(slug)}/${encodedPath}`;
  }

  function formatBytes(size) {
    if (!Number.isFinite(size) || size < 0) return "Unknown size";
    if (size < 1024) return `${size} B`;
    const units = ["KB", "MB", "GB"];
    let value = size;
    let unit = "B";
    for (const nextUnit of units) {
      value /= 1024;
      unit = nextUnit;
      if (value < 1024) break;
    }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
  }

  function visibilityTarget(container) {
    return container.closest?.("#task-files-section") || container;
  }

  function replaceFileQuery(path) {
    const url = new URL(window.location.href);
    url.searchParams.set("file", path);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function makeTree(files) {
    const root = { type: "folder", name: "", path: "", children: new Map() };

    for (const file of files) {
      const parts = file.path.split("/");
      let folder = root;
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const path = parts.slice(0, index + 1).join("/");
        const existing = folder.children.get(part);

        if (existing && (isFile || existing.type === "file")) {
          throw new Error(`Conflicting task file path: ${file.path}`);
        }

        if (isFile) {
          folder.children.set(part, { type: "file", name: part, path, file });
          return;
        }

        if (!existing) {
          folder.children.set(part, { type: "folder", name: part, path, children: new Map() });
        }
        folder = folder.children.get(part);
      });
    }

    return root;
  }

  function sortedChildren(folder) {
    return [...folder.children.values()].sort((left, right) => {
      if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
    });
  }

  function decode(bytes) {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall through for browsers that expose the API but deny the request.
      }
    }

    const textarea = element("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    const focused = document.activeElement;
    document.body.appendChild(textarea);
    let copied = false;
    try {
      textarea.select();
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
      focused?.focus?.();
    }
    if (!copied) throw new Error("Copy command failed");
  }

  function render({ slug, container } = {}) {
    if (!container || typeof container.replaceChildren !== "function") {
      throw new TypeError("ARBTaskFilesViewer.render requires a container element");
    }

    if (disposeCurrent) disposeCurrent();
    container.replaceChildren();

    const bundle = window.ARB_TASK_FILES?.tasks?.[slug];
    const section = visibilityTarget(container);
    const manifestFiles = Array.isArray(bundle?.files) ? bundle.files : [];
    const files = manifestFiles.filter(file => file && isSafePath(file.path));
    const uniquePaths = new Set(files.map(file => file.path));

    if (!bundle || !isSafeSlug(slug) || files.length === 0 || files.length !== manifestFiles.length || uniquePaths.size !== files.length) {
      section.hidden = true;
      disposeCurrent = null;
      return () => {};
    }

    let tree;
    try {
      tree = makeTree(files);
    } catch (error) {
      console.warn(error);
      section.hidden = true;
      disposeCurrent = null;
      return () => {};
    }

    section.hidden = false;
    const filesByPath = new Map(files.map(file => [file.path, file]));
    const defaultPath = filesByPath.has("instruction.md")
      ? "instruction.md"
      : filesByPath.has(bundle.defaultFile)
        ? bundle.defaultFile
        : files[0].path;
    const requestedPath = new URL(window.location.href).searchParams.get("file");
    const initialPath = requestedPath && filesByPath.has(requestedPath) ? requestedPath : defaultPath;

    const root = element("div", "task-files-viewer");
    const live = element("p", "task-files-live");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");

    const shell = element("div", "task-files-shell");
    const disclosure = element("details", "task-files-tree-disclosure");
    const disclosureSummary = element("summary", "task-files-tree-summary", "Browse task files");
    const treeNav = element("nav", "task-files-tree");
    treeNav.setAttribute("aria-label", "Task files");
    const treeList = element("ul", "task-file-children");
    treeNav.appendChild(treeList);
    disclosure.append(disclosureSummary, treeNav);

    const panel = element("section", "task-file-panel");
    panel.setAttribute("aria-label", "Source file");
    panel.tabIndex = -1;
    const header = element("header", "task-file-header");
    const identity = element("div", "task-file-identity");
    const pathLabel = element("code", "task-file-path");
    const metadata = element("span", "task-file-meta");
    identity.append(pathLabel, metadata);

    const actions = element("div", "task-file-actions");
    const copyButton = element("button", "task-file-copy", "Copy");
    copyButton.type = "button";
    const downloadButton = element("button", "task-file-download", "Download");
    downloadButton.type = "button";
    const expandButton = element("button", "task-file-expand", "Expand");
    expandButton.type = "button";
    expandButton.setAttribute("aria-pressed", "false");
    const sourceLink = element("a", "task-file-source", "View source");
    sourceLink.target = "_blank";
    sourceLink.rel = "noreferrer";
    actions.append(copyButton, downloadButton, expandButton, sourceLink);
    header.append(identity, actions);

    const content = element("div", "task-file-content");
    panel.append(header, content);
    shell.append(disclosure, panel);
    root.append(live, shell);
    container.appendChild(root);

    const fileButtons = new Map();
    const folderButtons = new Map();
    const mobile = window.matchMedia(MOBILE_QUERY);
    disclosure.open = !mobile.matches;

    let selectedPath = null;
    let selectedContent = null;
    let controller = null;
    let requestNumber = 0;
    let disposed = false;
    let expanded = false;
    let inertedBackground = [];

    function setBackgroundInert(inert) {
      if (!inert) {
        inertedBackground.forEach(node => node.removeAttribute("inert"));
        inertedBackground = [];
        return;
      }

      let branch = root;
      while (branch.parentElement && branch !== document.body) {
        const parent = branch.parentElement;
        for (const sibling of parent.children) {
          if (sibling !== branch && !sibling.hasAttribute("inert")) {
            sibling.setAttribute("inert", "");
            inertedBackground.push(sibling);
          }
        }
        branch = parent;
      }
    }

    function setExpanded(nextExpanded, restoreFocus = false) {
      expanded = nextExpanded;
      root.classList.toggle("is-expanded", expanded);
      document.body.classList.toggle("task-files-viewer-expanded", expanded);
      expandButton.textContent = expanded ? "Close" : "Expand";
      expandButton.setAttribute("aria-pressed", String(expanded));
      if (expanded) {
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-label", "Expanded task file viewer");
        setBackgroundInert(true);
      } else {
        root.removeAttribute("role");
        root.removeAttribute("aria-modal");
        root.removeAttribute("aria-label");
        setBackgroundInert(false);
      }
      if (restoreFocus) expandButton.focus();
    }

    function announce(message) {
      live.textContent = "";
      window.requestAnimationFrame(() => {
        if (!disposed) live.textContent = message;
      });
    }

    function showStatus(message, retry = false) {
      const status = element("div", "task-files-status");
      status.setAttribute("role", retry ? "alert" : "status");
      status.appendChild(element("p", "", message));
      if (retry) {
        const retryButton = element("button", "task-files-retry", "Retry");
        retryButton.type = "button";
        retryButton.addEventListener("click", () => loadFile(selectedPath));
        status.appendChild(retryButton);
      }
      content.replaceChildren(status);
    }

    function renderSource(text) {
      const pre = element("pre", "task-file-code");
      pre.tabIndex = 0;
      pre.setAttribute("aria-label", `${selectedPath} source`);
      const code = document.createElement("code");
      const lines = text.split("\n");
      lines.forEach((sourceLine, index) => {
        const row = element("span", "task-file-line");
        const lineNumber = element("span", "task-file-line-number", String(index + 1));
        lineNumber.setAttribute("aria-hidden", "true");
        const lineContent = element("span", "task-file-line-content", sourceLine);
        row.append(lineNumber, lineContent);
        code.appendChild(row);
      });
      pre.appendChild(code);
      content.replaceChildren(pre);
    }

    function expandAncestors(path) {
      const parts = path.split("/");
      for (let index = 1; index < parts.length; index += 1) {
        const folderPath = parts.slice(0, index).join("/");
        const folder = folderButtons.get(folderPath);
        if (folder) folder.setOpen(true);
      }
    }

    async function loadFile(path) {
      if (!filesByPath.has(path) || !isSafePath(path)) path = defaultPath;
      const file = filesByPath.get(path);
      selectedPath = path;
      selectedContent = null;
      requestNumber += 1;
      const thisRequest = requestNumber;
      controller?.abort();
      controller = null;

      fileButtons.forEach((button, buttonPath) => {
        if (buttonPath === path) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
      expandAncestors(path);
      pathLabel.textContent = path;
      metadata.textContent = `${file.language || "text"} · ${formatBytes(file.size)}`;
      const rawUrl = sourceUrl(slug, path);
      sourceLink.href = rawUrl;
      copyButton.disabled = true;
      downloadButton.disabled = true;
      replaceFileQuery(path);

      const cacheKey = `${slug}\0${path}`;
      const cached = loadedFiles.get(cacheKey);
      if (cached) {
        selectedContent = cached;
        renderSource(cached.text);
        copyButton.disabled = false;
        downloadButton.disabled = false;
        announce(`Selected ${path}`);
        return;
      }

      showStatus(`Loading ${path}…`);
      announce(`Selected ${path}. Loading source.`);
      controller = new AbortController();

      try {
        const response = await fetch(rawUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const bytes = await response.arrayBuffer();
        const loaded = { bytes, text: decode(bytes) };
        if (disposed || thisRequest !== requestNumber) return;
        loadedFiles.set(cacheKey, loaded);
        selectedContent = loaded;
        renderSource(loaded.text);
        copyButton.disabled = false;
        downloadButton.disabled = false;
        announce(`Selected ${path}. Source loaded.`);
      } catch (error) {
        if (error.name === "AbortError" || disposed || thisRequest !== requestNumber) return;
        showStatus(`Source unavailable for ${path}.`, true);
        announce(`Failed to load ${path}. Retry is available.`);
      } finally {
        if (thisRequest === requestNumber) controller = null;
      }
    }

    function addNodes(folder, list) {
      for (const node of sortedChildren(folder)) {
        const item = element("li", node.type === "folder" ? "task-file-folder" : "task-file-entry");
        if (node.type === "file") {
          const button = element("button", "task-file-button", node.name);
          button.type = "button";
          button.title = node.path;
          button.addEventListener("click", () => {
            loadFile(node.path);
            if (mobile.matches) {
              disclosure.open = false;
              panel.focus({ preventScroll: true });
            }
          });
          fileButtons.set(node.path, button);
          item.appendChild(button);
          list.appendChild(item);
          continue;
        }

        const button = element("button", "task-file-folder-toggle");
        button.type = "button";
        const folderName = element("span", "task-file-folder-name", node.name);
        button.appendChild(folderName);
        const children = element("ul", "task-file-children");
        const childrenId = `task-file-folder-${folderButtons.size + 1}`;
        children.id = childrenId;
        button.setAttribute("aria-controls", childrenId);
        const defaultOpen = node.path === "environment" || node.path === "tests";
        button.setOpen = open => {
          button.setAttribute("aria-expanded", String(open));
          children.hidden = !open;
        };
        button.setOpen(defaultOpen);
        button.addEventListener("click", () => button.setOpen(button.getAttribute("aria-expanded") !== "true"));
        folderButtons.set(node.path, button);
        addNodes(node, children);
        item.append(button, children);
        list.appendChild(item);
      }
    }

    addNodes(tree, treeList);

    function handleViewportChange(event) {
      if (!event.matches) disclosure.open = true;
    }

    function handleKeydown(event) {
      if (event.key === "Escape" && expanded) {
        event.preventDefault();
        setExpanded(false, true);
        return;
      }
      if (event.key !== "Tab" || !expanded) return;

      const focusable = [...root.querySelectorAll("a[href], button:not([disabled]), summary, [tabindex]:not([tabindex='-1'])")]
        .filter(node => node.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        expandButton.focus();
      } else if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    mobile.addEventListener?.("change", handleViewportChange);
    document.addEventListener("keydown", handleKeydown);
    expandButton.addEventListener("click", () => setExpanded(!expanded));
    copyButton.addEventListener("click", async () => {
      if (!selectedContent) return;
      try {
        await copyText(selectedContent.text);
        announce(`Copied ${selectedPath}.`);
      } catch {
        announce(`Could not copy ${selectedPath}.`);
      }
    });
    downloadButton.addEventListener("click", () => {
      if (!selectedContent) return;
      const downloadUrl = URL.createObjectURL(new Blob([selectedContent.bytes], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = selectedPath.split("/").pop();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      announce(`Downloaded ${selectedPath}.`);
    });

    loadFile(initialPath);

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      requestNumber += 1;
      controller?.abort();
      mobile.removeEventListener?.("change", handleViewportChange);
      document.removeEventListener("keydown", handleKeydown);
      setExpanded(false);
      container.replaceChildren();
      section.hidden = true;
      if (disposeCurrent === dispose) disposeCurrent = null;
    };
    disposeCurrent = dispose;
    return dispose;
  }

  function clear() {
    if (disposeCurrent) disposeCurrent();
  }

  window.ARBTaskFilesViewer = { render, clear };
})();
