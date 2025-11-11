/**
 * 🎯 Icon Size Migration Script
 * Автоматическая миграция inline размеров иконок на ICON_SIZES токены
 * 
 * Usage: node migrate-icons.js <directory>
 * Example: node migrate-icons.js src/components/polls
 */

const fs = require('fs');
const path = require('path');

// Mapping: size prop → ICON_SIZES token
const SIZE_TO_TOKEN = {
  '12': 'xs',
  '16': 'sm',
  '20': 'md',
  '24': 'lg',
  '32': 'xl',
  '48': '2xl',
};

// Mapping: Tailwind class → ICON_SIZES token
const CLASS_TO_TOKEN = {
  'size-3': 'xs',
  'w-3 h-3': 'xs',
  'size-4': 'sm',
  'w-4 h-4': 'sm',
  'size-5': 'md',
  'w-5 h-5': 'md',
  'size-6': 'lg',
  'w-6 h-6': 'lg',
  'size-8': 'xl',
  'w-8 h-8': 'xl',
  'size-12': '2xl',
  'w-12 h-12': '2xl',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let addImport = false;

  // Check if ICON_SIZES is already imported
  const hasIconSizesImport = /import.*ICON_SIZES.*from.*design-tokens/.test(content);

  // Pattern 1: size={number} prop
  content = content.replace(
    /\b([A-Z][a-zA-Z]*)\s+(className="[^"]*")?\s*size=\{(\d+)\}/g,
    (match, iconName, className, size) => {
      const token = SIZE_TO_TOKEN[size];
      if (!token) {
        console.warn(`  ⚠️  Unknown size: ${size} in ${match}`);
        return match;
      }

      modified = true;
      addImport = true;

      if (className) {
        // Has className - merge with ICON_SIZES
        const cleanClass = className.slice(11, -1); // Remove className=" and "
        const accessor = token === '2xl' ? `['${token}']` : `.${token}`;
        return `${iconName} className={\`\${ICON_SIZES${accessor}} ${cleanClass}\`}`;
      } else {
        // No className - just use ICON_SIZES
        const accessor = token === '2xl' ? `['${token}']` : `.${token}`;
        return `${iconName} className={ICON_SIZES${accessor}}`;
      }
    }
  );

  // Pattern 2: className="size-X" or className="w-X h-X"
  content = content.replace(
    /className="([^"]*)(size-\d+|w-\d+\s+h-\d+)([^"]*)"/g,
    (match, before, sizeClass, after) => {
      const token = CLASS_TO_TOKEN[sizeClass];
      if (!token) {
        console.warn(`  ⚠️  Unknown class: ${sizeClass} in ${match}`);
        return match;
      }

      modified = true;
      addImport = true;

      const otherClasses = (before + after).trim();
      const accessor = token === '2xl' ? `['${token}']` : `.${token}`;
      if (otherClasses) {
        return `className={\`\${ICON_SIZES${accessor}} ${otherClasses}\`}`;
      } else {
        return `className={ICON_SIZES${accessor}}`;
      }
    }
  );

  // Pattern 3: className={cn("size-X", ...)}
  content = content.replace(
    /className=\{cn\(["']([^"']*)(size-\d+|w-\d+\s+h-\d+)([^"']*)[\"']/g,
    (match, before, sizeClass, after) => {
      const token = CLASS_TO_TOKEN[sizeClass];
      if (!token) {
        console.warn(`  ⚠️  Unknown class: ${sizeClass} in ${match}`);
        return match;
      }

      modified = true;
      addImport = true;

      const otherClasses = (before + after).trim();
      const accessor = token === '2xl' ? `['${token}']` : `.${token}`;
      if (otherClasses) {
        return `className={cn(ICON_SIZES${accessor}, "${otherClasses}"`;
      } else {
        return `className={cn(ICON_SIZES${accessor}`;
      }
    }
  );

  // Add import if needed
  if (addImport && !hasIconSizesImport) {
    // Find last import statement
    const importRegex = /^import .+ from .+;$/gm;
    const imports = content.match(importRegex);
    if (imports) {
      const lastImport = imports[imports.length - 1];
      const importPath = filePath.includes('src/components')
        ? '@/lib/design-tokens'
        : filePath.includes('src/pages')
        ? '../lib/design-tokens'
        : '@/lib/design-tokens';

      content = content.replace(
        lastImport,
        `${lastImport}\nimport { ICON_SIZES } from '${importPath}';`
      );
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let totalProcessed = 0;
  let totalModified = 0;

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const result = processDirectory(fullPath);
      totalProcessed += result.processed;
      totalModified += result.modified;
    } else if (file.match(/\.(tsx|ts|jsx|js)$/)) {
      totalProcessed++;
      console.log(`Processing: ${fullPath}`);
      const wasModified = processFile(fullPath);
      if (wasModified) {
        totalModified++;
        console.log(`  ✅ Modified`);
      } else {
        console.log(`  ⏭️  No changes`);
      }
    }
  });

  return { processed: totalProcessed, modified: totalModified };
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node migrate-icons.js <directory>');
  console.error('Example: node migrate-icons.js src/components/polls');
  process.exit(1);
}

const targetDir = args[0];
if (!fs.existsSync(targetDir)) {
  console.error(`Error: Directory not found: ${targetDir}`);
  process.exit(1);
}

console.log('🚀 Starting icon size migration...\n');
const result = processDirectory(targetDir);
console.log(`\n✅ Done!`);
console.log(`   Processed: ${result.processed} files`);
console.log(`   Modified:  ${result.modified} files`);
