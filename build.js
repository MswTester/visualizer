const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Compile the TypeScript files
console.log('Compiling TypeScript files...');
execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });

// Copy the public folder to dist
console.log('Copying public folder to dist...');
const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist', 'public');

// Create the dist/public directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy all files from public to dist/public
function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    fs.readdirSync(from).forEach(element => {
        const source = path.join(from, element);
        const dest = path.join(to, element);
        
        if (fs.statSync(source).isFile()) {
            fs.copyFileSync(source, dest);
        } else {
            copyFolderSync(source, dest);
        }
    });
}

copyFolderSync(publicDir, distDir);

// Extract main.ts content to inject into public/main.js
const mainTsPath = path.join(__dirname, 'src', 'main.ts');
const distMainJsPath = path.join(distDir, 'main.js');

console.log('Creating browser-ready main.js...');
const mainTsContent = fs.readFileSync(mainTsPath, 'utf8');

// Simple wrapper for the browser - in a real application, you'd use a proper bundler
const browserScript = `
// This file is auto-generated from src/main.ts
// WARNING: Don't edit this file directly!

// Auto-initializing on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Visualizer started');
    initApp();
});

// Original code from src/main.ts follows
${fs.readFileSync(path.join(__dirname, 'dist', 'main.js'), 'utf8')}
`;

fs.writeFileSync(distMainJsPath, browserScript);

console.log('Build completed successfully!'); 