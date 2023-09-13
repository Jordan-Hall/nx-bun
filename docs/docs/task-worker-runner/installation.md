# Getting Started

At this current moment we don't have an out of the back workspace setup. In order to use @nx-bun/task-worker-runner you need to create a new NX workspace.

```bash
npx create-nx-workspace --preset=empty
```

After creating the blank workspace. Run the following commands

```bash
npm install @nx-bun/task-worker-runner -D
```

After modify nx.json "tasksRunnerOptions" so the runner using @nx-bun/task-worker-runner

```
"tasksRunnerOptions": {
    "default": {
      "runner": "@nx-bun/task-worker-runner",
      "options": {
        "cacheableOperations": [
          "lint",
          "test",
          "e2e"
        ]
      }
    }
  }
```
