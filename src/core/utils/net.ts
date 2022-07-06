import chalk from "chalk";
import getPort from "get-port";
import net from "net";
import ora from "ora";
import waitOn from "wait-on";
import { confirmChooseRandomPort } from "../prompts";
import { logger } from "./logger";

const VALID_PORT_MIN = 1024;
const VALID_PORT_MAX = 65535;

/**
 * Check if a given remote address and port are accepting TCP connections.
 * @param Object host and port of the server to check.
 * @returns The resolved port number if the given server does not accept TCP connections. 0 if the port is already taken.
 */
export async function isAcceptingTcpConnections({ host, port }: { host?: string; port?: number }): Promise<number> {
  port = Number(port) as number;
  logger.silly(`Checking if ${host}:${port} is accepting TCP connections...`);

  // Check if current port is beyond the MAX valid port range
  if (port > VALID_PORT_MAX) {
    logger.silly(`Port ${port} is beyond the valid port range (${VALID_PORT_MAX}).`);
    return 0;
  }

  return new Promise((resolve) => {
    const socket = net.createConnection(port as number, host);

    socket
      .once("error", () => {
        socket.end();
        resolve(port as number);
      })
      .once("connect", async () => {
        resolve(0);
        socket.end();
      });
  });
}

/**
 * Ask if the user wants to use a new port number, and if yes return the new port number.
 * @returns A new port number if the user accepts or 0 if he refuses.
 */
export async function askNewPort(): Promise<number> {
  const confirm = await confirmChooseRandomPort(true);
  return confirm ? getPort() : 0;
}

/**
 * Check if a given URL string is a valid URL.
 * @param url The URL string to check.
 * @returns True if the URL string is a valid URL. False otherwise.
 */
export function isHttpUrl(url: string | undefined) {
  if (!url) {
    return false;
  }

  try {
    const uri = new URL(url);
    return uri.protocol.startsWith("http") || uri.protocol.startsWith("ws");
  } catch {
    return false;
  }
}

/**
 * Checks if a given server is up and accepting connection.
 * @param url An HTTP URL.
 * @param timeout Maximum time in ms to wait before exiting with failure (1) code,
  default Infinity.
 */
export async function validateDevServerConfig(url: string | undefined, timeout: number | undefined) {
  logger.silly(`Validating dev server config:`);
  logger.silly({
    url,
    timeout,
  });

  let { hostname, port } = parseUrl(url);

  try {
    const resolvedPortNumber = await isAcceptingTcpConnections({ port, host: hostname });
    if (resolvedPortNumber !== 0) {
      const spinner = ora();
      try {
        spinner.start(`Waiting for ${chalk.green(url)} to be ready`);
        await waitOn({
          resources: [`tcp:${hostname}:${port}`],
          delay: 1000, // initial delay in ms, default 0
          interval: 100, // poll interval in ms, default 250ms
          simultaneous: 1, // limit to 1 connection per resource at a time
          timeout: timeout ? timeout * 1000 : timeout, // timeout in ms, default Infinity
          tcpTimeout: 1000, // tcp timeout in ms, default 300ms
          window: 1000, // stabilization time in ms, default 750ms
          strictSSL: false,
          verbose: false, // force disable verbose logs even if SWA_CLI_DEBUG is enabled
        });
        spinner.succeed(`Connected to ${chalk.green(url)} successfully`);
        spinner.clear();
      } catch (err) {
        spinner.fail();
        logger.error(`Could not connect to "${url}". Is the server up and running?`, true);
      }
    }
  } catch (err) {
    if ((err as any).message.includes("EACCES")) {
      logger.error(
        `Port "${port}" cannot be used. You might need elevated or admin privileges. Or, use a valid port from ${VALID_PORT_MIN} to ${VALID_PORT_MAX}.`,
        true
      );
    } else {
      logger.error((err as any).message, true);
    }
  }
}

/**
 * Parse a given URL and return its protocol, port, host and hostname.
 * @param url The URL string to check.
 * @returns Protocol, port, host and hostname extracted from the URL.
 */
export function parseUrl(url: string | undefined) {
  if (!url) {
    throw new Error(`Address: ${url} is malformed!`);
  }

  let { protocol, port, host, hostname } = new URL(url);
  if (port === "") {
    switch (protocol) {
      case "http:":
        port = "80";
        break;
      case "https:":
        port = "443";
        break;
    }
  }

  return {
    protocol,
    port: Number(port),
    host,
    hostname,
  };
}

/**
 * Construct a valid URL string from a host, port and protocol.
 * @param host A host address.
 * @param port (optional) A host port.
 * @param protocol (optional) A host protocol.
 * @throws {Error} if the URL is malformed.
 * @returns
 */
export function address(host: string | undefined, port: number | string = 80, protocol = `http`) {
  if (!host) {
    throw new Error(`Host value is not set`);
  }

  let url = port === 80 ? `${protocol}://${host}` : `${protocol}://${host}:${port}`;

  if (isHttpUrl(url)) {
    return url;
  } else {
    throw new Error(`Address: ${url} is malformed!`);
  }
}
export function response({ status, headers, cookies, body = "" }: ResponseOptions) {
  if (typeof status !== "number") {
    throw Error("TypeError: status code must be a number.");
  }

  body = body || null;

  const res = {
    status,
    cookies,
    headers: {
      status,
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  };
  return res;
}

export function parsePort(port: string) {
  const portNumber = parseInt(port, 10);
  if (isNaN(portNumber)) {
    logger.error(`Port "${port}" is not a number.`, true);
  } else {
    if (portNumber < VALID_PORT_MIN || portNumber > VALID_PORT_MAX) {
      logger.error(`Port "${port}" is out of range. Valid ports are from ${VALID_PORT_MIN} to ${VALID_PORT_MAX}.`, true);
    }
  }
  return portNumber;
}

export function hostnameToIpAdress(hostnameOrIpAddress: string | undefined) {
  if (hostnameOrIpAddress === "localhost") {
    return "127.0.0.1";
  }
  return hostnameOrIpAddress;
}

export function isValidIpAddress(ip: string) {
  return net.isIP(ip);
}
