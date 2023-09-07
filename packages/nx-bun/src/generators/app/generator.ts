import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  readJson,
  names,
  Tree,
  TargetConfiguration,
  joinPathFragments,
  offsetFromRoot,
} from '@nx/devkit';

import * as path from 'path';
import {
  determineProjectNameAndRootOptions,
  type ProjectNameAndRootOptions,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { AppGeneratorSchema } from './schema';
import { BundleExecutorSchema } from '../../executors/build/schema';
import { TestExecutorSchema } from '../../executors/test/schema';
import { updateTsConfig } from '../../utils/ts-config';
import { RunExecutorSchema } from '../../executors/run/schema';

export interface NormalizedSchema extends AppGeneratorSchema {
  name: string;
  projectNames: ProjectNameAndRootOptions['names'];
  fileName: string;
  projectRoot: ProjectNameAndRootOptions['projectRoot'];
  projectName: ProjectNameAndRootOptions['projectName'];
  parsedTags: string[];
  importPath?: ProjectNameAndRootOptions['importPath']
  propertyName: string
}

export async function appGenerator(tree: Tree, options: AppGeneratorSchema) {
  const opts = await normalizeOptions(tree, options);

  const entryPoints =  [joinPathFragments(opts.projectRoot, 'src', 'index.ts')]

  const templateOptions = {
    ...opts,
    template: '',
    cliCommand: 'nx',
    offsetFromRoot: offsetFromRoot(opts.projectRoot)
  };

  const build: TargetConfiguration<BundleExecutorSchema> = {
    executor: '@nx-bun/nx:build',
    outputs: ["{options.outputPath}"],
    options: {
      entrypoints: entryPoints,
      outputPath: joinPathFragments(
        'dist',
        opts.projectRoot ? opts.name : opts.projectRoot,
      ),
      smol: false,
      bun: true
    }
  }

  const serve: TargetConfiguration<RunExecutorSchema> = {
    executor: '@nx-bun/nx:run',
    defaultConfiguration: "development",
    options: {
      main: joinPathFragments(opts.projectRoot, 'src', 'index.ts'),
      watch: true,
      hot: true,
      bun: true,
      smol: false
    }
  }

  const test: TargetConfiguration<TestExecutorSchema> = {
    executor: '@nx-bun/nx:test',
    options: {
      smol: false,
      bail: true,
      bun: true
    }
  }


  addProjectConfiguration(tree, options.name, {
    root: opts.projectRoot,
    projectType: 'application',
    sourceRoot: `${opts.projectRoot}/src`,
    targets: {
      build,
      serve,
      test
    },
  });

  generateFiles(tree, path.join(__dirname, 'files'), `${opts.projectRoot}`, templateOptions);

  await formatFiles(tree);
}

async function normalizeOptions(
  tree: Tree,
  options: AppGeneratorSchema
): Promise<NormalizedSchema> {

  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
  });


  const fileName = getCaseAwareFileName({
    fileName: projectNames.projectFileName,
    pascalCaseFiles: false
  });

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    fileName,
    name: projectName,
    projectNames,
    projectName,
    propertyName: names(fileName).propertyName,
    projectRoot,
    parsedTags,
    importPath,
  };
}

function getCaseAwareFileName(options: {
  pascalCaseFiles: boolean;
  fileName: string;
}) {
  const normalized = names(options.fileName);

  return options.pascalCaseFiles ? normalized.className : normalized.fileName;
}



export default appGenerator;
