import path from "path";
import { DEFAULT_CONFIG } from "../config";
import { address, isHttpUrl } from "./utils/net";

export const SWA_AUTH_COOKIE = `StaticWebAppsAuthCookie`;
export const ALLOWED_HTTP_METHODS_FOR_STATIC_CONTENT = ["GET", "HEAD", "OPTIONS"];

export const AUTH_STATUS = {
  NoAuth: 0,
  HostNameAuthLogin: 1,
  HostNameAuthComplete: 2,
  HostNameAuthLogout: 3,
  IdentityAuthLogin: 4,
  IdentityRedirect: 5,
  IdentityAuthLoginDone: 6,
  IdentityAuthConsentGranted: 7,
  HostNameAuthAcceptInvitation: 8,
  AuthMe: 9,
  HostNameAuthLogoutComplete: 10,
  IdentityRedirectLogout: 11,
  IdentityAuthLogoutComplete: 12,
  IdentityAuthPurgeBegin: 13,
  IdentityAuthPurgeWarning: 14,
  IdentityAuthPurgeComplete: 15,
  HostNameAuthPurge: 16,
  HostNameAuthLoginCallback: 17,
  IdentityAuthLoginCallback: 18,
  IdentityAuthLogout: 19,
};

// this list must cover this set at least: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
export const MIME_TYPE_LIST: { [key: string]: string } = {
  ".aac": "audio/aac",
  ".abw": "application/x-abiword",
  ".appinstaller": "application/appinstaller",
  ".appx": "application/appx",
  ".appxbundle": "application/appxbundle",
  ".arc": "application/x-freearc",
  ".asf": "video/x-ms-asf",
  ".asx": "video/x-ms-asf",
  ".avi": "video/x-msvideo",
  ".azw": "application/vnd.amazon.ebook",
  ".bin": "application/octet-stream",
  ".bmp": "image/bmp",
  ".bz": "application/x-bzip",
  ".bz2": "application/x-bzip2",
  ".cco": "application/x-cocoa",
  ".crt": "application/x-x509-ca-cert",
  ".csh": "application/x-csh",
  ".css": "text/css",
  ".csv": "text/csv",
  ".deb": "application/octet-stream",
  ".der": "application/x-x509-ca-cert",
  ".dll": "application/octet-stream",
  ".dmg": "application/octet-stream",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ear": "application/java-archive",
  ".eot": "application/octet-stream",
  ".epub": "application/epub+zip",
  ".exe": "application/octet-stream",
  ".flv": "video/x-flv",
  ".gif": "image/gif",
  ".gz": "application/gzip",
  ".hqx": "application/mac-binhex40",
  ".htc": "text/x-component",
  ".htm": "text/html",
  ".html": "text/html",
  ".ico": "image/vnd.microsoft.icon",
  ".ics": "text/calendar",
  ".img": "application/octet-stream",
  ".iso": "application/octet-stream",
  ".jar": "application/java-archive",
  ".jardiff": "application/x-java-archive-diff",
  ".jng": "image/x-jng",
  ".jnlp": "application/x-java-jnlp-file",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jsonld": "application/ld+json",
  ".mid": "audio/midi",
  ".midi": "audio/x-midi",
  ".mjs": "text/javascript",
  ".mml": "text/mathml",
  ".mng": "video/x-mng",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".mpkg": "application/vnd.apple.installer+xml",
  ".msi": "application/octet-stream",
  ".msix": "application/msix",
  ".msixbundle": "application/msixbundle",
  ".msm": "application/octet-stream",
  ".msp": "application/octet-stream",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".oga": "audio/ogg",
  ".ogv": "video/ogg",
  ".ogx": "application/ogg",
  ".opus": "audio/opus",
  ".otf": "font/otf",
  ".pdb": "application/x-pilot",
  ".pdf": "application/pdf",
  ".pem": "application/x-x509-ca-cert",
  ".php": "application/php",
  ".pl": "application/x-perl",
  ".pm": "application/x-perl",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".prc": "application/x-pilot",
  ".ra": "audio/x-realaudio",
  ".rar": "application/x-rar-compressed",
  ".rpm": "application/x-redhat-package-manager",
  ".rss": "text/xml",
  ".rtf": "application/rtf",
  ".run": "application/x-makeself",
  ".sea": "application/x-sea",
  ".sh": "application/x-sh",
  ".shtml": "text/html",
  ".sit": "application/x-stuffit",
  ".svg": "image/svg+xml",
  ".swf": "application/x-shockwave-flash",
  ".tar": "application/x-tar",
  ".tcl": "application/x-tcl",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".tk": "application/x-tcl",
  ".ts": "video/mp2t",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".vsd": "application/vnd.visio",
  ".war": "application/java-archive",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".wbmp": "image/vnd.wap.wbmp",
  ".wmv": "video/x-ms-wmv",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xhtml": "application/xhtml+xml",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xml": "text/xml",
  ".xpi": "application/x-xpinstall",
  ".xul": "application/vnd.mozilla.xul+xml",
  ".zip": "application/zip",
  ".3gp": "video/3gpp",
  ".3g2": "video/3gpp2",
  ".7z": "application/x-7z-compressed",
};

