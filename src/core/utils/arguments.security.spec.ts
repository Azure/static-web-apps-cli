import { parseCommandArguments } from "./strings.js";

describe("literal function arguments", () => {
  it.each([
    ["", []],
    [" \t\n ", []],
    ["--name \"two words\" 'single quoted'", ["--name", "two words", "single quoted"]],
    ["\"\" '' tail", ["", "", "tail"]],
    ['a"b c"d', ["ab cd"]],
    [String.raw`two\ words \"literal\"`, ["two words", '"literal"']],
    [String.raw`C:\tools\func --file "C:\path with spaces\file"`, [String.raw`C:\tools\func`, "--file", String.raw`C:\path with spaces\file`]],
    ["$VALUE *.json ; && > plain", ["$VALUE", "*.json", ";", "&&", ">", "plain"]],
    ["'C:\\tools\\func' trailing\\", [String.raw`C:\tools\func`, "trailing\\"]],
  ])("preserves literal tokens for %j", (input, expected) => {
    // Arrange / Act / Assert: no expansion or process execution.
    expect(parseCommandArguments(input as string)).toEqual(expected);
  });

  it.each(['"unterminated', "'unterminated", "before\0after"])("rejects malformed input %j before launch", (input) => {
    // Arrange / Act / Assert
    expect(() => parseCommandArguments(input)).toThrow(/unterminated quote|null character/);
  });
});
