export function dasherize(str: string) {
  return str
    .replace(/([a-z\d])([A-Z]+)/g, "$1-$2")
    .replace(/[ _]+/g, "-")
    .toLowerCase();
}

export function stripJsonComments(json: string) {
  return json.replace(
    // 1. \\" matches escaped double quotes to avoid being captured by the removing groups
    // 2. "(?:\\"|[^"])*" matches anything inside double quotes, including escaped double quotes
    //    in a non-capturing group to avoid removing anything inside strings
    // 3. (\/\/.*|\/\*[\s\S]*?\*\/) capture anything after a double slash until newline, or
    //    in-between slash-star comments including newlines in a non-greedy way
    // Only the captured group is removed, ignoring comments inside strings as a result
    /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/gm,
    (match, group) => (group ? "" : match)
  );
}

export function removeTrailingPathSep(filePath: string): string {
  return filePath.replace(/[\\/]+$/, "");
}

export const hasSpaces = (str: string): boolean => str.indexOf(" ") !== -1;

/** Split literal argv without variable, wildcard, substitution or operator expansion. */
export function parseCommandArguments(value: string): string[] {
  if (value.includes("\0")) throw new Error("Arguments cannot contain a null character.");
  const args: string[] = [];
  let token = "";
  let started = false;
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "\\" && quote !== "'") {
      const next = value[index + 1];
      // Preserve backslash pairs in quoted Windows paths, but support escaped quotes/whitespace.
      if (next === '"' || (!quote && (next === "\\" || next === "'" || (next !== undefined && /\s/.test(next))))) {
        token += next;
        index++;
      } else {
        token += character;
      }
      started = true;
    } else if (quote) {
      if (character === quote) quote = undefined;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) args.push(token);
      token = "";
      started = false;
    } else {
      token += character;
      started = true;
    }
  }
  if (quote) throw new Error("Arguments contain an unterminated quote. Close the quote or escape a literal quote.");
  if (started) args.push(token);
  return args;
}
