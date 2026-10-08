// deno run --no-config experiments/test-pure-resolution.mjs
// Run without filesystem/environment permissions to verify the browser boundary.
import { resolveConfig } from '../js/src/pure.js';

const config = resolveConfig({
  options: { port: { type: 'number' }, verbose: { type: 'boolean' } },
  env: Object.freeze({ PORT: '0', VERBOSE: false }),
});
if (config.port !== 0 || config.verbose !== false) {
  throw new Error('Pure resolution failed');
}
console.log('Pure object resolution works without fs/env permissions.');
