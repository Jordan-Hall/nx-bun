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
import { AppGeneratorSchema, AppTypes } from './schema';
import { BundleExecutorSchema } from '../../executors/build/schema';
import { TestExecutorSchema } from '../../executors/test/schema';
import { getRootTsConfigPathInTree } from '../../utils/ts-config';
import { RunExecutorSchema } from '../../executors/run/schema';
import initGenerator from '../init/init';


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

type AppStructure = {
  genFiles: () => void;
  packageInstall: () => void;
};
type ApplicationGeneration =  Partial<Record<AppTypes, AppStructure>>;
export async function appGenerator(tree: Tree, options: AppGeneratorSchema) {
  const opts = await normalizeOptions(tree, options);

  await initGenerator(tree, {bunNXRuntime: false, forceBunInstall: false})

  const entryPoints =  [joinPathFragments(opts.projectRoot, 'src', 'main.ts')]

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
      main: joinPathFragments(opts.projectRoot, 'src', 'main.ts'),
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

  createFiles(tree, opts)
  

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


function createFiles(tree: Tree, opts: NormalizedSchema) {

  const templateOptions = {
    ...opts,
    template: '',
    cliCommand: 'nx',
    offsetFromRoot: offsetFromRoot(opts.projectRoot),
    baseTsConfig: getRootTsConfigPathInTree(tree)
  };

  generateFiles(tree, path.join(__dirname, 'files/common'), `${opts.projectRoot}`, templateOptions);

  const applicationType: ApplicationGeneration = {
    'api': {
      genFiles: () => {
        tree.delete(joinPathFragments(opts.projectRoot, 'src', 'main.ts'));
        generateFiles(tree, path.join(__dirname, 'files/api'), `${opts.projectRoot}`, templateOptions);
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      packageInstall: () => {}
    },
  }

  const genAppDetails = applicationType[opts.applicationType];
  genAppDetails?.genFiles();
  genAppDetails?.packageInstall();
  
}

export default appGenerator;

