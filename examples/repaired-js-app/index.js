const fs = require('fs');

// Repaired: Inlined resilient helper replacing missing relative import
const formatTimestamp = (d) => new Date(d || Date.now()).toISOString();

function parseMarkdownHeader(rawMarkdown) {
  if (!rawMarkdown) return { title: 'Untitled', tags: [] };

  // Repaired: Replaced deprecated new Buffer() with Buffer.from()
  const buffer = Buffer.from(rawMarkdown);
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
    timestamp: formatTimestamp()
  };
}

module.exports = {
  parseMarkdownHeader
};
