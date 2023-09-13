/**
 * Originally from the Nx repo: https://github.com/nrwl/nx
 */

const fs = require('fs');
const { execSync } = require('child_process');

function checkLockFiles() {
  const errors = [];
  if (fs.existsSync('package-lock.json')) {
    errors.push(
      'Invalid occurence of "package-lock.json" file. Please remove it and use only "bun.lockb"'
    );
  }
  try {
    const content = execSync('./bun.lockb').toString();
    if (content.match(/localhost:487/)) {
      errors.push(
        'The "bun.lockb" has reference to local repository ("localhost:4873"). Please use ensure you disable local registry before running "bun install"'
      );
    }
    if (content.match(/resolution: \{tarball/)) {
      errors.push(
        'The "bun.lockb" has reference to tarball package. Please use npm registry only'
      );
    }
  } catch {
    errors.push('The "bun.lockb" does not exist or cannot be read');
  }
  return errors;
}

console.log('🔒🔒🔒 Validating lock files 🔒🔒🔒\n');
const invalid = checkLockFiles();
if (invalid.length > 0) {
  invalid.forEach((e) => console.log(e));
  process.exit(1);
} else {
  console.log('Lock file is valid 👍');
  process.exit(0);
}
