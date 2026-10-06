// SPDX-License-Identifier: MIT
/* global register, tool */
// Block art (GIP): renders CP437/ANSI art as a block-cell panel, the "graphic" of Graphic Packet. /art <text>
// renders text (`\n` breaks a line); any tool may also push an image by emitting `render.blocks` on the bus, as
// { text } or as a full { cols, cells } grid, which is sanitised before it is shown.
import { parseBlocks, sanitizePanel } from "aprscaching/packages/tools/src/panel.ts";

const SAMPLE = [
  '  .-"""-.',
  " / .===. \\",
  " \\/ 6 6 \\/",
  " ( \\___/ )   APRScaching",
  "  \\_____/    de OE8APR",
].join("\n");

const showText = (text) => tool.setPanel({ title: "Block art", nodes: [parseBlocks(text)] });

register({
  commands: {
    art: (args) => {
      if (!args.trim()) {
        showText(SAMPLE);
        return ["Rendered the sample. /art <text> to render your own CP437/ANSI art."];
      }
      showText(args.replace(/\\n/g, "\n"));
      return ["Rendered."];
    },
  },
});

tool.subscribe("render.blocks", (data) => {
  const d = data ?? {};
  if (typeof d.text === "string") showText(d.text);
  else if (Array.isArray(d.cells))
    tool.setPanel(sanitizePanel({ title: "Block art", nodes: [{ kind: "blocks", cols: d.cols, cells: d.cells }] }));
});

showText(SAMPLE);
