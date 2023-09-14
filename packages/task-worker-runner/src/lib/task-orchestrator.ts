import { defaultMaxListeners } from 'events';
import { TaskHasher } from 'nx/src/hasher/task-hasher';
import { ForkedProcessTaskRunner } from './forked-process-task-worker-runner';
import { Cache } from './cache';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { TaskStatus } from './task-worker-runner';
import {
  calculateReverseDeps,
  getExecutorForTask,
  getOutputs,
  isCacheableTask,
  removeTasksFromTaskGraph,
  shouldStreamOutput,
} from './utils';
import { Batch, TasksSchedule } from './tasks-schedule';
import { TaskMetadata } from './life-cycle';
import { ProjectGraph } from 'nx/src/config/project-graph';
import { Task, TaskGraph } from 'nx/src/config/task-graph';
import { DaemonClient } from 'nx/src/daemon/client/client';

export class TaskOrchestrator {
  private cache: Cache;
  private forkedProcessTaskRunner: ForkedProcessTaskRunner;

  private tasksSchedule: TasksSchedule;

  // region internal state
  private reverseTaskDeps: Record<string, string[]>;
  private completedTasks: {
    [id: string]: TaskStatus;
  } = {};
  // eslint-disable-next-line @typescript-eslint/ban-types
  private waitingForTasks: Function[] = [];

  private groups = [];

  private bailed = false;

  // endregion internal state

  constructor(
    private readonly hasher: TaskHasher,
    private readonly initiatingProject: string | undefined,
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly options: DefaultTasksRunnerOptions,
    private readonly bail: boolean,
    private readonly daemon: DaemonClient
  ) {
    this.tasksSchedule = new TasksSchedule(
      hasher,
      projectGraph,
      taskGraph,
      options
    );
    this.reverseTaskDeps = calculateReverseDeps(this.taskGraph);
    this.cache = new Cache(this.options);
    this.forkedProcessTaskRunner = new ForkedProcessTaskRunner(this.options);
  }

  async run() {
    // initial scheduling
    await this.tasksSchedule.scheduleNextTasks();

    const threads = [];

    process.stdout.setMaxListeners(this.options.parallel + defaultMaxListeners);
    process.stderr.setMaxListeners(this.options.parallel + defaultMaxListeners);

    // initial seeding of the queue
    for (let i = 0; i < this.options.parallel; ++i) {
      threads.push(this.executeNextBatchOfTasksUsingTaskSchedule());
    }
    await Promise.all(threads);
    this.cache.removeOldCacheRecords();

    return this.completedTasks;
  }

  private async executeNextBatchOfTasksUsingTaskSchedule() {
    // completed all the tasks
    if (!this.tasksSchedule.hasTasks() || this.bailed) {
      return null;
    }

    const doNotSkipCache =
      this.options.skipNxCache === false ||
      this.options.skipNxCache === undefined;

    const batch = this.tasksSchedule.nextBatch();
    if (batch) {
      const groupId = this.closeGroup();

      await this.applyFromCacheOrRunBatch(doNotSkipCache, batch, groupId);

      this.openGroup(groupId);

      return this.executeNextBatchOfTasksUsingTaskSchedule();
    }

    const task = this.tasksSchedule.nextTask();
    if (task) {
      const groupId = this.closeGroup();

      await this.applyFromCacheOrRunTask(doNotSkipCache, task, groupId);

      this.openGroup(groupId);

      return this.executeNextBatchOfTasksUsingTaskSchedule();
    }

    // block until some other task completes, then try again
    return new Promise((res) => this.waitingForTasks.push(res)).then(() =>
      this.executeNextBatchOfTasksUsingTaskSchedule()
    );
  }

  // region Applying Cache
  private async applyCachedResults(tasks: Task[]): Promise<
    {
      task: Task;
      status: 'local-cache' | 'local-cache-kept-existing' | 'remote-cache';
    }[]
  > {
    const cacheableTasks = tasks.filter((t) =>
      isCacheableTask(t, this.options)
    );
    const res = await Promise.all(
      cacheableTasks.map((t) => this.applyCachedResult(t))
    );
    return res.filter((r) => r !== null);
  }

