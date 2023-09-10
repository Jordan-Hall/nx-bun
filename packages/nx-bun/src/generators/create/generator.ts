import {
  formatFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  Tree,
  updateJson,
} from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree'
import { CreateGeneratorSchema } from './schema';
import { executeCliWithLogging } from '../../utils/bun-cli';
import { join } from 'path';
import { NormalizedSchema } from './NormalizedSchema';
import { addProjectFromScript } from './add-project';
import * as semver from 'semver'
import initGenerator from '../init/init';
import { readdirSync, rmSync } from 'fs';
import { readFileIfExisting } from 'nx/src/utils/fileutils';
import { updateTsConfig } from '../../utils/ts-config';

export async function createGenerator(
  tree: FsTree,
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
  rmSync(`${opts.projectRoot}/node_modules`, { force: true, recursive: true })

  const bunLockPath = `${opts.projectRoot}/bun.lockb`;
  if (tree.exists(bunLockPath)) {
    tree.delete(bunLockPath)
  }
  tree.delete(`${opts.projectRoot}/.gitignore`)
  // we hack the changes into the change logs of the tree
  for (const filePath of walkSync(opts.projectRoot)) {
    const content = readFileIfExisting(filePath);

    ((tree as any).recordedChanges as Record<string, { content: Buffer | string, isDeleted: boolean, options: any }>)[(tree as any).rp(filePath)] = {
      content: Buffer.from(content),
      isDeleted: false,
      options,
    };
  }
  if (tree.exists(`${opts.projectRoot}/tsconfig.json`)) {
    updateJson(tree, `${opts.projectRoot}/tsconfig.json`, (file) => {
      file.extends = join(offsetFromRoot(opts.projectRoot), 'tsconfig.base.json')
      return file
    });
  }
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
  const scriptToRun = scripts.start ? scripts.start : scripts.dev ? scripts.dev : null;
  if (scriptToRun) {
    const baseFileToRun = findFileToRun(tree, scriptToRun, opts.projectRoot);
    if (baseFileToRun) {
      addProjectFromScript(tree, opts, baseFileToRun, 'serve')

      if (opts.publishable) {
        updateTsConfig(tree, { entryPoints: [joinPathFragments(opts.projectRoot, baseFileToRun)], importPath: opts.importPath })
      }
    
    }
  }

  if (process.env.NX_DRY_RUN) {
    rmSync(opts.projectRoot, { force: true, recursive: true })
  }

  await formatFiles(tree);
}


function* walkSync(dir) {
  const files = readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(join(dir, file.name));
    } else {
      yield join(dir, file.name);
    }
  }
}

function createArgs(
  options: NormalizedSchema
) {
  const args: string[] = ['create'];
  args.push(options.template);
  args.push(options.projectRoot)
  args.push('--no-git')
  args.push('--no-install')
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
    options.type === 'library' ? (layout.libsDir === '.' ? '' : layout.libsDir) : (layout.appsDir === '.' ? '' : layout.appsDir),
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


function findFileToRun(host: Tree, script: string, projectRoot: string) {
  const afterRun = script.split('run')[1].split(' ').filter(s => s.length);
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
