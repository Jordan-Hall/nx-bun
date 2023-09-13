// originally from nx repo https://github.com/nrwl/nx/blob/master/e2e/utils

import { ProjectConfiguration, TargetConfiguration } from '@nx/devkit';
import { tmpProjPath, runCommandAsync } from '@nx/plugin/testing';
import { ChildProcess, exec } from 'child_process';
import * as isCI from 'is-ci';
import { ensureDirSync, readFileSync, writeFileSync } from 'fs-extra';
import { dirname } from 'path';

export function getStrippedEnvironmentVariables() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => {
      if (key.startsWith('NX_E2E_')) {
        return true;
      }

      if (key.startsWith('NX_')) {
        return false;
      }

      if (key === 'JEST_WORKER_ID') {
        return false;
      }

      return true;
    })
  );
}

export function updateJson<T extends object = any, U extends object = T>(
  f: string,
  updater: (value: T) => U
) {
  updateFile(f, (s) => {
    const json = JSON.parse(s);
    return JSON.stringify(updater(json), null, 2);
  });
}

export function updateFile(
  f: string,
  content: string | ((content: string) => string)
): void {
  ensureDirSync(dirname(tmpProjPath(f)));
  if (typeof content === 'string') {
    writeFileSync(tmpProjPath(f), content);
  } else {
    writeFileSync(
      tmpProjPath(f),
      content(readFileSync(tmpProjPath(f)).toString())
    );
  }
}

export interface RunCmdOpts {
  silenceError?: boolean;
  env?: Record<string, string | undefined>;
  cwd?: string;
  silent?: boolean;
  verbose?: boolean;
  redirectStderr?: boolean;
}

/**
 * Sets maxWorkers in CI on all projects that require it
 * so that it doesn't try to run it with 34 workers
 *
 * maxWorkers required for: node, web, jest
 */
export function setMaxWorkers(projectJsonPath: string) {
  if (isCI) {
    updateJson<ProjectConfiguration>(projectJsonPath, (project) => {
      const { build } = project.targets as {
        [targetName: string]: TargetConfiguration<any>;
      };

      if (!build) {
        return;
      }

      const executor = build.executor as string;
      if (
        executor.startsWith('@nx/node') ||
        executor.startsWith('@nx/web') ||
        executor.startsWith('@nx-bun/nx') ||
        executor.startsWith('@nx/jest')
      ) {
        build.options.maxWorkers = 4;
      }

      return project;
    });
  }
}

export function runCommandUntil(
  command: string,
  criteria: (output: string) => boolean,
  options: {
    cwd: string;
  }
): Promise<ChildProcess> {
  const p = exec(`npx nx ${command}`, {
    cwd: options.cwd,
    encoding: 'utf-8',
    env: {
      CI: 'true',
      ...getStrippedEnvironmentVariables(),
      FORCE_COLOR: 'false',
    },
  });
  return new Promise((res, rej) => {
    let output = '';
    let complete = false;

    function checkCriteria(c) {
      output += c.toString();
      if (criteria(stripConsoleColors(output)) && !complete) {
        complete = true;
        res(p);
      }
    }

    p.stdout?.on('data', checkCriteria);
    p.stderr?.on('data', checkCriteria);
    p.on('exit', (code) => {
      if (!complete) {
        console.error(
          `Original output:`,
          output
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')
        );
        rej(`Exited with ${code}`);
      } else {
        res(p);
      }
    });
  });
}

export function runCLIAsync(
  command: string,
  opts: RunCmdOpts = {
    silenceError: false,
    env: getStrippedEnvironmentVariables(),
    silent: false,
  }
) {
  opts = {
    silenceError: false,
    env: getStrippedEnvironmentVariables(),
    silent: false,
    ...opts,
  };
  return runCommandAsync(`$npx nx ${command}`, opts);
}

/**
 * Remove log colors for fail proof string search
 * @param log
 * @returns
 */
export function stripConsoleColors(log: string): string {
  return log?.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}