  private async applyCachedResult(task: Task): Promise<{
    task: Task;
    status: 'local-cache' | 'local-cache-kept-existing' | 'remote-cache';
  }> {
    task.startTime = Date.now();
    const cachedResult = await this.cache.get(task);
    if (!cachedResult || cachedResult.code !== 0) return null;

    const outputs = getOutputs(this.projectGraph.nodes, task);
    const shouldCopyOutputsFromCache =
      !!outputs.length &&
      (await this.shouldCopyOutputsFromCache(outputs, task.hash));
    if (shouldCopyOutputsFromCache) {
      await this.cache.copyFilesFromCache(task.hash, cachedResult, outputs);
    }
    task.endTime = Date.now();
    const status = cachedResult.remote
      ? 'remote-cache'
      : shouldCopyOutputsFromCache
      ? 'local-cache'
      : 'local-cache-kept-existing';
    this.options.lifeCycle.printTaskTerminalOutput(
      task,
      status,
      cachedResult.terminalOutput
    );
    return {
      task,
      status,
    };
  }

  // endregion Applying Cache

  // region Batch
  private async applyFromCacheOrRunBatch(
    doNotSkipCache: boolean,
    batch: Batch,
    groupId: number
  ) {
    const taskEntries = Object.entries(batch.taskGraph.tasks);
    const tasks = taskEntries.map(([, task]) => task);

    await this.preRunSteps(tasks, { groupId });

    const results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[] = doNotSkipCache ? await this.applyCachedResults(tasks) : [];

    // Run tasks that were not cached
    if (results.length !== taskEntries.length) {
      const unrunTaskGraph = removeTasksFromTaskGraph(
        batch.taskGraph,
        results.map(({ task }) => task.id)
      );

      const batchResults = await this.runBatch({
        executorName: batch.executorName,
        taskGraph: unrunTaskGraph,
      });

      results.push(...batchResults);
    }

    await this.postRunSteps(tasks, results, doNotSkipCache, { groupId });

    const tasksCompleted = taskEntries.filter(
      ([taskId]) => this.completedTasks[taskId]
    );

    // Batch is still not done, run it again
    if (tasksCompleted.length !== taskEntries.length) {
      await this.applyFromCacheOrRunBatch(
        doNotSkipCache,
        {
          executorName: batch.executorName,
          taskGraph: removeTasksFromTaskGraph(
            batch.taskGraph,
            tasksCompleted.map(([taskId]) => taskId)
          ),
        },
        groupId
      );
    }
  }

  private async runBatch(batch: Batch) {
    try {
      const results = await this.forkedProcessTaskRunner.forkProcessForBatch(
        batch,
        this.taskGraph
      );
      const batchResultEntries = Object.entries(results);
      return batchResultEntries.map(([taskId, result]) => ({
        ...result,
        task: {
          ...this.taskGraph.tasks[taskId],
          startTime: result.startTime,
          endTime: result.endTime,
        },
        status: (result.success ? 'success' : 'failure') as TaskStatus,
        terminalOutput: result.terminalOutput,
      }));
    } catch (e) {
      return batch.taskGraph.roots.map((rootTaskId) => ({
        task: this.taskGraph.tasks[rootTaskId],
        status: 'failure' as TaskStatus,
      }));
    }
  }

  // endregion Batch

  // region Single Task
  private async applyFromCacheOrRunTask(
    doNotSkipCache: boolean,
    task: Task,
    groupId: number
  ) {
    await this.preRunSteps([task], { groupId });

    // hash the task here
    const results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[] = doNotSkipCache ? await this.applyCachedResults([task]) : [];

    // the task wasn't cached
    if (results.length === 0) {
      // cache prep
      const { code, terminalOutput } = await this.runTaskInForkedProcess(task);

      results.push({
        task,
        status: code === 0 ? 'success' : 'failure',
        terminalOutput,
      });
    }
    await this.postRunSteps([task], results, doNotSkipCache, { groupId });
  }

  private async runTaskInForkedProcess(task: Task) {
    try {
      // obtain metadata
      const temporaryOutputPath = this.cache.temporaryOutputPath(task);
      const streamOutput = shouldStreamOutput(
        task,
        this.initiatingProject,
        this.options
      );

      const pipeOutput = await this.pipeOutputCapture(task);

      // execution
      const { code, terminalOutput } = pipeOutput
        ? await this.forkedProcessTaskRunner.forkProcessPipeOutputCapture(
            task,
            {
              temporaryOutputPath,
              streamOutput,
              taskGraph: this.taskGraph,
            }
          )
        : await this.forkedProcessTaskRunner.forkProcessDirectOutputCapture(
            task,
            {
              temporaryOutputPath,
              streamOutput,
              taskGraph: this.taskGraph,
            }
          );

      return {
        code,
        terminalOutput,
      };
    } catch (e) {
      return {
        code: 1,
      };
    }
  }

