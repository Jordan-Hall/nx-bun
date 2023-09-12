## @nx-bun/nx:run

Run a JavaScript or TypeScript program in Bun

Options can be configured in the 'project.json' when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

### Options

#### buildTarget

Type: `string`

The target to run to build you the app.

#### bun

Default: `false`

Type: `boolean`

Force a script or package to use Bun.js instead of Node.js (via symlinking node)

#### config

Type: `string`

Config file to load bun from (e.g. -c bunfig.toml

#### hot

Default: `true`

Type: `boolean`

Enable auto reload in bun's JavaScript runtime

#### smol

Default: `false`

Type: `boolean`

In memory-constrained environments, use the smol flag to reduce memory usage at a cost to performance.

#### tsconfig

Type: `string`

Load tsconfig from path instead of cwd/tsconfig.json

#### watch

Default: `false`

Type: `boolean`

To run a file in watch mode

## @nx-bun/nx:build

Bundle your program using bun.bundle

Options can be configured in the 'project.json' when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

### Options

#### entrypoints (_**required**_)

Type: `array`

The entry points for the bundler.

#### outputPath (_**required**_)

Type: `string`

The output directory for the bundled files.

#### complie

Default: `false`

Type: `boolean`

Bun supports "compiling" a JavaScript/TypeScript entrypoint into a standalone executable. This executable contains a copy of the Bun binary.

#### config

Type: `string`

Config file to load bun from (e.g. -c bunfig.toml

#### external

Type: `array`

List of external dependencies that should not be bundled.

#### format

Default: `esm`

Type: `string`

The format of the bundled files.

#### minify

Default: `false`

Type: `boolean`

Whether to minify the bundled files or not.

#### naming

Type: `string`

#### publicPath

Type: `string`

Public path for the bundled assets.

#### smol

Default: `false`

Type: `boolean`

In memory-constrained environments, use the smol flag to reduce memory usage at a cost to performance.

#### sourcemap

Default: `none`

Type: `string`

Possible values: `none`, `inline`, `external`

Whether to generate sourcemaps for the bundled files or not.

#### splitting

Default: `false`

Type: `boolean`

Whether to enable code splitting or not.

#### target

Type: `string`

Possible values: `bun`, `node`, `browser`

The target environment for the bundler.

#### tsconfig

Type: `string`

Load tsconfig from path instead of cwd/tsconfig.json

## @nx-bun/nx:test

Bun ships with a fast built-in test runner. Tests are executed with the Bun runtime

Options can be configured in the 'project.json' when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

### Options

#### bail

Default: `true`

Type: `boolean | number `

abort the test run early after a pre-determined number of test failures. By default Bun will run all tests and report all failures, but sometimes in CI environments it's preferable to terminate earlier to reduce CPU usage.

#### bun

Default: `false`

Type: `boolean`

Force a script or package to use Bun.js instead of Node.js (via symlinking node)

#### config

Type: `string`

Config file to load bun from (e.g. -c bunfig.toml

#### preload

Type: `string`

Bun test lifecycle hooks in separate files

#### rerun-each

Type: `number`

run each test multiple times. This is useful for detecting flaky or non-deterministic test failures.

#### smol

Default: `false`

Type: `boolean`

In memory-constrained environments, use the smol flag to reduce memory usage at a cost to performance.

#### timeout

Default: `5000`

Type: `number`

specify a per-test timeout in milliseconds. If a test times out, it will be marked as failed. The default value is 5000.

#### tsconfig

Type: `string`

Load tsconfig from path instead of cwd/tsconfig.json

#### watch

Type: `boolean`

to watch for changes and re-run tests.
