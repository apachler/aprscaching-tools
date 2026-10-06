// SPDX-License-Identifier: MIT
/* global tool */
// Auto-responder: greets a station that connects, PMS-style, with its callsign and the station it reached. The
// greeting goes back through the reply the connected surface offers with the event.

tool.on("on_connect", (p) => {
  const who = p.peerCall ? ` ${p.peerCall}` : "";
  const me = p.myCall ? ` ${p.myCall}` : " an APRScaching";
  p.reply?.(`Welcome${who} - this is${me} auto-responder. Type H for help.`);
});
