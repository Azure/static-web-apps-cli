import chalk from "chalk";
import type http from "http";
import { DEFAULT_CONFIG } from "../../config";
import { SWA_CLI_APP_PROTOCOL } from "../constants";

export const logger = {
  _print(prefix: string | null, data: string) {
    if (prefix) {
      console.log(chalk.dim.gray(`[${prefix}]`), data);
    } else {
      console.log(data);
    }
  },

  _traverseObjectProperties(o: any, fn: (_prop: string, _value: any, _indent: string) => void, indent = "") {
    for (const i in o) {
      if (Array.isArray(o) || (typeof o === "object" && o.hasOwnProperty(i))) {
        if (o[i] !== null && typeof o[i] === "object") {
          fn(i, null, `${indent}`);
          this._traverseObjectProperties(o[i], fn, ` ${indent}`);
        } else {
          fn(i, o[i], ` ${indent}`);
        }
      }
    }
  },

  // public methods
  info(data: string | object, prefix: string | null = null) {
    this.silly(data, prefix, "info", chalk.green);
  },

  log(data: string | object, prefix: string | null = null) {
    this.silly(data, prefix, "log", chalk.reset);
  },

  error(data: string | object, exit = false) {
    const { SWA_CLI_DEBUG } = process.env;
    if (!SWA_CLI_DEBUG || SWA_CLI_DEBUG?.includes("silent")) {
      return;
    }

    console.error(chalk.red(data));
    if (exit) {
      process.exit(-1);
    }
  },

  silly(data: string | object, prefix: string | null = null, debugFilter: DebugFilterLevel = "silly", color: chalk.Chalk = chalk.magenta) {
    const { SWA_CLI_DEBUG } = process.env;
    if (!SWA_CLI_DEBUG || SWA_CLI_DEBUG?.includes("silent")) {
      return;
    }

    if (SWA_CLI_DEBUG?.includes("silly") || SWA_CLI_DEBUG?.includes(debugFilter)) {
      let log = "";
      if (typeof data === "object") {
        this._traverseObjectProperties(data, (key: string, value: string | null, indent: string) => {
          if (value !== null) {
            value = typeof value === "undefined" ? chalk.yellow("<undefined>") : value;
            log = `${indent}- ${key}: ${chalk.yellow(value)}`;
          } else {
            log = `${indent}- ${key}:`;
          }
        });
      } else {
        // data is not an object so just print its value even if it's null or undefined
        log = data;
      }
      this._print(prefix, color(log));
    }
  },
};

export function logRequest(req: http.IncomingMessage, target: string = "", statusCode: number | null = null, prefix = "") {
  let url = req.url?.replace(DEFAULT_CONFIG.customUrlScheme!, "");
  url = url?.startsWith("/") ? url : `/${url}`;

  const proto = target?.startsWith("ws") ? "ws" : SWA_CLI_APP_PROTOCOL;
  const host = `${proto}://${req.headers.host}`;

  prefix = prefix === "" ? "" : ` ${prefix} `;

  if (statusCode) {
    logger.log(`${prefix}${chalk.cyan(req.method)} ${host}${url} - ${chalk.green(statusCode)}`);
  } else {
    logger.log(chalk.yellow(`${prefix}${req.method} ${target + url} (proxy)`));
  }
}
