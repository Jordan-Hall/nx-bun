## @nx-bun/nx-bun:create

Use bun create generator and transform it instantly into nx-bun

### Usage

```bash
nx generate create ...
```

By default, Nx will search for `create` in the default collection provisioned in nx.json.

You can specify the collection explicitly as follows:

```bash
nx g @nx-bun/nx-bun:create ...
```

Show what will be generated without writing to disk:

```bash
nx g create ... --dry-run
```

### Options

#### name (_**required**_)

Type: `string`

#### template (_**required**_)

Type: `string`

#### type (_**required**_)

Default: `application`

Type: `string`

Possible values: `library`, `application`

The type of project

#### directory

Alias(es): d

Type: `string`

A directory where the project is placed

#### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib. Required for publishable library.

#### projectNameAndRootFormat

Type: `string`

Possible values: `as-provided`, `derived`

Whether to generate the project name and root directory as provided (`as-provided`) or generate them composing their values and taking the configured layout into account (`derived`).

#### publishable

Default: `false`

Type: `boolean`

Generate a publishable library.

#### rootProject (**hidden**)

Default: `false`

Type: `boolean`

Create node application at the root of the workspace

## @nx-bun/nx-bun:init

init generator

### Usage

```bash
nx generate init ...
```

By default, Nx will search for `init` in the default collection provisioned in nx.json.

You can specify the collection explicitly as follows:

```bash
nx g @nx-bun/nx-bun:init ...
```

Show what will be generated without writing to disk:

```bash
nx g init ... --dry-run
```

### Options

#### bunNXRuntime

Default: `false`

Type: `boolean`

Run NX in bun enviroment (experimental - loses support for nx-cloud)

#### unitTestRunner

Default: `bun`

Type: `string`

Possible values: `bun`, `jest`, `none`

Adds the specified unit test runner.

## @nx-bun/nx-bun:lib

lib generator

### Usage

```bash
nx generate lib ...
```

By default, Nx will search for `lib` in the default collection provisioned in nx.json.

You can specify the collection explicitly as follows:

```bash
nx g @nx-bun/nx-bun:lib ...
```

Show what will be generated without writing to disk:

```bash
nx g lib ... --dry-run
```

### Options

#### name (_**required**_)

Type: `string`

Library name.

#### directory

Alias(es): dir

Type: `string`

A directory where the lib is placed

#### importPath

Type: `string`

The library name used to import it, like @myorg/my-awesome-lib. Required for publishable library.

#### projectNameAndRootFormat

Type: `string`

Possible values: `as-provided`, `derived`

Whether to generate the project name and root directory as provided (`as-provided`) or generate them composing their values and taking the configured layout into account (`derived`).

#### publishable

Default: `false`

Type: `boolean`

Generate a publishable library.

#### rootProject (**hidden**)

Default: `false`

Type: `boolean`

Create node application at the root of the workspace

#### simpleName

Default: `false`

Type: `boolean`

Don't include the directory in the generated file name.

#### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

#### tags

Type: `string`

Add tags to the library (used for linting).

#### unitTestRunner

Default: `bun`

Type: `string`

Possible values: `bun`, `jest`, `none`

Adds the specified unit test runner.

## @nx-bun/nx-bun:application

Application generator

### Usage

```bash
nx generate application ...
```

By default, Nx will search for `application` in the default collection provisioned in nx.json.

You can specify the collection explicitly as follows:

```bash
nx g @nx-bun/nx-bun:application ...
```

Show what will be generated without writing to disk:

```bash
nx g application ... --dry-run
```

### Options

#### name (_**required**_)

Type: `string`

#### applicationType

Default: `api`

Type: `string`

Possible values: `api`, `none`

Generate the node application using a framework

#### directory

Type: `string`

The directory of the new application.

#### projectNameAndRootFormat

Type: `string`

Possible values: `as-provided`, `derived`

Whether to generate the project name and root directory as provided (`as-provided`) or generate them composing their values and taking the configured layout into account (`derived`).

#### rootProject (**hidden**)

Default: `false`

Type: `boolean`

Create node application at the root of the workspace

#### tags

Type: `string`

Add tags to the library (used for linting).
