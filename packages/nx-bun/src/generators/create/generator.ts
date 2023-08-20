import {
  addProjectConfiguration,
  formatFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
import { CreateGeneratorSchema } from './schema';
import { assertBunAvailable, executeCliWithLogging } from '../../utils/bun-cli';

interface NormalizedSchema extends CreateGeneratorSchema {
  projectDirectory: string;
  projectName: string;
  projectRoot: string;
  layout: {
    appsDir: string;
    libsDir: string;
    standaloneAsDefault: boolean;
  }
}

export async function createGenerator(
  tree: Tree,
  options: CreateGeneratorSchema
) {
  assertBunAvailable();

  const opts = normalizedSchema(tree, options);


  const args = createArgs(opts)
  await executeCliWithLogging(args)

  debugger;
  // addProjectConfiguration(tree, options.name, {
  //   root: projectRoot,
  //   projectType: layout.,
  //   sourceRoot: `${projectRoot}/src`,
  //   targets: {},
  //   name
  // });
  // generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);
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


export default createGenerator;
