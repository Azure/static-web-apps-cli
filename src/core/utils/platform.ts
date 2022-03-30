export function isWSL() {
  return process.env.WSL_DISTRO_NAME !== undefined;
}
