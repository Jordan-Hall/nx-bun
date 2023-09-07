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
import { LibGeneratorSchema,LibUnderhood } from './schema';
import { BundleExecutorSchema } from '../../executors/build/schema';
import { TestExecutorSchema } from '../../executors/test/schema';
import { updateTsConfig } from '../../utils/ts-config';

export interface NormalizedSchema extends LibUnderhood {
  name: string;
  projectNames: ProjectNameAndRootOptions['names'];
  fileName: string;
  projectRoot: ProjectNameAndRootOptions['projectRoot'];
  projectName: ProjectNameAndRootOptions['projectName'];
  parsedTags: string[];
  importPath?: ProjectNameAndRootOptions['importPath']
  propertyName: string
}

export async function libGenerator(tree: Tree, options: LibGeneratorSchema) {
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

  const test: TargetConfiguration<TestExecutorSchema> = {
    executor: '@nx-bun/nx:test',
    options: {
      smol: false,
      bail: true,
      bun: false
    }
  }


  addProjectConfiguration(tree, options.name, {
    root: opts.projectRoot,
    projectType: 'library',
    sourceRoot: `${opts.projectRoot}/src`,
    targets: {
      build,
      test
    },
  });

  generateFiles(tree, path.join(__dirname, 'files'), `${opts.projectRoot}`, templateOptions);

  if (opts.publishable) {
    updateTsConfig(tree, { entryPoints: entryPoints, importPath: opts.importPath })
  }
  await formatFiles(tree);
}

async function normalizeOptions(
  tree: Tree,
  options: LibGeneratorSchema
): Promise<NormalizedSchema> {

  if (options.publishable) {
    if (!options.importPath) {
      throw new Error(
        `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
      );
    }
  }

  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
  });


  const fileName = getCaseAwareFileName({
    fileName: options.simpleName
      ? projectNames.projectSimpleName
      : projectNames.projectFileName,
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



export default libGenerator;
