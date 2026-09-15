// Shared Metro/expo-web dev server lifecycle for scripts that drive the web
// build with Playwright (capture-screens.mjs, generate-play-listing-assets.mjs).
// Pulled out so the Windows process-tree-kill fix only has to exist once.
import { spawn, spawnSync } from 'node:child_process';

export function startExpoWeb(port) {
  return spawn('npx', ['expo', 'start', '--web', '--port', String(port)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, BROWSER: 'none', CI: '1' },
  });
}

export async function waitForServer(base, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Metro did not serve ${base} within ${timeoutMs}ms`);
}

// On Windows, spawning with `shell: true` makes the direct child a cmd.exe
// wrapper around the real `npx expo start --web` process tree. `server.kill()`
// only terminates that cmd.exe shell, leaving the Metro/expo grandchildren
// running and holding the port — the next run's waitForServer() then talks to
// the stale, orphaned server instead of a fresh one. `taskkill /T` kills the
// whole process tree rooted at the shell's PID.
export function killServerTree(server) {
  if (!server.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  } else {
    server.kill();
  }
}
