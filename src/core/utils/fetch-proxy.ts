import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { logger } from "./logger.js";

function getProxyUrl(envVar: string): string {
  const lowerCaseUrl = envVar.toLowerCase(); // Normalize case for checking
  const result = lowerCaseUrl.startsWith("http://") || lowerCaseUrl.startsWith("https://") ? envVar : `http://${envVar}`;
  logger.silly(`Using proxy: ${result}`);
  return result;
}

export function getGetProxyAgent(): HttpProxyAgent<string> | HttpsProxyAgent<string> | undefined {
  return process.env.HTTPS_PROXY
    ? new HttpsProxyAgent(getProxyUrl(process.env.HTTPS_PROXY))
    : process.env.HTTP_PROXY
      ? new HttpProxyAgent(getProxyUrl(process.env.HTTP_PROXY))
      : undefined;
}

export function fetchWithProxy(input: fetch.RequestInfo, init?: fetch.RequestInit): Promise<fetch.Response> {
  const useAgent = getGetProxyAgent();
  if (useAgent !== undefined) {
    return fetch(input, { ...init, agent: useAgent });
  } else {
    return fetch(input, init);
  }
}
