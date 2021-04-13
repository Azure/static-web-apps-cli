/**
 *  Turn expression into a valid regex
 */
export function globToRegExp(glob: string) {
  const filesExtensionMatch = glob.match(/{.*}/);
  if (filesExtensionMatch) {
    const filesExtensionExpression = filesExtensionMatch[0];
    if (filesExtensionExpression) {
      // build a regex group (png|jpg|gif)
      const filesExtensionRegEx = filesExtensionExpression.replace(/\,/g, "|").replace("{", "(").replace("}", ")");
      glob = glob.replace(filesExtensionExpression, filesExtensionRegEx);
    }
  }

  return glob.replace(/\//g, "\\/").replace("*.", ".*").replace("/*", "/.*");
}
