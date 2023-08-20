import { output } from 'nx/src/utils/output';
import { getPrintableCommandArgsForTask } from '../utils';
import type { LifeCycle } from '../life-cycle';
import { TaskStatus } from '../task-worker-runner';

export class EmptyTerminalOutputLifeCycle implements LifeCycle {
  printTaskTerminalOutput(
    task: any,
    cacheStatus: TaskStatus,
    terminalOutput: string
  ) {
    if (
      cacheStatus === 'success' ||
      cacheStatus === 'failure' ||
      cacheStatus === 'skipped'
    ) {
      const args = getPrintableCommandArgsForTask(task);
      output.logCommand(args.join(' '), cacheStatus);
      output.addNewline();
      process.stdout.write(terminalOutput);
    }
  }
}
