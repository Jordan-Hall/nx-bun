import {
  formatFiles,
  generateFiles,
  names,
  Tree,
  TargetConfiguration,
  joinPathFragments,
  offsetFromRoot,
  GeneratorCallback,
  runTasksInSerial,
  NX_VERSION,
  ensurePackage,
  applyChangesToString,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';


import * as path from 'path';
import {
  determineProjectNameAndRootOptions,
  type ProjectNameAndRootOptions,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { LibGeneratorSchema,LibUnderhood } from './schema';
import { BundleExecutorSchema } from '../../executors/build/schema';
import { TestExecutorSchema } from '../../executors/test/schema';
import { getRootTsConfigPathInTree, updateTsConfig } from '../../utils/ts-config';
import initGenerator from '../init/init';
import { createSourceFile, ScriptTarget } from 'typescript';
import { addImport } from '../../utils/add-import';

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
  const tasks: GeneratorCallback[] = [
    await initGenerator(tree, { bunNXRuntime: false, forceBunInstall: false })
  ];
  if (opts.publishable === true && !opts.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  ensurePackage('@nx/js', NX_VERSION);
  const jsLibraryGenerator = await import ('@nx/js').then(m => m.libraryGenerator)
  const libraryInstall = await jsLibraryGenerator(tree, {
    ...opts,
    name: opts.name,
    bundler: 'none',
    includeBabelRc: opts.unitTestRunner !== 'bun' && opts.unitTestRunner !== 'none',
    importPath: opts.importPath,
    testEnvironment: 'node',
    unitTestRunner: opts.unitTestRunner === 'bun' ? 'none' : opts.unitTestRunner,
    skipFormat: true,
  });
  tasks.push(libraryInstall);

  const entryPoints =  [joinPathFragments(opts.projectRoot, 'src', 'index.ts')]
  

  createFiles(tree, opts)
  if (opts.publishable) {
    updateTsConfig(tree, { entryPoints: entryPoints, importPath: opts.importPath })
    updateProject(tree,opts, entryPoints);
  }
  await formatFiles(tree);

  return runTasksInSerial(...tasks);
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


function createFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    template: '',
    cliCommand: 'nx',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    baseTsConfig: getRootTsConfigPathInTree(tree)
  };
  generateFiles(tree, path.join(__dirname, 'files'), `${options.projectRoot}`, templateOptions);

  if (options.unitTestRunner === 'none') {
    tree.delete(
      joinPathFragments(options.projectRoot, `./src/lib/${options.fileName}.spec.ts`)
    );
  } else if (options.unitTestRunner === 'bun') {
    const file = joinPathFragments(options.projectRoot, `./src/lib/${options.fileName}.spec.ts`)
    const indexSource = tree.read(file, 'utf-8');
    if (indexSource !== null) {
      const indexSourceFile = createSourceFile(
        file,
        indexSource,
        ScriptTarget.Latest,
        true
      );
      const changes = applyChangesToString(
        indexSource,
        addImport(
          indexSourceFile,
          `import { expect, test, describe } from "bun:test";`
        )
      );
      tree.write(file, changes);
  }
  if (!options.publishable) {
    tree.delete(joinPathFragments(options.projectRoot, 'package.json'));
  }}
}


function updateProject(tree: Tree, options: NormalizedSchema, entryPoints: string[]) {
  const project = readProjectConfiguration(tree, options.projectName);
  project.targets = project.targets || {};
  const build: TargetConfiguration<BundleExecutorSchema> = {
    executor: '@nx-bun/nx:build',
    outputs: ["{options.outputPath}"],
    options: {
      entrypoints: entryPoints,
      outputPath: joinPathFragments(
        'dist',
        options.projectRoot ? options.name : options.projectRoot,
      ),
      tsconfig: joinPathFragments(options.projectRoot, `tsconfig.lib.json`),
      smol: false,
      bun: true
    }
  }

  project.targets['build'] = build

  if (options.unitTestRunner === 'bun') {
    const test: TargetConfiguration<TestExecutorSchema> = {
      executor: '@nx-bun/nx:test',
      options: {
        smol: false,
        bail: true,
        bun: false
      }
    }
    project.targets['test'] = test
  }
  updateProjectConfiguration(tree, options.projectName, project);
}

export default libGenerator;
