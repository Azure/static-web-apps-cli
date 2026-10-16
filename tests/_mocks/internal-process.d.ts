import { Mock } from "vitest";

export const childProcess: Record<"exec" | "execFile" | "execSync" | "execFileSync" | "spawn" | "spawnSync" | "fork", Mock>;
export function mockInternalProcesses(stdout?: string, error?: Error): void;
export function directLaunches(): { file: string; args: string[]; options: { cwd?: string; shell?: boolean; env?: Record<string, string> } }[];
