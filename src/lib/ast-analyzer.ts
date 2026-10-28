import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { AutopsyFinding, FindingCategory, FindingSeverity } from './types';

export interface AstDiagnostic {
  file: string;
  lineStart: number;
  colStart: number;
  lineEnd: number;
  colEnd: number;
  nodeKind: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  snippet: string;
  explanation: string;
  proposedFix: string;
  verification: string;
}

export function analyzeFileAst(filePath: string, relativePath: string, repoRoot: string): AstDiagnostic[] {
  const diagnostics: AstDiagnostic[] = [];
  if (!fs.existsSync(filePath)) return diagnostics;

  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    relativePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.ts') || relativePath.endsWith('.tsx') ? ts.ScriptKind.TS : ts.ScriptKind.JS
  );

  function visit(node: ts.Node) {
    // 1. Detect `new Buffer(...)`
    if (ts.isNewExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === 'Buffer') {
        const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const snippet = node.getText(sourceFile);

        diagnostics.push({
          file: relativePath,
          lineStart: startLine + 1,
          colStart: startCol + 1,
          lineEnd: endLine + 1,
          colEnd: endCol + 1,
          nodeKind: 'NewExpression(Buffer)',
          title: `Insecure new Buffer() constructor invocation`,
          category: 'security',
          severity: 'high',
          snippet,
          explanation: `The new Buffer() constructor is deprecated since Node.js 6. It poses security vulnerabilities because allocating integer sizes leaves uninitialized memory exposed.`,
          proposedFix: `Replace ${snippet} with Buffer.from(...) for string/array data, or Buffer.alloc(...) for buffer allocations.`,
          verification: `Ensure code executes without DEP0005 deprecation warnings on Node 22.`
        });
      }
    }

    // 2. Detect `crypto.createCipher(...)`, `fs.exists(...)`, `sys.puts(...)`, `util.print(...)`
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sourceFile);

      if (callText === 'crypto.createCipher') {
        const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        diagnostics.push({
          file: relativePath,
          lineStart: startLine + 1,
          colStart: startCol + 1,
          lineEnd: endLine + 1,
          colEnd: endCol + 1,
          nodeKind: 'CallExpression(crypto.createCipher)',
          title: 'Removed crypto.createCipher() usage',
          category: 'security',
          severity: 'critical',
          snippet: node.getText(sourceFile),
          explanation: `crypto.createCipher uses MD5 with zero initialization vector (IV) and was permanently removed in modern Node.js versions.`,
          proposedFix: `Migrate to crypto.createCipheriv() with an explicit initialization vector (IV) and a strong key derivation function.`,
          verification: `Verify cipher operations complete on modern Node.js.`
        });
      } else if (callText === 'fs.exists') {
        const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        diagnostics.push({
          file: relativePath,
          lineStart: startLine + 1,
          colStart: startCol + 1,
          lineEnd: endLine + 1,
          colEnd: endCol + 1,
          nodeKind: 'CallExpression(fs.exists)',
          title: 'Deprecated fs.exists() callback pattern',
          category: 'runtime',
          severity: 'medium',
          snippet: node.getText(sourceFile),
          explanation: `fs.exists does not follow the standard Node.js (err, result) callback signature and leads to race conditions.`,
          proposedFix: `Replace with fs.existsSync, fs.stat, or fs.promises.access.`,
          verification: `Confirm filesystem checks pass without callback errors.`
        });
      } else if (callText === 'sys.puts' || callText === 'util.print') {
        const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        diagnostics.push({
          file: relativePath,
          lineStart: startLine + 1,
          colStart: startCol + 1,
          lineEnd: endLine + 1,
          colEnd: endCol + 1,
          nodeKind: `CallExpression(${callText})`,
          title: `Obsolete ${callText}() runtime method`,
          category: 'runtime',
          severity: 'high',
          snippet: node.getText(sourceFile),
          explanation: `${callText} was removed from the Node.js standard library and causes fatal runtime crashes.`,
          proposedFix: `Replace with console.log() or process.stdout.write().`,
          verification: `Confirm output logs without ReferenceError.`
        });
      }

      // 3. Detect require('./...') broken local imports via AST
      if (callText === 'require' && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (ts.isStringLiteral(firstArg)) {
          const importPath = firstArg.text;
          if (importPath.startsWith('.')) {
            const resolvedPath = path.resolve(path.dirname(filePath), importPath);
            const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.json', '/index.js', '/index.ts'];
            const exists = extensions.some(ext => fs.existsSync(resolvedPath + ext));

            if (!exists) {
              const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
              diagnostics.push({
                file: relativePath,
                lineStart: startLine + 1,
                colStart: startCol + 1,
                lineEnd: endLine + 1,
                colEnd: endCol + 1,
                nodeKind: 'CallExpression(require)',
                title: `Broken local module import: "${importPath}"`,
                category: 'runtime',
                severity: 'critical',
                snippet: node.getText(sourceFile),
                explanation: `AST traversal resolved require("${importPath}") to non-existent disk path ${resolvedPath}. This triggers an immediate Cannot find module runtime exception.`,
                proposedFix: `Restore the missing module or replace with an inlined resilient helper.`,
                verification: `Confirm module resolution succeeds during runtime execution.`
              });
            }
          }
        }
      }
    }

    // 4. Detect ES Module `import ... from './...'` broken imports via AST
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), importPath);
          const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.json', '/index.js', '/index.ts'];
          const exists = extensions.some(ext => fs.existsSync(resolvedPath + ext));

          if (!exists) {
            const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
            diagnostics.push({
              file: relativePath,
              lineStart: startLine + 1,
              colStart: startCol + 1,
              lineEnd: endLine + 1,
              colEnd: endCol + 1,
              nodeKind: 'ImportDeclaration',
              title: `Broken ES Module import: "${importPath}"`,
              category: 'runtime',
              severity: 'critical',
              snippet: node.getText(sourceFile),
              explanation: `File imports from "${importPath}", but the module does not exist on disk.`,
              proposedFix: `Update import specifier or provide the missing module.`,
              verification: `Confirm ESM bundle or execution resolves the module cleanly.`
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return diagnostics;
}
