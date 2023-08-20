import { stripIndents, workspaceRoot } from '@nx/devkit';
import type { SpawnOptions, Subprocess } from 'bun';
import { ChildProcess, spawn } from 'child_process';

// Detect environment
const isBun = typeof Bun !== 'undefined';

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

export async function assertBunAvailable() {
  try {
    if (isBun) {
      Bun.spawnSync({ cmd: ['bun', '--version'] });
    } else {
      const { execSync } = await import('child_process');
      execSync('bun --version');
    }
  } catch (e) {
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
  if (isBun) {
    if (isBunExecOptions(options)) {
      const childProcess = Bun.spawn(['bun', ...args], {
        cwd: options.cwd || workspaceRoot,
        env: process.env,
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
        env: process.env,
        windowsHide: true,
        stdio: options.stdio || 'inherit',
      })
    }
  }
  throw new Error("Unable to create child process.");
}

export async function executeCliWithLogging(args: string[], options: ExecOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    executeCliAsync(args, options).then(child => {
      if (isBunSubprocess(child)) {
        if (child.stdout) {
          const stdoutReader = (child.stdout as ReadableStream).getReader();
          stdoutReader.read().then(({ value, done }) => {
            if (!done && value) {
              console.log(`stdout: ${new TextDecoder().decode(value)}`);
            }
          });

        }

        if (child.stderr) {
          const stderrReader = (child.stderr as ReadableStream).getReader();
          stderrReader.read().then(({ value, done }) => {
            if (!done && value) {
              console.error(`stderr: ${new TextDecoder().decode(value)}`);
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
        child.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        child.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
        });

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
