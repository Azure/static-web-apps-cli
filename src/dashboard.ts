import blessed from "blessed";
import { ChildProcessWithoutNullStreams } from "child_process";

const dashboard = new (class Dashboard {
  private screen: blessed.Widgets.Screen;
  private hosting: blessed.Widgets.Log;
  private functions: blessed.Widgets.Log;
  private auth: blessed.Widgets.Log;
  private status: blessed.Widgets.Log;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      dockBorders: false,
      fullUnicode: true,
      autoPadding: true,
    });
    this.screen.title = "Azure Static Web Apps Emulator";
    this.screen.key(["escape", "q", "C-c"], () => {
      process.kill(process.pid, "SIGINT");
    });

    this.hosting = this.addLogSection({ label: "Hosting" });
    this.mapNavKeys({ logWidget: this.hosting });

    this.functions = this.addLogSection({ top: "30%", label: "Functions" });
    this.mapNavKeys({ logWidget: this.functions });

    this.auth = this.addLogSection({ top: "58%", label: "Auth" });
    this.mapNavKeys({ logWidget: this.auth });

    this.status = this.addLogSection({ top: "90%", height: "15%", label: "Status" });
    this.mapNavKeys({ logWidget: this.status });

    this.screen.render();
  }

  addLogSection({ label, top = "0%", height = "30%" }) {
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

    this.screen.append(logBox);
    const logWidget = blessed.log({ parent: logBox, tags: true, width: "100%-5" });
    return logWidget;
  }

  mapNavKeys({ logWidget }) {
    this.screen.key(["up"], () => {
      logWidget.scroll(-1);
      logWidget.screen.render();
    });
    this.screen.key(["down"], () => {
      logWidget.scroll(1);
      logWidget.screen.render();
    });
  }

  stream(type: string, proc: ChildProcessWithoutNullStreams) {
    if (proc) {
      proc.stdout.on("data", (data) => this[type].log(data.toString("utf8")));
      proc.stderr.on("data", (data) => this[type].log(data.toString("utf8")));

      process.on("exit", () => {
        process.kill(proc.pid);
      });
    }
  }
})();

export { dashboard };
