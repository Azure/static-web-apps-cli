export function dasherize(str: string) {
  return str
    .replace(/([a-z\d])([A-Z]+)/g, "$1-$2")
    .replace(/[ _]+/g, "-")
    .toLowerCase();
}

export function stripJsonComments(json: string) {
  return json.replace(
    /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/gm,
    (match, group) => group ? "" : match
  );
}
