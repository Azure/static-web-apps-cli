import updateNotifier from "update-notifier";
import pkg from "../../../package.json";

export function notifyOnUpdate() {
  updateNotifier({ pkg }).notify();
}
