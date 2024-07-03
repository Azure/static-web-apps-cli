import updateNotifier from "update-notifier";

const pkg = require("../../../package.json");

export function notifyOnUpdate() {
  updateNotifier({ pkg }).notify();
}
