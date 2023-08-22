import {
  addProjectConfiguration,
  formatFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  Tree,
  updateJson,
} from '@nx/devkit';
import { CreateGeneratorSchema } from './schema';
import { executeCliWithLogging } from '../../utils/bun-cli';
import { join } from 'path';
import { NormalizedSchema } from './NormalizedSchema';
import { addProjectFromScript } from './add-project';
import * as semver from 'semver'
import initGenerator from '../init/generator';

export async function createGenerator(
  tree: Tree,
  options: CreateGeneratorSchema
) {
  await initGenerator(tree, {})

  const opts = normalizedSchema(tree, options);

  const args = createArgs(opts)
  await executeCliWithLogging(args, {
     stderr: 'inherit',
     stdin: 'inherit',
     stdio: 'inherit',
     stdout: 'inherit'
  })

  tree.delete(`${opts.projectRoot}/bun.lockb`)
  tree.delete(`${opts.projectRoot}/.gitignore`)
  updateJson(tree, `${opts.projectRoot}/tsconfig.json`, (file) => {
    file.extends = join(offsetFromRoot(opts.projectRoot), 'tsconfig.base.json')
    return file
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let scripts: Record<string, string> = {};
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  updateJson(tree, `${opts.projectRoot}/package.json`, (file) => {
    scripts = file.scripts
    dependencies = file.dependencies
    devDependencies = file.devDependencies
    file.dependencies = {}
    file.devDependencies = {}
    return file
  });

  updateJson(tree, 'package.json', (pkg) => {
    pkg.dependencies = mergeDependencies(pkg.dependencies, dependencies)
    pkg.devDependencies = mergeDependencies(pkg.devDependencies, devDependencies)
    return pkg
  });
  const scriptToRun = scripts.start ? scripts.start :  scripts.dev ? scripts.dev : null;
  if (scriptToRun) {
    const baseFileToRun = findFileToRun(tree, scriptToRun, opts.projectRoot);
    if (baseFileToRun) {
      addProjectFromScript(tree, opts, baseFileToRun, 'serve')
    }
  }

  await formatFiles(tree);
}

function createArgs(
  options: NormalizedSchema
) {
  const args: string[] = ['create'];
  args.push(options.template);
  args.push(options.projectRoot)
  args.push('--no-git')
  return args;
}

function normalizedSchema(tree: Tree, options: CreateGeneratorSchema): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const layout = getWorkspaceLayout(tree);
  const projectRoot = joinPathFragments(
    layout.libsDir === '.' ? '' : layout.libsDir,
    projectDirectory
  );
  return {
    ...options,
    name,
    projectDirectory,
    projectName,
    layout,
    projectRoot
  }
}


function findFileToRun(host:Tree, script: string, projectRoot: string) {
  const afterRun =  script.split('run')[1].split(' ').filter(s => s.length);
  return afterRun.find(path => host.exists(join(projectRoot, path)));
}

function mergeDependencies(dep1: Record<string, string>, dep2: Record<string, string>) {
  const merged = { ...dep1 };

  for (const pkg in dep2) {
    if (!merged[pkg]) {
      merged[pkg] = dep2[pkg];
    } else {
      // Compare versions and use the highest one
      const isLatest = dep2[pkg] === 'latest' || merged[pkg] === 'latest'
      merged[pkg] = isLatest ? 'latest' : semver.gt(dep2[pkg], merged[pkg]) ? dep2[pkg] : merged[pkg];
    }
  }

  return merged;
}

export default createGenerator;
