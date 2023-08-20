import { NxJsonConfiguration } from 'nx/src/config/nx-json';
import { ProjectGraph } from 'nx/src/config/project-graph';
import { Task, TaskGraph } from 'nx/src/config/task-graph';
import { NxArgs } from 'nx/src/utils/command-line-utils';
import { TaskHasher } from 'nx/src/hasher/task-hasher';
import { DaemonClient } from 'nx/src/daemon/client/client';

export type TaskStatus =
  | 'success'
  | 'failure'
  | 'skipped'
  | 'local-cache-kept-existing'
  | 'local-cache'
  | 'remote-cache';

/**
 * `any | Promise<{ [id: string]: TaskStatus }>`
 * will change to Promise<{ [id: string]: TaskStatus }> after Nx 15 is released.
 */
export type TasksRunner<T = unknown> = (
  tasks: Task[],
  options: T,
  context?: {
    target?: string;
    initiatingProject?: string | null;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
    taskGraph?: TaskGraph;
    hasher?: TaskHasher;
    daemon?: DaemonClient;
  }
) => any | Promise<{ [id: string]: TaskStatus }>;
