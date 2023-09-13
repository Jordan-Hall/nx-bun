import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema } from './NormalizedSchema';
import { BundleExecutorSchema } from '../../executors/build/schema';
import { RunExecutorSchema } from '../../executors/run/schema';

export function addProjectFromScript(
  host: Tree,
  opts: NormalizedSchema,
  file: string,
  type: 'serve' | 'test' | 'e2e'
) {
  const targets: ProjectConfiguration['targets'] = {};

  if (type === 'serve') {
    (targets.build as TargetConfiguration<BundleExecutorSchema>) = {
      executor: '@nx-bun/nx:build',
      outputs: ['{options.outputPath}'],
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
      (targets.serve as TargetConfiguration<RunExecutorSchema>) = {
        executor: '@nx-bun/nx:run',
        defaultConfiguration: 'development',
        options: {
          buildTarget: `${opts.projectName}:build`,
          watch: true,
          hot: true,
          bun: true,
          smol: false,
        },
      };
    }
  }

  const filePaths = file.split('/');
  const project: ProjectConfiguration = {
    root: opts.projectRoot,
    sourceRoot: joinPathFragments(
      opts.projectRoot,
      filePaths.length > 1 ? filePaths[0] : ''
    ),
    projectType: opts.type,
    targets,
    tags: [],
  };

  addProjectConfiguration(host, opts.projectName, project, true);
}
