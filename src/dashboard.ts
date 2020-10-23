// @ts-check
import { ChildProcessWithoutNullStreams } from "child_process";
import blessed from "blessed";

export const dashboard = new (class Dashboard {
  #screen: blessed.Widgets.Screen;
  #hosting: blessed.Widgets.Log;
  #functions: blessed.Widgets.Log;
  #auth: blessed.Widgets.Log;
  #status: blessed.Widgets.Log;

  constructor() {
    this.#screen = blessed.screen({
      smartCSR: true,
      dockBorders: false,
      fullUnicode: true,
      autoPadding: true,
    });
    this.#screen.title = "Azure Static Web Apps Emulator";
    this.#screen.key(["escape", "q", "C-c"], () => {
      process.kill(process.pid, "SIGINT");
    });

    this.#hosting = this.addLogSection({ label: "Hosting" });
    this.mapNavKeys({ logWidget: this.#hosting });

    this.#functions = this.addLogSection({ top: "30%", label: "Functions" });
    this.mapNavKeys({ logWidget: this.#functions });

    this.#auth = this.addLogSection({ top: "58%", label: "Auth" });
    this.mapNavKeys({ logWidget: this.#auth });

    this.#status = this.addLogSection({ top: "90%", height: "15%", label: "Status" });
    this.mapNavKeys({ logWidget: this.#status });

    this.#screen.render();
  }

  addLogSection({ label = "", top = "0%", height = "30%" }) {
    let logBox = blessed.log({
      label,
      padding: 1,
      width: "100%",
      height,
      left: "0%",
      top,
      border: {
        type: "line",
      },
      clickable: true,
      focus: {
        border: {
          fg: "green",
        },
      },
      mouse: true,
    });

    this.#screen.append(logBox);
    const logWidget = blessed.log({ parent: logBox, tags: true, width: "100%-5" });
    return logWidget;
  }

  mapNavKeys({ logWidget }: { logWidget: blessed.Widgets.Log }) {
    this.#screen.key(["up"], () => {
      logWidget.scroll(-1);
      logWidget.screen.render();
    });
    this.#screen.key(["down"], () => {
      logWidget.scroll(1);
      logWidget.screen.render();
    });
  }

  stream(type: "hosting" | "functions" | "auth" | "status", proc: ChildProcessWithoutNullStreams) {
    if (proc) {
      proc.stdout.on("data", (data) => {
        const msg = data.toString("utf8");
        switch (type) {
          case "auth":
            this.#auth.log(msg);
            break;
          case "functions":
            this.#auth.log(msg);
            break;
          case "hosting":
            this.#auth.log(msg);
            break;
          case "status":
            this.#auth.log(msg);
            break;
        }
      });
      proc.stderr.on("data", (data) => {
        const msg = data.toString("utf8");
        switch (type) {
          case "auth":
            this.#auth.log(msg);
            break;
          case "functions":
            this.#auth.log(msg);
            break;
          case "hosting":
            this.#auth.log(msg);
            break;
          case "status":
            this.#auth.log(msg);
            break;
        }
      });

      process.on("exit", () => {
        process.kill(proc.pid);
      });
    }
  }
})();
