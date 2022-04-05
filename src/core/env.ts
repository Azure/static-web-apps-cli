/**
 * Gets or sets the environment variables.
 *
 * @param args A list of environment variables to merge into the `process.env` object
 * @returns The `process.env` object
 */
export function swaCLiEnv(...args: SWACLIEnv[]): SWACLIEnv {
  let newEnv: SWACLIEnv = {
    ...process.env,
  };

  for (const arg of args) {
    newEnv = {
      ...newEnv,
      ...arg,
    };
  }

  return newEnv;
}
