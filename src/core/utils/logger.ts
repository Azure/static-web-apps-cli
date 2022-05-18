import chalk from "chalk";
import type http from "http";
import { CUSTOM_URL_SCHEME, SWA_CLI_APP_PROTOCOL } from "../constants";
import { swaCLIEnv } from "../env";

const SENSITIVE_KEYS = ["DEPLOYMENT_TOKEN", "SWA_CLI_DEPLOYMENT_TOKEN", "--deployment-token", "deploymentToken"];

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

  /**
   * Print information data.
   * @param data Either a string or an object to be printed.
   * @param prefix (optional) A prefix to prepend to the printed message.
   */
  info(data: string | object, prefix: string | null = null) {
    this.silly(data, prefix, "info", chalk.green);
  },

  /**
   * Print log data.
   * @param data Either a string or an object to be printed.
   * @param prefix (optional) A prefix to prepend to the printed message.
   */
  log(data: string | object, prefix: string | null = null) {
    this.silly(data, prefix, "log", chalk.reset);
  },

  /**
   * Print information data.
   * @param data Either a string or an object to be printed.
   * @param prefix (optional) A prefix to prepend to the printed message.
   */
  warn(data: string | object, prefix: string | null = null) {
    this.silly(data, prefix, "log", chalk.yellow);
  },

  /**
   * Print error data and optionally exit the CLI instance.
   * @param data Either a string or an object to be printed.
   * @param exit If set to True, the CLI instance will be terminated after printing the error message (code -1).
   */
  error(data: string | object, exit = false) {
    const { SWA_CLI_DEBUG } = swaCLIEnv();
    if (SWA_CLI_DEBUG?.includes("silent")) {
      return;
    }

    console.error(chalk.red("✖ " + data));
    if (exit) {
      process.exit(1);
    }
  },

  /**
   * Print logs with verbose filter enabled.
   * @param data Either a string or an object to be printed.
   * @param prefix (optional) A prefix to prepend to the printed message.
   * @param debugFilter (optional) A valid debug filter of type DebugFilterLevel.
   * @param color (optional) A valid Chalk color to be used when printing logs.
   */
  silly(data: string | object, prefix: string | null = null, debugFilter: DebugFilterLevel = "silly", color: chalk.Chalk = chalk.magenta) {
    const { SWA_CLI_DEBUG } = swaCLIEnv();
    if (!SWA_CLI_DEBUG || SWA_CLI_DEBUG?.includes("silent")) {
      return;
    }

    const isSensitiveKey = (key: string) => SENSITIVE_KEYS.some((sensitiveKey) => key.includes(sensitiveKey));

    if (SWA_CLI_DEBUG?.includes("silly") || SWA_CLI_DEBUG?.includes(debugFilter)) {
      if (typeof data === "object") {
        this._traverseObjectProperties(data, (key: string, value: string | null, indent: string) => {
          if (value !== null) {
            if (isSensitiveKey(key)) {
              value = chalk.yellow("<hidden>");
            } else if (typeof value === "undefined") {
              value = chalk.yellow("<undefined>");
            }

            this._print(prefix, color(`${indent}- ${key}: ${chalk.yellow(value)}`));
          } else {
            this._print(prefix, color(`${indent}- ${key}:`));
          }
        });
      } else {
        // data is not an object so just print its value even if it's null or undefined
        this._print(prefix, color(data));
      }
    }
  },
};

/**
 * Print logs related to an HTTP request.
 * @example `GET https://localhost:1234/path 200`
 * @param req Node.js HTTP request object.
 * @param target (optional) A remote target.
 * @param statusCode (optional) An HTTP status code.
 * @param prefix (optional) A prefix to prepend to the printed message.
 */
export function logRequest(req: http.IncomingMessage, target: string = "", statusCode: number | null = null, prefix = "") {
  let url = req.url?.replace(CUSTOM_URL_SCHEME, "");
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

export function logGiHubIssueMessageAndExit() {
  logger.log(``);
  logger.error(
    "If you believe this behavior is unexpected, please raise a GitHub issue at:\n  https://github.com/Azure/static-web-apps-cli/issues/new/choose",
    true
  );
}
