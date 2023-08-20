import { workspaceConfigurationCheck } from 'nx/src/utils/workspace-configuration-check';
import { readNxJson } from 'nx/src/config/configuration';
import { NxArgs } from 'nx/src/utils/command-line-utils';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph';
import { Task, TaskGraph } from 'nx/src/config/task-graph';
import { invokeTasksRunner } from './run-command';
import { InvokeRunnerTerminalOutputLifeCycle } from './life-cycles/invoke-runner-terminal-output-life-cycle';

export async function initTasksRunner(nxArgs: NxArgs) {
  workspaceConfigurationCheck();
  const nxJson = readNxJson();
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  return {
    invoke: async (opts: {
      tasks: Task[];
      parallel: number;
    }): Promise<{ status: number; taskGraph: TaskGraph }> => {
      const lifeCycle = new InvokeRunnerTerminalOutputLifeCycle(opts.tasks);

      const taskGraph = {
        roots: opts.tasks.map((task) => task.id),
        tasks: opts.tasks.reduce((acc, task) => {
          acc[task.id] = task;
          return acc;
        }, {} as any),
        dependencies: opts.tasks.reduce((acc, task) => {
          acc[task.id] = [];
          return acc;
        }, {} as any),
      };

      const status = await invokeTasksRunner({
        tasks: opts.tasks,
        projectGraph,
        taskGraph,
        lifeCycle,
        nxJson,
        nxArgs: { ...nxArgs, parallel: opts.parallel },
        loadDotEnvFiles: true,
        initiatingProject: null,
      });

      return {
        status,
        taskGraph,
      };
    },
  };
}
