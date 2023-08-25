import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema } from './NormalizedSchema';
import { BundleExecutorSchema } from '../../executors/build/schema';

export function addProjectFromScript(host: Tree, opts: NormalizedSchema, file: string, type: 'serve' | 'test' | 'e2e') {
  const targets: ProjectConfiguration['targets'] = {};

  if (type === 'serve') {
    (targets.build as TargetConfiguration<BundleExecutorSchema> ) = {
      executor: '@nx-bun/nx:build',
        outputs: [
          joinPathFragments(
            'dist',
            opts.projectRoot ? opts.name : opts.projectRoot
          ),
        ],
        options: {
          entrypoints: [joinPathFragments(opts.projectRoot, file)],
          outputPath: joinPathFragments(
            'dist',
            opts.projectRoot ? opts.name : opts.projectRoot,
            file
          ),
          bun: false,
          smol: false,
        },
    };
    if (opts.type === 'application') {
      targets.serve = {
        executor: "@nx-bun/nx:run",
        defaultConfiguration: "development",
        options: {
          main: joinPathFragments(
            opts.projectRoot ? opts.name : opts.projectRoot,
            file
          ),
          watch: true
        }
      }
    }
  }

  const filePaths = file.split('/');
  const project: ProjectConfiguration = {
    root: opts.projectRoot,
    sourceRoot: joinPathFragments(opts.projectRoot,  filePaths.length > 1 ? filePaths[0] : ''),
    projectType: opts.type,
    targets,
    tags: [],
  };

  addProjectConfiguration(
    host,
    opts.projectName,
    project,
    true
  );
}
