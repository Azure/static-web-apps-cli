import chalk from "chalk";
import net from "net";
import ora from "ora";
import waitOn from "wait-on";
import { logger } from "./logger";

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

export function isHttpUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol.startsWith("http");
  } catch {
    return false;
  }
}

export async function validateDevServerConfig(context: string) {
  let { hostname, port } = parseUrl(context);

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
          timeout: 30000, // timeout in ms, default Infinity
          tcpTimeout: 1000, // tcp timeout in ms, default 300ms
          window: 1000, // stabilization time in ms, default 750ms
          strictSSL: false,
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

  return context;
}

export function parseUrl(url: string) {
  const { protocol, port, host, hostname } = new URL(url);
  return {
    protocol,
    port: Number(port),
    host,
    hostname,
  };
}

export function address(host: string, port: number | string | undefined, protocol = `http`) {
  if (!host) {
    throw new Error(`Host value is not set`);
  }

  let uri = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;

  try {
    new URL(uri);
  } catch (error) {
    throw new Error(`Address: ${uri} is malformed!`);
  }

  return uri;
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
