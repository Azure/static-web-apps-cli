/**
 * Gets or sets the environment variables from `process.env`.
 *
 * @param newEnvs A list of environment variables to merge into the `process.env` object
 * @returns The SWA CLI environment variables from the `process.env` object
 */
export function swaCLIEnv(...newEnvs: SWACLIEnv[]): SWACLIEnv {
  // Note: logger is not available in this context
  // use console.log instead

  let env: SWACLIEnv = {
    ...process.env,
  };

  for (const newEnv of newEnvs) {
    env = {
      ...env,
      ...newEnv,
    };
  }

  return env;
}
