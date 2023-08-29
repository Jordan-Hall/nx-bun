import { Tree, stripIndents, updateJson } from '@nx/devkit';

export function getRootTsConfigPathInTree(tree: Tree): string | null {
    for (const path of ['tsconfig.base.json', 'tsconfig.json']) {
        if (tree.exists(path)) {
            return path;
        }
    }

    return 'tsconfig.base.json';
}
export interface TsConfigPaths {
    compilerOptions: { paths?: Record<string, string[]>; baseUrl?: string };
}


export function updateTsConfig(tree: Tree, options: { importPath: string, entryPoints: string[] }) {
    const rootTsConfig = getRootTsConfigPathInTree(tree);
    if (!tree.exists(rootTsConfig)) {
        throw new Error(stripIndents`Could not find root tsconfig to add the import path to.
        This means a root level tsconfig.json or tsconfig.base.json file is not preset but is expected when using the --add-node-entrypoint flag`);
    }
    updateJson(tree, rootTsConfig, (json) => {
        json.compilerOptions.paths = json.compilerOptions?.paths || {};
        if (json.compilerOptions.paths[options.importPath]) {
            throw new Error(stripIndents`Import path already exists in ${rootTsConfig} for ${options.importPath}.
You can specify a different import path using the --import-path option.
The value needs to be unique and not already used in the ${rootTsConfig} file.`);
        }

        json.compilerOptions.paths[options.importPath] = [
            ...options.entryPoints.map(entry => 
                entry.startsWith('./')
                    ? entry.slice(2)
                    : entry,
                )
        ];

        return json;
    })
}