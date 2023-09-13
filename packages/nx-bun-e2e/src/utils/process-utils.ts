import { promisify } from 'util';
import treeKill from 'tree-kill';
import { check as portCheck } from 'tcp-port-used';

import kill from 'kill-port';
const KILL_PORT_DELAY = 5000;

export const promisifiedTreeKill: (
  pid: number,
  signal: string
) => Promise<void> = promisify(treeKill);

export async function killPort(port: number): Promise<boolean> {
  if (await portCheck(port)) {
    try {
      console.log(`Attempting to close port ${port}`);
      await kill(port);
      await new Promise<void>((resolve) =>
        setTimeout(() => resolve(), KILL_PORT_DELAY)
      );
      if (await portCheck(port)) {
        console.error(`Port ${port} still open`);
      } else {
        console.log(`Port ${port} successfully closed`);
        return true;
      }
    } catch {
      console.error(`Port ${port} closing failed`);
    }
    return false;
  } else {
    return true;
  }
}

export async function killPorts(port?: number): Promise<boolean> {
  return port
    ? await killPort(port)
    : (await killPort(3333)) && (await killPort(4200));
}

export async function killProcessAndPorts(
  pid: number | undefined,
  ...ports: number[]
): Promise<void> {
  try {
    if (pid) {
      await promisifiedTreeKill(pid, 'SIGKILL');
    }
    for (const port of ports) {
      await killPort(port);
    }
  } catch (err) {
    expect(err).toBeFalsy();
  }
}
