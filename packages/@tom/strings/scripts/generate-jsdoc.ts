import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");

function main(): void {
  const stringsFiles = findStringsFiles(REPO_ROOT);
  for (const filePath of stringsFiles) {
    processFile(filePath);
  }
}

function findStringsFiles(root: string): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "strings.ts") {
        results.push(fullPath);
      }
    }
  }
  walk(root);
  return results;
}

type Edit = { start: number; end: number; text: string };

function processFile(filePath: string): void {
  const sourceText = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ESNext, true);

  const edits: Edit[] = [];

  ts.forEachChild(sourceFile, function visit(node) {
    if (!ts.isVariableStatement(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === "phrases" && decl.initializer) {
        const objectLiteral = ts.isAsExpression(decl.initializer)
          ? decl.initializer.expression
          : decl.initializer;
        if (!ts.isObjectLiteralExpression(objectLiteral)) continue;
        for (const prop of objectLiteral.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isStringLiteral(prop.name) &&
            ts.isStringLiteral(prop.initializer)
          ) {
            const value = prop.initializer.text;
            const leadingComments = ts.getLeadingCommentRanges(sourceText, prop.getFullStart());
            const jsdocRanges: Array<{ start: number; end: number }> = [];
            let hasCorrectJsdoc = false;

            if (leadingComments) {
              for (const range of leadingComments) {
                const text = sourceText.slice(range.pos, range.end).trim();
                if (text.startsWith('/** "') && text.endsWith('" */')) {
                  jsdocRanges.push({ start: range.pos, end: range.end });
                  if (text.includes(`"${value}"`)) {
                    hasCorrectJsdoc = true;
                  }
                }
              }
            }

            if (hasCorrectJsdoc && jsdocRanges.length === 1) continue;

            const indent = getLineIndent(sourceText, prop.getStart());
            const newJsdoc = `/** "${value}" */\n${indent}`;

            if (jsdocRanges.length > 0) {
              edits.push({
                start: jsdocRanges[0].start,
                end: prop.getStart(),
                text: newJsdoc,
              });
            } else {
              edits.push({
                start: prop.getStart(),
                end: prop.getStart(),
                text: newJsdoc,
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  });

  if (edits.length === 0) return;

  edits.sort((a, b) => b.start - a.start);
  let result = sourceText;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }

  fs.writeFileSync(filePath, result);
  console.log(`Updated ${path.relative(REPO_ROOT, filePath)} (${edits.length} annotations)`);
}

function getLineIndent(sourceText: string, pos: number): string {
  let lineStart = pos;
  while (lineStart > 0 && sourceText[lineStart - 1] !== "\n") {
    lineStart--;
  }
  return sourceText.slice(lineStart, pos);
}

main();
