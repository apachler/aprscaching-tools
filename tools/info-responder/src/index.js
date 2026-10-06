// SPDX-License-Identifier: MIT
/* global register, tool */
// Info / menu responder: answers a connected peer's INFO, MENU and WHOIS <call>. WHOIS asks the Station DB tool over
// the bus; those three opt in to remote peers. /setinfo, which sets the text peers see, is the operator's alone.
import { asStr } from "../../../lib/text.js";

const DEFAULT_INFO = "APRScaching shack station. Type MENU for commands. 73!";
let infoText = "";
const info = () => infoText || DEFAULT_INFO;

function panel() {
  tool.setPanel({
    title: "Info responder",
    nodes: [
      { kind: "text", text: "Connected peers may send INFO / MENU / WHOIS.", tone: "muted" },
      { kind: "kv", key: "Peer info", value: info() },
    ],
  });
}

register({
  commands: {
    info: { remote: true, run: () => [info()] },
    menu: { remote: true, run: () => ["Commands: INFO  MENU  WHOIS <call>"] },
    whois: {
      remote: true,
      run: async (args) => {
        const c = args.trim().toUpperCase();
        if (!c) return ["Usage: WHOIS <CALL>"];
        let type = "";
        try {
          type = asStr(await tool.call("station.type", c));
        } catch {
          // no Station DB answer: the call reads as not heard
        }
        return [type ? `${c}: ${type}` : `${c}: not heard yet (enable Station DB to classify).`];
      },
    },
    // the operator's alone: a command without `remote: true` never answers a peer
    setinfo: {
      run: (args) => {
        const t = args.trim();
        if (!t) return ["Usage: /setinfo <text peers see>"];
        infoText = t.slice(0, 240);
        panel();
        return ["Info text updated."];
      },
    },
  },
});

panel();
