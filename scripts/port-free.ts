// Refuses to capture while another server holds the capture's port (#208). Expo would not
// serve this checkout there, yet waitForServer() would accept whatever already answers, so
// a run could shoot another worktree's code into the design handoff or a store listing.
// capture-screens.mjs and generate-play-listing-assets.mjs call it before starting their
// dev server.
import { createConnection } from 'node:net';

function answers(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

/** Throws when anything answers on `port`, on IPv4 or IPv6 loopback. */
export async function assertPortFree(port: number): Promise<void> {
  const held = await Promise.all([answers(port, '127.0.0.1'), answers(port, '::1')]);
  if (held.some(Boolean)) {
    throw new Error(
      `port ${port} is already in use, probably by another dev server (another worktree's?): stop it, then run this again`,
    );
  }
}
