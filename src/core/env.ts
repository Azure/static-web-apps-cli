/**
 * Gets or sets the environment variables from `process.env`.
 *
 * @param newEnvs A list of environment variables to merge into the `process.env` object
 * @returns The SWA CLI environment variables from the `process.env` object
 */
export function swaCLIEnv(...newEnvs: SWACLIEnv[]): SWACLIEnv {
  // Note: logger is not available in this context
  // use console.log instead

  let env = {
    ...process.env,
  } as SWACLIEnv;

  for (const newEnv of newEnvs) {
    env = {
      ...env,
      ...newEnv,
    };
  }

  return env;
}

export function getSwaEnvList() {
  const env: SWACLIEnv = swaCLIEnv();
  const entries = Object.entries(env)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([key, _value]) => key.startsWith("SWA_") || key.startsWith("AZURE_"));

  return entries;
}

export function useEnvVarOrUseDefault(env: string | undefined, defaultValue: boolean): boolean {
  if (env === undefined) {
    return defaultValue;
  } else if (env === "true" || env === "1") {
    return true;
  } else if (env === "false" || env === "0" || env === "null" || env === "undefined") {
    return false;
  }

  return defaultValue;
}
