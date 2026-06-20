#!/usr/bin/env node

const major = parseInt(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`bmalph requires Node 20+, got ${major}`);
  process.exit(1);
}

process.on("unhandledRejection", (err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

import("../dist/cli.js");
