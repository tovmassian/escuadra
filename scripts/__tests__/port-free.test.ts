import { createServer, type AddressInfo, type Server } from 'node:net';
import { describe, expect, it } from 'vitest';
import { assertPortFree } from '../port-free';

/** A server on a free port the OS picks, on IPv4 loopback. */
function listen(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('assertPortFree', () => {
  it('throws, naming the port, while another server holds it', async () => {
    const server = await listen();
    const { port } = server.address() as AddressInfo;
    try {
      await expect(assertPortFree(port)).rejects.toThrow(`port ${port} is already in use`);
    } finally {
      server.close();
    }
  });

  it('passes once the port is free', async () => {
    const server = await listen();
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    await expect(assertPortFree(port)).resolves.toBeUndefined();
  });
});
