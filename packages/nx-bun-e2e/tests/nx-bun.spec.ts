import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { uniq } from '@nx/plugin/testing';
import { runCommandUntil } from '../src/utils/commmand';
import { promisifiedTreeKill } from '../src/utils/process-utils';
import { stripIndents } from '@nx/devkit';

// Detect environment
const isBun = typeof globalThis.Bun !== 'undefined';

export async function assertBunAvailable(forceInstall = false) {
  try {
    if (isBun) {
      globalThis.Bun.spawnSync({ cmd: ['bun', '--version'] });
      return Promise.resolve(true);
    } else {
      const { execSync } = await import('child_process');
      execSync('bun --version');
      return Promise.resolve(true);
    }
  } catch (e) {
    if (forceInstall && !process.env.NX_DRY_RUN) {
      const { execSync } = await import('child_process');
      execSync(`curl -fsSL https://bun.sh/install | bash`);
      return Promise.resolve(true);
    } else if (forceInstall) {
      throw new Error(
        stripIndents`force install of bun is not supported in dry-run`
      );
    }
    throw new Error(stripIndents`Unable to find Bun on your system.
        Bun will need to be installed in order to run targets from nx-bun in this workspace.
        You can learn how to install bun at https://bun.sh/docs/installation
      `);
  }
}

describe('nx-bun', () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = createTestProject();

    // The plugin has been built and published to a local registry in the jest globalSetup
    // Install the plugin built with the latest source code into the test repo
    execSync(`npm install @nx-bun/nx@e2e`, {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: process.env,
    });
  });

  afterAll(() => {
    // Cleanup the test project
    rmSync(projectDirectory, {
      recursive: true,
      force: true,
    });
  });

  it('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    execSync('npm ls @nx-bun/nx', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
  });

  describe('Bun app', () => {
    it('Bun application should serve', async () => {
      const plugin = uniq('bun');
      execSync(
        `npx nx generate @nx-bun/nx:application ${plugin} --applicationType=api --projectNameAndRootFormat=as-provided --no-interactive`,
        {
          cwd: projectDirectory,
          stdio: 'inherit',
          env: process.env,
        }
      );
      const poc = await runCommandUntil(
        `run ${plugin}:serve`,
        (output) => output.includes('running on port http://localhost:8080'),
        { cwd: projectDirectory }
      );
      await promisifiedTreeKill(poc.pid as number, 'SIGKILL');
    }, 300_000);

    it('should build application', async () => {
      const plugin = uniq('bun');
      execSync(
        `npx nx generate @nx-bun/nx:application ${plugin} --applicationType=api --projectNameAndRootFormat=as-provided --no-interactive`,
        {
          cwd: projectDirectory,
          stdio: 'inherit',
          env: process.env,
        }
      );

      const poc = await runCommandUntil(
        `run ${plugin}:build`,
        (output) =>
          output.includes('Build completed for') && output.includes(plugin),
        { cwd: projectDirectory }
      );
      await promisifiedTreeKill(poc.pid as number, 'SIGKILL');
    }, 300_000);
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
function createTestProject() {
  const projectName = 'test-project';
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

  // Ensure projectDirectory is empty
  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
  mkdirSync(dirname(projectDirectory), {
    recursive: true,
  });

  execSync(
    `npx --yes create-nx-workspace@latest ${projectName} --preset empty --no-nxCloud --no-interactive`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    }
  );
  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}
