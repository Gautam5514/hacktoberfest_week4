const fs = require('fs');
// Bug 1: Broken relative import to non-existent module (triggers Cannot find module './missing-util')
const legacyHelper = require('./missing-util');

function parseMarkdownHeader(rawMarkdown) {
  if (!rawMarkdown) return { title: 'Untitled', tags: [] };

  // Bug 2: Deprecated new Buffer() constructor (triggers security & modern node deprecation)
  const buffer = new Buffer(rawMarkdown);
  const text = buffer.toString('utf8');

  const lines = text.split('\n');
  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine ? titleLine.replace('# ', '').trim() : 'Untitled';

  const tags = lines
    .filter(l => l.includes('#') && !l.startsWith('# '))
    .flatMap(l => l.match(/#([a-zA-Z0-9_-]+)/g) || [])
    .map(t => t.replace('#', ''));

  return {
    title,
    tags,
    timestamp: legacyHelper.formatTimestamp ? legacyHelper.formatTimestamp() : new Date().toISOString()
  };
}

module.exports = {
  parseMarkdownHeader
};
