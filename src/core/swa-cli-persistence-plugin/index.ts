import { IdentityPlugin, TokenCachePersistenceOptions } from "@azure/identity";
import { ICachePlugin } from "@azure/msal-common";
import { logger } from "../utils";
import { SWACLIPersistenceCachePlugin } from "./persistence-cache-plugin";

/**
 * Plugin context entries for controlling cache plugins.
 */
export interface SWACLICachePluginControl {
  setPersistence(persistenceFactory: (options: TokenCachePersistenceOptions) => Promise<ICachePlugin>): void;
}

/**
 * Context options passed to a plugin during initialization.
 */
export interface AzurePluginContext {
  // Note: entry cachePluginControl must not be renamed!
  cachePluginControl: SWACLICachePluginControl;
}

async function createSWAPersistenceCachePlugin(options: TokenCachePersistenceOptions): Promise<ICachePlugin> {
  return new SWACLIPersistenceCachePlugin(options);
}

/**
 * A plugin that provides persistent token caching for `@azure/identity`
 * credentials. The plugin API is compatible with `@azure/identity` versions
 * 2.0.0 and later. Load this plugin using the `useIdentityPlugin`
 * function, imported from `@azure/identity`.
 *
 * In order to enable this functionality, you must also pass
 * `tokenCachePersistenceOptions` to your credential constructors with an
 * `enabled` property set to true.
 *
 * Example:
 *
 * ```javascript
 * import { useIdentityPlugin, DeviceCodeCredential } from "@azure/identity";
 * import { swaCliPersistencePlugin } from "@azure/static-web-apps-cli";
 *
 * // Load the plugin
 * useIdentityPlugin(swaCliPersistencePlugin);
 *
 * const credential = new DeviceCodeCredential({
 *   tokenCachePersistenceOptions: {
 *     enabled: true
 *   }
 * });
 * ```
 */

export const swaCliPersistencePlugin: IdentityPlugin = (context) => {
  logger.silly("Executing swaCliPersistencePlugin");

  const { cachePluginControl } = context as AzurePluginContext;
  cachePluginControl.setPersistence(createSWAPersistenceCachePlugin);
};
