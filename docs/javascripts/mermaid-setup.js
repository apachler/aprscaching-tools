// SPDX-License-Identifier: MIT
/* global mermaid */
// Runs right after the site's own Mermaid (docs-hooks/site.py loads both, on a page with a diagram) and before
// Material draws the diagrams. Material initialises Mermaid with a stylesheet of its own colour variables, which
// the site maps to the app's diagram tokens. Mermaid's "neo" look writes fixed pastel colours inline on sequence
// participants, so the classic look is kept, and the participant colours are set again from the same variables.
(function () {
  if (typeof mermaid === "undefined" || typeof mermaid.initialize !== "function") return;
  var extra =
    "rect.actor{fill:var(--md-mermaid-sequence-actor-bg-color)!important;" +
    "stroke:var(--md-mermaid-sequence-actor-border-color)!important;filter:none!important}";
  var initialize = mermaid.initialize.bind(mermaid);
  mermaid.initialize = function (config) {
    config = Object.assign({}, config, { look: "classic" });
    config.themeCSS = (config.themeCSS || "") + extra;
    return initialize(config);
  };
})();
