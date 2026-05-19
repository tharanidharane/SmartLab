const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let child = null;
let stopping = false;
let restartTimer = null;
let watchers = [];

function startBackend() {
  const backendCwd = path.resolve(__dirname, '..', 'backend');

  child = spawn('node', [
    '-r', 'dotenv/config',
    '-r', 'ts-node/register',
    '-r', 'tsconfig-paths/register',
    'local-server.ts',
  ], {
    cwd: backendCwd,
    env: {
      ...process.env,
      TS_NODE_PROJECT: 'tsconfig.local.json',
    },
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (stopping) {
      return;
    }

    const codeText = code === null ? 'null' : String(code);
    const signalText = signal ?? 'none';
    console.error(`[dev:backend] Backend exited (code=${codeText}, signal=${signalText}). Restarting in 2s...`);

    setTimeout(() => {
      if (!stopping) {
        startBackend();
      }
    }, 2000);
  });
}

function stopBackend() {
  if (child && !child.killed) {
    child.kill('SIGINT');
  }
}

function restartBackend(reason) {
  if (stopping) return;
  if (restartTimer) clearTimeout(restartTimer);

  restartTimer = setTimeout(() => {
    restartTimer = null;
    console.log(`[dev:backend] Restarting backend (${reason})...`);
    stopBackend();
    setTimeout(() => {
      if (!stopping) {
        startBackend();
      }
    }, 300);
  }, 150);
}

function watchRecursive(targetDir) {
  if (!fs.existsSync(targetDir)) return;

  try {
    const watcher = fs.watch(targetDir, { persistent: true }, (_eventType, filename) => {
      if (!filename) return;
      const changed = String(filename);
      if (
        changed.includes('node_modules') ||
        changed.includes('.git') ||
        changed.includes('dist') ||
        changed.endsWith('.log')
      ) {
        return;
      }

      restartBackend(changed);
    });

    watchers.push(watcher);
  } catch (_err) {
    // Some Windows folders may not support fs.watch reliably; ignore and continue.
  }

  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    watchRecursive(path.join(targetDir, entry.name));
  }
}

function setupWatchers() {
  const backendRoot = path.resolve(__dirname, '..', 'backend');
  const watchTargets = [
    path.join(backendRoot, 'src'),
    path.join(backendRoot, 'local-server.ts'),
    path.join(backendRoot, '.env'),
  ];

  for (const target of watchTargets) {
    if (!fs.existsSync(target)) continue;

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      watchRecursive(target);
      continue;
    }

    try {
      const watcher = fs.watch(target, { persistent: true }, () => {
        restartBackend(path.basename(target));
      });
      watchers.push(watcher);
    } catch (_err) {
      // Ignore unsupported watch targets.
    }
  }
}

function shutdown(signalName) {
  if (stopping) return;
  stopping = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  for (const watcher of watchers) {
    watcher.close();
  }
  watchers = [];

  stopBackend();

  setTimeout(() => {
    process.exit(0);
  }, 100);

  if (signalName) {
    console.log(`\n[dev:backend] Received ${signalName}. Shutting down...`);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

setupWatchers();
startBackend();