export const DEFAULT_MIME_TYPE = "application/octet-stream";
export const HEADER_DELETE_KEYWORD = "@@HEADER_DELETE_KEYWORD@@";

export const CACHE_CONTROL_MAX_AGE = 30;

export const SWA_WORKFLOW_CONFIG_FILE = process.env.SWA_WORKFLOW_CONFIG_FILE as string;
export const SWA_CLI_HOST = process.env.SWA_CLI_HOST as string;
export const SWA_CLI_PORT = parseInt((process.env.SWA_CLI_PORT || DEFAULT_CONFIG.port) as string, 10);
export const SWA_CLI_APP_LOCATION = (process.env.SWA_CLI_APP_LOCATION || DEFAULT_CONFIG.appLocation) as string;
export const SWA_CLI_ROUTES_LOCATION = (process.env.SWA_CLI_ROUTES_LOCATION || DEFAULT_CONFIG.swaConfigLocation) as string;
export const SWA_CLI_OUTPUT_LOCATION = (process.env.SWA_CLI_OUTPUT_LOCATION || DEFAULT_CONFIG.outputLocation) as string;
export const SWA_CLI_API_LOCATION = (process.env.SWA_CLI_API_LOCATION || DEFAULT_CONFIG.apiLocation) as string;
export const SWA_CLI_APP_SSL = process.env.SWA_CLI_APP_SSL === "true" || DEFAULT_CONFIG.ssl === true;
export const SWA_CLI_APP_SSL_KEY = process.env.SWA_CLI_APP_SSL_KEY as string;
export const SWA_CLI_APP_SSL_CERT = process.env.SWA_CLI_APP_SSL_CERT as string;
export const SWA_CLI_APP_PROTOCOL = SWA_CLI_APP_SSL ? `https` : `http`;
export const SWA_PUBLIC_DIR = path.resolve(__dirname, "..", "public"); //SWA_PUBLIC_DIR = "../public"
export const HAS_API = Boolean(SWA_CLI_API_LOCATION && SWA_CLI_API_URI());
export const SWA_CLI_DEVSERVER_TIMEOUT = parseInt((process.env.SWA_CLI_DEVSERVER_TIMEOUT || DEFAULT_CONFIG.devserverTimeout) as string, 10);
export const SWA_CLI_OPEN = (process.env.SWA_CLI_OPEN === "true" || DEFAULT_CONFIG.open) as boolean;

// --
// Note: declare these as functions so that their body gets evaluated at runtime!
// The reason for this is that these function depend on values set by environment variables which are set
// during the startup of the CLI (see src/cli/commands/start.ts)
export function IS_APP_DEV_SERVER() {
  return isHttpUrl(SWA_CLI_OUTPUT_LOCATION);
}
export function IS_API_DEV_SERVER() {
  return isHttpUrl(SWA_CLI_API_LOCATION);
}
export function SWA_CLI_API_URI() {
  return IS_API_DEV_SERVER() ? SWA_CLI_API_LOCATION : address(SWA_CLI_HOST, process.env.SWA_CLI_API_PORT);
}