  // endregion Single Task

  // region Lifecycle
  private async preRunSteps(tasks: Task[], metadata: TaskMetadata) {
    this.options.lifeCycle.startTasks(tasks, metadata);
  }

  private async postRunSteps(
    tasks: Task[],
    results: {
      task: Task;
      status: TaskStatus;
      terminalOutput?: string;
    }[],
    doNotSkipCache: boolean,
    { groupId }: { groupId: number }
  ) {
    for (const task of tasks) {
      await this.recordOutputsHash(task);
    }

    if (doNotSkipCache) {
      // cache the results
      await Promise.all(
        results
          .filter(
            ({ status }) =>
              status !== 'local-cache' &&
              status !== 'local-cache-kept-existing' &&
              status !== 'remote-cache' &&
              status !== 'skipped'
          )
          .map((result) => ({
            ...result,
            code:
              result.status === 'local-cache' ||
              result.status === 'local-cache-kept-existing' ||
              result.status === 'remote-cache' ||
              result.status === 'success'
                ? 0
                : 1,
            outputs: getOutputs(this.projectGraph.nodes, result.task),
          }))
          .filter(({ task, code }) => this.shouldCacheTaskResult(task, code))
          .filter(({ terminalOutput, outputs }) => terminalOutput || outputs)
          .map(async ({ task, code, terminalOutput, outputs }) =>
            this.cache.put(task, terminalOutput, outputs, code)
          )
      );
    }
    this.options.lifeCycle.endTasks(
      results.map((result) => {
        const code =
          result.status === 'success' ||
          result.status === 'local-cache' ||
          result.status === 'local-cache-kept-existing' ||
          result.status === 'remote-cache'
            ? 0
            : 1;
        return {
          ...result,
          task: result.task,
          status: result.status,
          code,
        };
      }),
      { groupId }
    );

    this.complete(
      results.map(({ task, status }) => {
        return {
          taskId: task.id,
          status,
        };
      })
    );

    await this.tasksSchedule.scheduleNextTasks();

    // release blocked threads
    this.waitingForTasks.forEach((f) => f(null));
    this.waitingForTasks.length = 0;
  }

  private complete(
    taskResults: {
      taskId: string;
      status: TaskStatus;
    }[]
  ) {
    this.tasksSchedule.complete(taskResults.map(({ taskId }) => taskId));

    for (const { taskId, status } of taskResults) {
      if (this.completedTasks[taskId] === undefined) {
        this.completedTasks[taskId] = status;

        if (status === 'failure' || status === 'skipped') {
          if (this.bail) {
            // mark the execution as bailed which will stop all further execution
            // only the tasks that are currently running will finish
            this.bailed = true;
          } else {
            // only mark the packages that depend on the current task as skipped
            // other tasks will continue to execute
            this.complete(
              this.reverseTaskDeps[taskId].map((depTaskId) => ({
                taskId: depTaskId,
                status: 'skipped',
              }))
            );
          }
        }
      }
    }
  }

  //endregion Lifecycle

  // region utils

  private async pipeOutputCapture(task: Task) {
    try {
      const { schema } = await getExecutorForTask(task, this.projectGraph);

      return (
        schema.outputCapture === 'pipe' ||
        process.env.NX_STREAM_OUTPUT === 'true'
      );
    } catch (e) {
      return false;
    }
  }

  private shouldCacheTaskResult(task: Task, code: number) {
    return (
      isCacheableTask(task, this.options) &&
      (process.env.NX_CACHE_FAILURES == 'true' ? true : code === 0)
    );
  }

  private closeGroup() {
    for (let i = 0; i < this.options.parallel; i++) {
      if (!this.groups[i]) {
        this.groups[i] = true;
        return i;
      }
    }
  }

  private openGroup(id: number) {
    this.groups[id] = false;
  }

  private async shouldCopyOutputsFromCache(outputs: string[], hash: string) {
    if (this.daemon?.enabled()) {
      return !(await this.daemon.outputsHashesMatch(outputs, hash));
    } else {
      return true;
    }
  }

  private async recordOutputsHash(task: Task) {
    if (this.daemon?.enabled()) {
      return this.daemon.recordOutputsHash(
        getOutputs(this.projectGraph.nodes, task),
        task.hash
      );
    }
  }

  // endregion utils
}
