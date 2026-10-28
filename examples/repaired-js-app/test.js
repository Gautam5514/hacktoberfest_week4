const assert = require('assert');

console.log('Running test suite for resurrected markdown-tomb-parser...');

try {
  const { parseMarkdownHeader } = require('./index');

  const sample = '# Project Resurrection\nThis is a sample document #hacktoberfest #gemma';
  const result = parseMarkdownHeader(sample);

  assert.strictEqual(result.title, 'Project Resurrection');
  assert(result.tags.includes('hacktoberfest'));
  assert(result.tags.includes('gemma'));
  assert(typeof result.timestamp === 'string');

  console.log('✓ All 4 resurrection tests passed! Code is fully operational on Node 20+');
  process.exit(0);
} catch (err) {
  console.error('✗ Test execution failed with error:');
  console.error(err.message);
  process.exit(1);
}
