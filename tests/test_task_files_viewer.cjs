const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class FakeNode {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.attributes = new Map();
    this.className = "";
    this.parentElement = null;
    this._text = "";
    this.classList = { toggle() {} };
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get textContent() {
    return this._text + this.children.map(child => child.textContent || "").join("");
  }

  append(...nodes) {
    nodes.forEach(node => this.appendChild(node));
  }

  appendChild(node) {
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    this._text = "";
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  addEventListener() {}
  removeEventListener() {}
  closest() { return null; }
}

test("unavailable files show a clear message without fetching or offering retry", () => {
  const body = new FakeNode("body");
  const document = {
    body,
    activeElement: null,
    createElement: tag => new FakeNode(tag),
    createTextNode: text => {
      const node = new FakeNode("#text");
      node.textContent = text;
      return node;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  let fetches = 0;
  const window = {
    location: { href: "https://example.test/tasks.html?file=data/panel.npz#task-a" },
    history: { state: null, replaceState() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: callback => callback(),
    ARB_TASK_FILES: {
      tasks: {
        "task-a": {
          defaultFile: "instruction.md",
          files: [
            { path: "instruction.md", size: 5, language: "markdown", viewer: "text" },
            { path: "data/panel.npz", size: 42, language: "npz", viewer: "unavailable" },
          ],
        },
      },
    },
  };
  const context = {
    AbortController,
    Blob,
    TextDecoder,
    URL,
    console,
    document,
    fetch: async () => { fetches += 1; throw new Error("unexpected fetch"); },
    navigator: {},
    window,
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "task-files-viewer.js"), "utf8"),
    context,
  );

  const container = new FakeNode();
  window.ARBTaskFilesViewer.render({ slug: "task-a", container });

  assert.equal(fetches, 0);
  assert.match(container.textContent, /Viewer unavailable for data\/panel\.npz\./);
  assert.doesNotMatch(container.textContent, /Retry/);
  const buttons = [];
  const visit = node => {
    if (node.tag === "button") buttons.push(node);
    node.children.forEach(visit);
  };
  visit(container);
  assert.equal(buttons.find(button => button.textContent === "Copy").disabled, true);
  assert.equal(buttons.find(button => button.textContent === "Download").disabled, true);
});
