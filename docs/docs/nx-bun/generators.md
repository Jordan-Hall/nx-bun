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
