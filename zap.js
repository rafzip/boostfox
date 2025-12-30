(() => {
  const api = globalThis.browser || globalThis.chrome;

  if (globalThis.__boostfoxZap) {
    return;
  }

  const state = {
    enabled: false,
    hoverEl: null,
    styleEl: null,
  };

  function escapeIdent(value) {
    if (globalThis.CSS && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  }

  function buildSelector(element) {
    if (!element || element.nodeType !== 1) {
      return "";
    }

    if (element.id) {
      return `#${escapeIdent(element.id)}`;
    }

    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && node.tagName !== "HTML") {
      let part = node.tagName.toLowerCase();

      if (node.classList && node.classList.length) {
        part += "." + Array.from(node.classList).map(escapeIdent).join(".");
      }

      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === node.tagName,
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(node) + 1;
          part += `:nth-of-type(${index})`;
        }
      }

      parts.unshift(part);
      const selector = parts.join(" > ");
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch {
        // Ignore invalid selectors while building.
      }

      node = parent;
    }

    return parts.join(" > ");
  }

  function ensureStyle() {
    if (state.styleEl) {
      return;
    }
    const style = document.createElement("style");
    style.id = "boostfox-zap-style";
    style.textContent = `
      .boostfox-zap-hover {
        outline: 2px solid #facc15 !important;
        background-color: rgba(250, 204, 21, 0.25) !important;
        cursor: crosshair !important;
      }
    `;
    document.documentElement.appendChild(style);
    state.styleEl = style;
  }

  function clearHover() {
    if (state.hoverEl) {
      state.hoverEl.classList.remove("boostfox-zap-hover");
      state.hoverEl = null;
    }
  }

  function isZapTarget(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }
    const tag = element.tagName;
    return tag !== "HTML" && tag !== "BODY";
  }

  function onMouseOver(event) {
    if (!state.enabled) {
      return;
    }
    const target = event.target;
    if (!isZapTarget(target)) {
      clearHover();
      return;
    }
    if (state.hoverEl !== target) {
      clearHover();
      state.hoverEl = target;
      target.classList.add("boostfox-zap-hover");
    }
  }

  function onMouseOut(event) {
    if (!state.enabled) {
      return;
    }
    if (state.hoverEl && event.target === state.hoverEl) {
      clearHover();
    }
  }

  function onClick(event) {
    if (!state.enabled) {
      return;
    }
    const target = event.target;
    if (!isZapTarget(target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const selector = buildSelector(target);
    if (selector) {
      target.dataset.boostfoxZap = "1";
      target.style.setProperty("display", "none", "important");
      api.runtime.sendMessage({ type: "zap-add", selector, url: location.href });
    }
  }

  function enable() {
    if (state.enabled) {
      return;
    }
    state.enabled = true;
    ensureStyle();
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
  }

  function disable() {
    if (!state.enabled) {
      return;
    }
    state.enabled = false;
    clearHover();
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("click", onClick, true);
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }
    if (message.type === "zap-enable") {
      enable();
    } else if (message.type === "zap-disable") {
      disable();
    } else if (message.type === "zap-undo-applied") {
      const selector = message.selector;
      if (selector) {
        try {
          document.querySelectorAll(selector).forEach((node) => {
            if (node.dataset && node.dataset.boostfoxZap === "1") {
              node.style.removeProperty("display");
              delete node.dataset.boostfoxZap;
            }
          });
        } catch {
          // Ignore invalid selectors on undo.
        }
      }
    } else if (message.type === "zap-query") {
      sendResponse({ enabled: state.enabled });
    }
  });

  globalThis.__boostfoxZap = { enable, disable };
})();
