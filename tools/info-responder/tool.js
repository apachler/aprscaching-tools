// SPDX-License-Identifier: MIT
// Info / menu responder 1.1.0, built by scripts/build.mjs from tools/info-responder/src, lib/ and the
// aprscaching libraries at 32b5862c5c03ef1e4eda02611bf2ab1c8712a810 (lib.lock). Edit the sources, not this file.
(() => {
  // lib/text.js
  var asStr = (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "";

  // tools/info-responder/src/index.js
  var DEFAULT_INFO = "APRScaching shack station. Type MENU for commands. 73!";
  var infoText = "";
  var info = () => infoText || DEFAULT_INFO;
  function panel() {
    tool.setPanel({
      title: "Info responder",
      nodes: [
        { kind: "text", text: "Connected peers may send INFO / MENU / WHOIS.", tone: "muted" },
        { kind: "kv", key: "Peer info", value: info() }
      ]
    });
  }
  register({
    commands: {
      info: () => [info()],
      menu: () => ["Commands: INFO  MENU  WHOIS <call>  GRID <loc> [loc]  CONV <n> <from> <to>"],
      whois: async (args) => {
        const c = args.trim().toUpperCase();
        if (!c) return ["Usage: WHOIS <CALL>"];
        let type = "";
        try {
          type = asStr(await tool.call("station.type", c));
        } catch {
        }
        return [type ? `${c}: ${type}` : `${c}: not heard yet (enable Station DB to classify).`];
      },
      setinfo: {
        remote: false,
        run: (args) => {
          const t = args.trim();
          if (!t) return ["Usage: /setinfo <text peers see>"];
          infoText = t.slice(0, 240);
          panel();
          return ["Info text updated."];
        }
      }
    }
  });
  panel();
})();
