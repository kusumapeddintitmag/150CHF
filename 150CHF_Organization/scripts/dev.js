import { spawn } from 'node:child_process';
import net from 'node:net';
import { resolve } from 'node:path';

const node = process.execPath;
const apiPort = 4000;
const processes = [];

function isPortInUse(port) {
  return new Promise((resolvePort) => {
    const probe = net.createServer();
    probe.once('error', (error) => resolvePort(error.code === 'EADDRINUSE'));
    probe.once('listening', () => probe.close(() => resolvePort(false)));
    probe.listen(port);
  });
}

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  processes.forEach((child) => child.kill());
};

async function start() {
  if (!(await isPortInUse(apiPort))) {
    processes.push(spawn(node, [resolve('server/index.js')], { stdio: 'inherit' }));
  } else {
    console.log(`API server already running on port ${apiPort}; reusing it.`);
  }
  processes.push(spawn(node, [resolve('node_modules/vite/bin/vite.js')], { stdio: 'inherit' }));
  processes.forEach((child) => child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      stop();
      process.exitCode = code || 1;
    }
  }));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
start().catch((error) => {
  console.error(`Unable to start development services: ${error.message}`);
  stop();
  process.exitCode = 1;
});
