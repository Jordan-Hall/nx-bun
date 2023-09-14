import { output } from 'nx/src/utils/output';
import { TaskStatus } from '../task-worker-runner';
import { getPrintableCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';
import { Task } from 'nx/src/config/task-graph';
import { formatTargetsAndProjects } from './formatting-utils';

/**
 * The following life cycle's outputs are static, meaning no previous content
 * is rewritten or modified as new outputs are added. It is therefore intended
 * for use in CI environments.
 *
 * For the common case of a user executing a command on their local machine,
 * the dynamic equivalent of this life cycle is usually preferable.
 */
export class StaticRunOneTerminalOutputLifeCycle implements LifeCycle {
  failedTasks = [] as Task[];
  cachedTasks = [] as Task[];

  constructor(
    private readonly initiatingProject: string,
    private readonly projectNames: string[],
    private readonly tasks: Task[],
    private readonly args: {
      targets?: string[];
      configuration?: string;
    }
  ) {}

  startCommand(): void {
    const numberOfDeps = this.tasks.length - 1;
    const title = `Running ${formatTargetsAndProjects(
      this.projectNames,
      this.args.targets,
      this.tasks
    )}:`;
    if (numberOfDeps > 0) {
      output.log({
        color: 'cyan',
        title,
      });
      output.addVerticalSeparatorWithoutNewLines('cyan');
    }
  }

  endCommand(): void {
    output.addNewline();

    if (this.failedTasks.length === 0) {
      output.addVerticalSeparatorWithoutNewLines('green');

      const bodyLines =
        this.cachedTasks.length > 0
          ? [
              output.dim(
                `Nx read the output from the cache instead of running the command for ${this.cachedTasks.length} out of ${this.tasks.length} tasks.`
              ),
            ]
          : [];

      output.success({
        title: `Successfully ran ${formatTargetsAndProjects(
          this.projectNames,
          this.args.targets,
          this.tasks
        )}`,
        bodyLines,
      });
    } else {
      output.addVerticalSeparatorWithoutNewLines('red');

      const bodyLines = [
        output.dim('Failed tasks:'),
        '',
        ...this.failedTasks.map((task) => `${output.dim('-')} ${task.id}`),
        '',
        `${output.dim('Hint: run the command with')} --verbose ${output.dim(
          'for more details.'
        )}`,
      ];
      output.error({
        title: `Running ${formatTargetsAndProjects(
          this.projectNames,
          this.args.targets,
          this.tasks
        )} failed`,
        bodyLines,
      });
    }
  }

  endTasks(
    taskResults: { task: Task; status: TaskStatus; code: number }[]
  ): void {
    for (const t of taskResults) {
      if (t.status === 'failure') {
        this.failedTasks.push(t.task);
      } else if (t.status === 'local-cache') {
        this.cachedTasks.push(t.task);
      } else if (t.status === 'local-cache-kept-existing') {
        this.cachedTasks.push(t.task);
      } else if (t.status === 'remote-cache') {
        this.cachedTasks.push(t.task);
      }
    }
  }

  printTaskTerminalOutput(
    task: Task,
    status: TaskStatus,
    terminalOutput: string
  ) {
    if (
      status === 'success' ||
      status === 'failure' ||
      task.target.project === this.initiatingProject
    ) {
      const args = getPrintableCommandArgsForTask(task);
      output.logCommand(args.join(' '), status);
      output.addNewline();
      process.stdout.write(terminalOutput);
    }
  }
}
