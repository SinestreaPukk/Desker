/**
 * Desker chat widget loader.
 *
 * Usage on any third-party page:
 *
 *   <script
 *     src="https://your-desker-host/embed.js"
 *     data-desker-agent="AGENT_ID"
 *     defer
 *   ></script>
 *
 * Optional attributes:
 *   data-desker-origin  Where the app is hosted. Defaults to this script's origin.
 *   data-desker-label   Launcher tooltip / accessible name. Default "Chat with us".
 *   data-desker-side    "right" (default) or "left".
 *   data-desker-color   CSS colour for the launcher. Default #1800AD.
 *
 * Design constraints, because this runs inside somebody else's page:
 *   - No globals beyond one namespaced key, no library, no CSS file.
 *   - Every style is set inline on our own elements, so the host page's
 *     stylesheet cannot break us and we cannot leak styles into it.
 *   - The chat itself lives in an iframe, so the host page's scripts cannot
 *     read the conversation and our scripts cannot touch the host's DOM.
 *   - Fully keyboard operable, labelled for screen readers, and it never
 *     traps focus or hijacks the host page's accessibility tree.
 */
(function () {
  "use strict";

  if (window.__deskerWidgetLoaded) return;
  window.__deskerWidgetLoaded = true;

  var script = document.currentScript;
  if (!script) {
    var candidates = document.querySelectorAll(
      "script[data-desker-agent], script[data-roster-agent]"
    );
    script = candidates[candidates.length - 1];
  }
  if (!script) return;

  // `data-roster-*` is the pre-rename spelling. Snippets already pasted into a
  // customer's site keep working; new ones use `data-desker-*`.
  function attr(name) {
    return (
      script.getAttribute("data-desker-" + name) ||
      script.getAttribute("data-roster-" + name)
    );
  }

  var agentId = attr("agent");
  if (!agentId) {
    console.error("[desker] data-desker-agent is required on the embed script tag.");
    return;
  }

  var origin = attr("origin") || new URL(script.src, window.location.href).origin;
  var label = attr("label") || "Chat with us";
  var side = attr("side") === "left" ? "left" : "right";
  var color = attr("color") || "#1800AD";

  var open = false;
  var iframe = null;

  // --- launcher ------------------------------------------------------------

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", label);
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-haspopup", "dialog");
  setStyle(launcher, {
    position: "fixed",
    bottom: "20px",
    zIndex: "2147483000",
    width: "56px",
    height: "56px",
    borderRadius: "9999px",
    border: "none",
    background: color,
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 6px 24px rgba(0,0,0,.24)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    transition: "transform .15s ease, box-shadow .15s ease",
  });
  launcher.style[side] = "20px";
  launcher.innerHTML = chatIcon();

  launcher.addEventListener("mouseenter", function () {
    launcher.style.transform = "scale(1.05)";
  });
  launcher.addEventListener("mouseleave", function () {
    launcher.style.transform = "scale(1)";
  });
  launcher.addEventListener("click", function () {
    setOpen(!open);
  });

  // --- panel ---------------------------------------------------------------

  var panel = document.createElement("div");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", label);
  panel.setAttribute("aria-modal", "false");
  setStyle(panel, {
    position: "fixed",
    zIndex: "2147483000",
    display: "none",
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 18px 48px rgba(0,0,0,.26)",
    border: "1px solid rgba(0,0,0,.10)",
  });

  function layout() {
    // Full-screen sheet on a phone, floating panel on anything larger.
    var narrow = window.innerWidth < 640;
    if (narrow) {
      setStyle(panel, {
        inset: "0",
        width: "100%",
        height: "100%",
        borderRadius: "0",
        border: "none",
      });
      panel.style.left = "0";
      panel.style.right = "0";
    } else {
      setStyle(panel, {
        inset: "auto",
        bottom: "88px",
        width: "400px",
        height: "min(640px, calc(100vh - 120px))",
        borderRadius: "16px",
        border: "1px solid rgba(0,0,0,.10)",
      });
      panel.style[side] = "20px";
      panel.style[side === "right" ? "left" : "right"] = "auto";
    }
    launcher.style.display = narrow && open ? "none" : "flex";
  }

  function setOpen(next) {
    open = next;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.innerHTML = open ? closeIcon() : chatIcon();

    if (open && !iframe) {
      iframe = document.createElement("iframe");
      iframe.src = origin + "/embed/" + encodeURIComponent(agentId);
      iframe.title = label;
      setStyle(iframe, {
        width: "100%",
        height: "100%",
        border: "none",
        display: "block",
        colorScheme: "normal",
      });
      panel.appendChild(iframe);
    }

    panel.style.display = open ? "block" : "none";
    layout();

    if (open && iframe) {
      // Hand keyboard focus into the chat, but only once it can accept it.
      setTimeout(function () {
        try {
          iframe.focus();
        } catch {
          /* cross-origin focus can be refused; harmless */
        }
      }, 60);
    } else {
      launcher.focus();
    }
  }

  // Escape closes, matching every other dialog on the host page.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && open) setOpen(false);
  });

  // The chat's own close button lives inside the iframe.
  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    if (event.data && event.data.type === "desker:close") setOpen(false);
  });

  window.addEventListener("resize", layout);

  function mount() {
    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    layout();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  // --- helpers -------------------------------------------------------------

  function setStyle(element, styles) {
    for (var key in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, key)) {
        element.style[key] = styles[key];
      }
    }
  }

  function chatIcon() {
    return (
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      "</svg>"
    );
  }

  function closeIcon() {
    return (
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M18 6 6 18M6 6l12 12"/>' +
      "</svg>"
    );
  }
})();
