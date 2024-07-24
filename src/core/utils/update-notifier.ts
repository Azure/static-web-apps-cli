import updateNotifier from "update-notifier";
import { loadPackageJson } from "./json.js";

const pkg = loadPackageJson();

export function notifyOnUpdate() {
  updateNotifier({ pkg }).notify();
}
