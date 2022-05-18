const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
let branch = "";
let hash = "";
let build = "DEV";
try {
  branch = child_process.execSync(`git rev-parse --abbrev-ref HEAD`).toString("utf-8").trim();
  hash = child_process.execSync(`git rev-parse --short HEAD`).toString("utf-8").trim();
  build = `<a rel="noopener noreferrer" target="_blank" href="https://github.com/Azure/static-web-apps-cli/commit/${hash}">${branch}+sha.${hash}</a>`;
} catch {}

// main
(function () {
  // prettier-ignore
  const files = [
    path.join("src", "public", "auth.html"),
    path.join("src", "public", "401.html"),
    path.join("src", "public", "404.html"),
    path.join("src", "public", "403.html"),
    path.join("src", "cli", "bin.js"),
    path.join("schema", "swa-cli.config.schema.json"),
  ];

  files.forEach((file) => {
    let distFile = path.join("dist", file.replace("src", ""));

    if (!fs.existsSync(path.dirname(distFile))) {
      fs.mkdirSync(path.dirname(distFile), { recursive: true });
    }

    fs.copyFileSync(file, distFile);

    let content = fs.readFileSync(distFile).toString("utf-8");
    content = content.replace(/#STAMP#/, build);
    fs.writeFileSync(distFile, content);

    console.log(`Copied ${file} to ${distFile}`);
  });
})();
