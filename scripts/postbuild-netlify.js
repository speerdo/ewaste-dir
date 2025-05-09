import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('Running Netlify post-build fixes...');

// Function to fix any @-containing imports in generated files
async function fixImports() {
  try {
    // Look for all .js and .mjs files in the functions directory
    const functionsDir = path.join(rootDir, '.netlify', 'functions');
    const files = await glob('**/*.{js,mjs}', { cwd: functionsDir });

    let fileCount = 0;
    let replacementCount = 0;

    for (const file of files) {
      const filePath = path.join(functionsDir, file);

      // Read file content
      let content = fs.readFileSync(filePath, 'utf8');

      // Look for problematic imports with @ characters
      const originalContent = content;

      // Replace imports that contain @ with underscore version
      content = content.replace(
        /from\s+['"](.+)@(.+)['"]/g,
        (match, p1, p2) => {
          return `from '${p1}_${p2}'`;
        }
      );

      // Replace file references with @ in them
      content = content.replace(
        /(['"])\.\/(.*@.*)\1/g,
        (match, quote, fileName) => {
          return `${quote}./${fileName.replace(
            /[^a-zA-Z0-9-_./]/g,
            '_'
          )}${quote}`;
        }
      );

      // If content was changed, write back to file
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        replacementCount++;
      }

      fileCount++;
    }

    console.log(
      `Processed ${fileCount} files, updated ${replacementCount} files with invalid characters in import statements.`
    );
  } catch (error) {
    console.error('Error fixing imports:', error);
  }
}

// Function to rename any files with invalid characters
async function renameInvalidFiles() {
  try {
    const functionsDir = path.join(rootDir, '.netlify', 'functions');
    const files = await glob('**/*@*', { cwd: functionsDir });

    for (const file of files) {
      const oldPath = path.join(functionsDir, file);
      const newPath = path.join(
        functionsDir,
        file.replace(/[^a-zA-Z0-9-_./]/g, '_')
      );

      if (fs.existsSync(oldPath)) {
        console.log(`Renaming ${oldPath} to ${newPath}`);
        fs.renameSync(oldPath, newPath);
      }
    }

    console.log(`Renamed ${files.length} files with invalid characters.`);
  } catch (error) {
    console.error('Error renaming invalid files:', error);
  }
}

// Run the fix functions
async function main() {
  // First rename any files with invalid names
  await renameInvalidFiles();

  // Then update any import references in the files
  await fixImports();

  // Search for the problematic files in all build directories
  const functionsDir = path.join(rootDir, '.netlify');
  // Include all directories including nested v1 directories
  const files = await glob('**/_@astrojs-ssr-adapter*.mjs', {
    cwd: functionsDir,
    dot: true, // Include dot directories (like .netlify)
    ignore: ['**/node_modules/**'], // Skip node_modules directories
  });

  console.log(
    `Found ${files.length} files with invalid characters (@) in filename.`
  );

  // Rename the problematic files
  for (const file of files) {
    const oldPath = path.join(functionsDir, file);
    const newPath = path.join(
      path.dirname(oldPath),
      path.basename(oldPath).replace('@', '_')
    );

    console.log(`Renaming ${oldPath} to ${newPath}`);

    try {
      // Rename the file
      fs.renameSync(oldPath, newPath);

      // Now find any references to this file in other JS/MJS files
      const dirToSearch = path.dirname(oldPath);
      const filesInDir = await glob('**/*.{js,mjs}', {
        cwd: dirToSearch,
        ignore: ['**/node_modules/**'], // Skip node_modules directories
      });

      for (const jsFile of filesInDir) {
        const jsFilePath = path.join(dirToSearch, jsFile);
        const content = fs.readFileSync(jsFilePath, 'utf8');

        // Replace references to the file
        const oldBasename = path.basename(oldPath);
        const newBasename = path.basename(newPath);
        const updatedContent = content.replace(
          new RegExp(
            oldBasename.replace(/\./g, '\\.').replace(/\@/g, '\\@'),
            'g'
          ),
          newBasename
        );

        if (content !== updatedContent) {
          console.log(`Updating references in ${jsFilePath}`);
          fs.writeFileSync(jsFilePath, updatedContent, 'utf8');
        }
      }
    } catch (error) {
      console.error(`Error processing ${oldPath}:`, error);
    }
  }

  console.log('Netlify post-build fixes completed.');
}

main().catch((error) => {
  console.error('Post-build script failed:', error);
  process.exit(1);
});
