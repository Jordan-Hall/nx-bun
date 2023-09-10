import { stripIndents, workspaceRoot } from '@nx/devkit';
import type { SpawnOptions, Subprocess } from 'bun';
import { ChildProcess, spawn } from 'node:child_process';
import { parentPort, workerData, } from 'worker_threads';

// Detect environment
const isBun = typeof globalThis.Bun !== 'undefined';

// Unified interfaces
type ExecOptions = BunExecOptions | NodeExecOptions;

type BunExecOptions = {
  cwd?: string;
  stdin?: SpawnOptions.Readable;
  stdout?: SpawnOptions.Writable;
  stderr?: SpawnOptions.Writable;
};

type NodeExecOptions = {
  cwd?: string;
  stdio?: 'inherit' | 'pipe';
};


function isBunExecOptions(options: ExecOptions): options is BunExecOptions {
  return isBun;
}

function isNodeExecOptions(options: ExecOptions): options is NodeExecOptions {
  return !isBun;
}


export type UnifiedChildProcess = ChildProcess | Subprocess<any, any, any>;

export function isBunSubprocess(process: UnifiedChildProcess): process is Subprocess<any, any, any> {
  return isBun && 'exited' in process;
}

export async function assertBunAvailable(forceInstall = false) {
  try {
    if (isBun) {
      Bun.spawnSync({ cmd: ['bun', '--version'] });
      return Promise.resolve(true);
    } else {
      const { execSync } = await import('child_process');
      execSync('bun --version');
      return Promise.resolve(true);
    }
  } catch (e) {
    if (!forceInstall) {
      const { execSync } = await import('child_process');
      execSync(`curl -fsSL https://bun.sh/install | bash`)
      return Promise.resolve(true);
    }
    throw new Error(stripIndents`Unable to find Bun on your system.
        Bun will need to be installed in order to run targets from nx-bun in this workspace.
        You can learn how to install bun at https://bun.sh/docs/installation
      `);
  }
}

export async function getBunVersion(): Promise<string | null> {
  try {
    let output: string;
    if (isBun) {
      const result = Bun.spawnSync({ cmd: ['bun', '--version'] });
      output = result.stdout?.toString().trim() || '';
    } else {
      const { execSync } = await import('child_process');
      output = execSync('bun --version').toString().trim();
    }
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    return versionMatch ? versionMatch[1] : output;
  } catch (error) {
    console.error(`Failed to retrieve the version for bun.`);
    return null;
  }
}

export async function executeCliAsync(args: string[], options: ExecOptions = {}): Promise<UnifiedChildProcess> {
  // TODO: Get bun spawn working. Cant get anything out of it
  if (isBun) {
    if (isBunExecOptions(options)) {
      const childProcess = Bun.spawn(['bun', ...args], {
        cwd: options.cwd || workspaceRoot,
        env: {...process.env, ...(workerData || {})},
        stdin: options.stdin || 'ignore',
        stdout: options.stdout || isBun ? 'pipe' : 'pipe',
        stderr: options.stderr || isBun ? 'pipe' : 'pipe',
      });

      if (isBunSubprocess(childProcess)) {
        return Promise.resolve(childProcess);
      }
    }
  } else {
    if (isNodeExecOptions(options)) {
      return spawn('bun', args, {
        cwd: options.cwd || workspaceRoot,
        env: {...process.env, ...(workerData || {})},
        windowsHide: true,
        stdio: (options as NodeExecOptions).stdio || 'pipe',
      })
    }
  }
}

export async function executeCliWithLogging(args: string[], options: ExecOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    executeCliAsync(args, options).then(child => {
      if (isBunSubprocess(child)) {
        if (child.stdout) {
          const stdoutReader = (child.stdout as ReadableStream).getReader();
          stdoutReader.read().then(({ value, done }) => {
            if (!done && value) {
              const stdout = new TextDecoder().decode(value)
              if (parentPort) {
                parentPort.postMessage({
                  type: 'stdout',
                  message: stdout
                })
              }
              console.log(`stdout: ${stdout}`);
            }
          });

        }

        if (child.stderr) {
          const stderrReader = (child.stderr as ReadableStream).getReader();
          stderrReader.read().then(({ value, done }) => {
            const stderr = new TextDecoder().decode(value)
            if (!done && value) {
              if (parentPort) {
                parentPort.postMessage({
                  type: 'stdout',
                  message: stderr
                })
              }
              console.error(`stderr: ${stderr}`);
            }
          });
        }

        child.exited.then((code) => {
          if (code !== 0) {
            reject(new Error(`child process exited with code ${code}`));
          } else {
            resolve(true);
          }
        });
      } else {
        if (child.stdout) {
          child.stdout.on('data', (data) => {
            if (parentPort) {
              parentPort.postMessage({
                type: 'stdout',
                message: data
              })
            }
            console.log(`stdout: ${data}`);
          });
        }

        if (child.stderr) {
          child.stderr.on('data', (data) => {
            parentPort.postMessage({
              type: 'stderr',
              message: data
            })
            console.error(`stderr: ${data}`);
          });
        }

        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`child process exited with code ${code}`));
          } else {
            resolve(true);
          }
        });
      }
    });
  });
}
