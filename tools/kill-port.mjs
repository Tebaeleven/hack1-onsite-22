#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const port = process.argv[2];

if (!port || !/^\d+$/.test(port)) {
  console.error("Usage: node tools/kill-port.mjs <port>");
  process.exit(2);
}

function listPids() {
  try {
    const output = execFileSync("lsof", [
      "-ti",
      `TCP:${port}`,
      "-sTCP:LISTEN",
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split(/\s+/)
      .map((pid) => Number(pid))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

const pids = listPids();

if (pids.length === 0) {
  console.log(`No listener found on port ${port}.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to PID ${pid} on port ${port}.`);
  } catch (error) {
    console.error(`Failed to stop PID ${pid}: ${error.message}`);
  }
}

const deadline = Date.now() + 2500;
while (Date.now() < deadline) {
  if (listPids().length === 0) {
    console.log(`Port ${port} is free.`);
    process.exit(0);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
}

for (const pid of listPids()) {
  try {
    process.kill(pid, "SIGKILL");
    console.log(`Sent SIGKILL to PID ${pid} on port ${port}.`);
  } catch (error) {
    console.error(`Failed to force stop PID ${pid}: ${error.message}`);
  }
}

if (listPids().length > 0) {
  console.error(`Port ${port} is still in use.`);
  process.exit(1);
}

console.log(`Port ${port} is free.`);
