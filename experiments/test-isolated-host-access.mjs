// Report only changed names, never environment values.
import { makeConfig } from '../js/src/index.js';
const before = { ...process.env };
makeConfig({ env: {}, lenv: { enabled: false }, argv: ['node', 'app.js'] });
const after = { ...process.env };
const changed = [
  ...new Set([...Object.keys(before), ...Object.keys(after)]),
].filter((key) => before[key] !== after[key]);
console.log(JSON.stringify({ changed }));
if (changed.length) {
  throw new Error('Injected context changed host environment');
}
