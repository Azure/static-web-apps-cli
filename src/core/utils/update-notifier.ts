import updateNotifier from "update-notifier";
import pkg from "../../../package.json" with { type: "json" };

export function notifyOnUpdate() {
  updateNotifier({ pkg }).notify();
}
