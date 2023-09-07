import { Tree, stripIndents, updateJson, writeJson } from '@nx/devkit';

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
    const newPaths = options.entryPoints.map(entry =>
        entry.startsWith('./')
            ? entry.slice(2)
            : entry)
    if (!tree.exists(rootTsConfig)) {
        writeJson(tree, rootTsConfig, {
            compileOnSave: false,
            compilerOptions: {
                rootDir: ".",
                sourceMap: true,
                declaration: false,
                moduleResolution: "node",
                emitDecoratorMetadata: true,
                experimentalDecorators: true,
                importHelpers: true,
                target: "ES2021",
                module: "ES2022",
                lib: ["es2020", "dom"],
                types: ["bun-types", "node"],
                esModuleInterop: true,
                forceConsistentCasingInFileNames: true,
                strict: true,
                skipLibCheck: true,
                skipDefaultLibCheck: true,
                baseUrl: ".",
                paths: {
                    [options.importPath]: newPaths
                }
            },
            exclude: ["node_modules", "tmp"]
        })
    }
    updateJson(tree, rootTsConfig, (json) => {
        json.compilerOptions.paths = json.compilerOptions?.paths || {};
        if (json.compilerOptions.paths[options.importPath]) {
            throw new Error(stripIndents`Import path already exists in ${rootTsConfig} for ${options.importPath}.
You can specify a different import path using the --import-path option.
The value needs to be unique and not already used in the ${rootTsConfig} file.`);
        }

        json.compilerOptions.paths[options.importPath] = newPaths;

        return json;
    })
}