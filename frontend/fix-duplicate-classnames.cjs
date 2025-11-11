/**
 * 🔧 Fix Duplicate className Attributes Script
 * Removes duplicate className attributes that were added during migration
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: Two dynamic classNames on same element
  // Example: <Icon className={...} className={...} />
  const duplicatePattern = /(<[A-Z][a-zA-Z]*[^>]*?)\s+(className=\{[^}]+\})\s+([^>]*?)\s+(className=\{[^}]+\})/g;
  
  content = content.replace(duplicatePattern, (match, tagStart, firstClass, middle, secondClass) => {
    console.log(`  Found duplicate dynamic className`);
    modified = true;
    // Keep only the first className
    return `${tagStart} ${firstClass} ${middle}`;
  });

  // Pattern 2: Static then dynamic className
  // Example: <Icon className="..." className={...} />
  const mixedPattern1 = /(<[A-Z][a-zA-Z]*[^>]*?)\s+(className="[^"]*")\s+([^>]*?)\s+(className=\{[^}]+\})/g;
  
  content = content.replace(mixedPattern1, (match, tagStart, staticClass, middle, dynamicClass) => {
    console.log(`  Found mixed className (static first)`);
    modified = true;
    // Keep the dynamic one (usually has ICON_SIZES)
    return `${tagStart} ${dynamicClass} ${middle}`;
  });

  // Pattern 3: Dynamic then static className
  // Example: <Icon className={...} className="..." />
  const mixedPattern2 = /(<[A-Z][a-zA-Z]*[^>]*?)\s+(className=\{[^}]+\})\s+([^>]*?)\s+(className="[^"]*")/g;
  
  content = content.replace(mixedPattern2, (match, tagStart, dynamicClass, middle, staticClass) => {
    console.log(`  Found mixed className (dynamic first)`);
    modified = true;
    // Keep the dynamic one
    return `${tagStart} ${dynamicClass} ${middle}`;
  });

  // Pattern 4: Button/Link with two classNames (more complex elements)
  const complexPattern = /(button|a|div)\s+([^>]*?)\s+(className=\{[^}]+\})\s+([^>]*?)\s+(className=\{[^}]+\})/gi;
  
  content = content.replace(complexPattern, (match, element, attrs1, firstClass, attrs2, secondClass) => {
    console.log(`  Found duplicate className in ${element}`);
    modified = true;
    return `${element} ${attrs1} ${firstClass} ${attrs2}`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let totalProcessed = 0;
  let totalFixed = 0;

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const result = processDirectory(fullPath);
      totalProcessed += result.processed;
      totalFixed += result.fixed;
    } else if (file.match(/\.(tsx|ts|jsx|js)$/)) {
      totalProcessed++;
      console.log(`Processing: ${fullPath}`);
      const wasFixed = fixFile(fullPath);
      if (wasFixed) {
        totalFixed++;
        console.log(`  ✅ Fixed`);
      } else {
        console.log(`  ⏭️  No duplicates`);
      }
    }
  });

  return { processed: totalProcessed, fixed: totalFixed };
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node fix-duplicate-classnames.cjs <directory>');
  console.error('Example: node fix-duplicate-classnames.cjs src');
  process.exit(1);
}

const targetDir = args[0];
if (!fs.existsSync(targetDir)) {
  console.error(`Error: Directory not found: ${targetDir}`);
  process.exit(1);
}

console.log('🔧 Starting duplicate className fix...\n');
const result = processDirectory(targetDir);
console.log(`\n✅ Done!`);
console.log(`   Processed: ${result.processed} files`);
console.log(`   Fixed:     ${result.fixed} files`);
