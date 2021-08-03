import chalk from "chalk";
import net from "net";
import ora from "ora";
import waitOn from "wait-on";
import { logger } from "./logger";

/**
 * Check if a given remote address and port are accepting TCP connections.
 * @param Object host and port of the server to check.
 * @returns True if the given server is accepting TCP connections. False otherwise.
 */
export function isAcceptingTcpConnections({ host = "127.0.0.1", port }: { host?: string; port: number }) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection(port, host);

    socket
      .once("error", () => {
        resolve(false);
        socket.end();
      })
      .once("connect", () => {
        resolve(true);
        socket.end();
      });
  });
}

/**
 * Check if a given URL string is a valid URL.
 * @param url The URL string to check.
 * @returns True if the URL string is a valid URL. False otherwise.
 */
export function isHttpUrl(url: string) {
  try {
    const uri = new URL(url);
    return uri.protocol.startsWith("http") || uri.protocol.startsWith("ws");
  } catch {
    return false;
  }
}

/**
 * Checks if a given server is up and accepting connection.
 * @param context An HTTP URL.
 * @param timeout Maximum time in ms to wait before exiting with failure (1) code,
  default Infinity.
 */
export async function validateDevServerConfig(context: string, timeout: number) {
  let { hostname, port } = parseUrl(context);
  if (port === 0) {
    //For custom Urls like http://e7fd8a1ae447.ngrok.io, port is taken as 0,instead of 80 for http
    port = 80;
  }

  try {
    const appListening = await isAcceptingTcpConnections({ port, host: hostname });
    if (appListening === false) {
      const spinner = ora();
      try {
        spinner.start(`Waiting for ${chalk.green(context)} to be ready`);
        await waitOn({
          resources: [address(hostname, port)],
          delay: 1000, // initial delay in ms, default 0
          interval: 100, // poll interval in ms, default 250ms
          simultaneous: 1, // limit to 1 connection per resource at a time
          timeout, // timeout in ms, default Infinity
          tcpTimeout: 1000, // tcp timeout in ms, default 300ms
          window: 1000, // stabilization time in ms, default 750ms
          strictSSL: false,
          verbose: false, // force disable verbose logs even if SWA_CLI_DEBUG is enabled
        });
        spinner.succeed(`Connected to ${chalk.green(context)} successfully`);
        spinner.clear();
      } catch (err) {
        spinner.fail();
        logger.error(`Could not connect to "${context}". Is the server up and running?`);
        process.exit(-1);
      }
    }
  } catch (err) {
    if (err.message.includes("EACCES")) {
      logger.error(`Port "${port}" cannot be used. You might need elevated or admin privileges. Or, use a valid port: 1024 to 49151`);
    } else {
      logger.error(err.message);
    }
    process.exit(-1);
  }
}

/**
 * Parse a given URL and return its protocol, port, host and hostname.
 * @param url The URL string to check.
 * @returns Protocol, port, host and hostname extracted from the URL.
 */
export function parseUrl(url: string) {
  const { protocol, port, host, hostname } = new URL(url);
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
export function address(host: string, port: number | string = 80, protocol = `http`) {
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
    if (portNumber < 1024 || portNumber > 49151) {
      logger.error(`Port "${port}" is out of range. Allowed ports are from 1024 to 49151.`, true);
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
