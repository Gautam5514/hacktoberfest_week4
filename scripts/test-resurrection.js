const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('  THE LAST COMMIT - AUTOMATED VERIFICATION SUITE   ');
console.log('  Hacktoberfest 2026 · Week 4 · DevChallenge       ');
console.log('====================================================\n');

const brokenDir = path.join(__dirname, '../examples/broken-js-app');
const repairedDir = path.join(__dirname, '../examples/repaired-js-app');

// 1. Test Broken App (Should fail reproducibly)
console.log('▶ [1/3] Executing baseline check on broken specimen (examples/broken-js-app)...');
try {
  execSync('node test.js', { cwd: brokenDir, stdio: 'pipe' });
  console.error('❌ Error: Expected broken sample to fail, but it passed.');
  process.exit(1);
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  console.log('✓ Expected baseline failure confirmed:');
  console.log('  ' + stderr.split('\n')[0]);
  console.log('  Exit code: ' + (err.status || 1));
}

// 2. Test Repaired App (Should pass cleanly)
console.log('\n▶ [2/3] Executing verification check on repaired specimen (examples/repaired-js-app)...');
try {
  const stdout = execSync('node test.js', { cwd: repairedDir, stdio: 'pipe' }).toString();
  console.log('✓ Repaired specimen verified cleanly:');
  console.log('  ' + stdout.trim());
} catch (err) {
  console.error('❌ Error: Repaired sample failed: ' + err.message);
  process.exit(1);
}

// 3. Verify Artifact Integrity
console.log('\n▶ [3/3] Auditing codebase structure & Next.js pages...');
const expectedFiles = [
  'src/app/page.tsx',
  'src/app/graveyard/page.tsx',
  'src/app/lab/[id]/page.tsx',
  'src/app/lab/[id]/autopsy/page.tsx',
  'src/app/lab/[id]/ghost/page.tsx',
  'src/app/lab/[id]/resurrection/page.tsx',
  'src/app/lab/[id]/report/page.tsx',
  'src/app/settings/page.tsx',
  'src/lib/scanner.ts',
  'src/lib/ghost-ai.ts',
  'src/lib/resurrection.ts',
  'src/lib/store.ts'
];

let allExist = true;
for (const file of expectedFiles) {
  const full = path.join(__dirname, '..', file);
  if (!fs.existsSync(full)) {
    console.error('❌ Missing expected file: ' + file);
    allExist = false;
  }
}

if (allExist) {
  console.log('✓ All 12 core architecture files and routes verified.\n');
  console.log('====================================================');
  console.log('  ✓ ALL RESURRECTION ACCEPTANCE CRITERIA PASSED!   ');
  console.log('====================================================');
  process.exit(0);
} else {
  process.exit(1);
}
