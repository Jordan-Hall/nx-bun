/**
 * Originally from the Nx repo: https://github.com/nrwl/nx
 */

if (process.argv.slice(2).some((arg) => arg.includes('bun.lockb'))) {
  console.warn(
    [
      '⚠️ ----------------------------------------------------------------------------------------- ⚠️',
      '⚠️ bun.lockb changed, please run `bun install` to ensure your packages are up to date. ⚠️',
      '⚠️ ----------------------------------------------------------------------------------------- ⚠️',
    ].join('\n')
  );
}
