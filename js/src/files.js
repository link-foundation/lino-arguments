import { openSync, fstatSync, readSync, closeSync, constants } from 'node:fs';

/** Reads regular secret files with a finite allocation, including growing files. */
export function readSecretFile(path, { maxBytes }) {
  const descriptor = openSync(
    path,
    constants.O_RDONLY | (constants.O_NONBLOCK || 0)
  );
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile()) {
      throw new Error('Secret must be a regular file');
    }
    if (stat.size > maxBytes) {
      // The context checks the returned length and emits a redacted size error.
      return new Uint8Array(maxBytes + 1);
    }
    const bytes = new Uint8Array(maxBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(
        descriptor,
        bytes,
        length,
        bytes.length - length,
        null
      );
      if (count === 0) {
        break;
      }
      length += count;
    }
    return bytes.subarray(0, length);
  } finally {
    closeSync(descriptor);
  }
}
