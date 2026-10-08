/**
 * Convert string to UPPER_CASE (for environment variables)
 * @param {string} str - Input string
 * @returns {string} UPPER_CASE string
 */
export function toUpperCase(str) {
  // If already all uppercase, just replace separators
  if (str === str.toUpperCase()) {
    return str.replace(/[-\s]/g, '_');
  }

  return str
    .replace(/([A-Z])/g, '_$1') // PascalCase/camelCase
    .replace(/[-\s]/g, '_') // kebab-case/spaces
    .toUpperCase()
    .replace(/^_/, '') // Remove leading underscore
    .replace(/__+/g, '_'); // Remove double underscores
}

/**
 * Convert string to camelCase (for config object keys)
 * @param {string} str - Input string
 * @returns {string} camelCase string
 */
export function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Convert string to kebab-case (for CLI options)
 * @param {string} str - Input string
 * @returns {string} kebab-case string
 */
export function toKebabCase(str) {
  // If already all uppercase, handle specially
  if (str === str.toUpperCase() && str.includes('_')) {
    return str.replace(/_/g, '-').toLowerCase();
  }

  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/[_\s]/g, '-')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/--+/g, '-');
}

/**
 * Convert string to snake_case
 * @param {string} str - Input string
 * @returns {string} snake_case string
 */
export function toSnakeCase(str) {
  // If already all uppercase, just lowercase
  if (str === str.toUpperCase() && str.includes('_')) {
    return str.toLowerCase();
  }

  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]/g, '_')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

/**
 * Convert string to PascalCase
 * @param {string} str - Input string
 * @returns {string} PascalCase string
 */
export function toPascalCase(str) {
  return str
    .toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}
