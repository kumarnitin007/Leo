/**
 * Auto-increment version script
 * Increments the patch version (1.0.0 -> 1.0.1) on each build
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', 'package.json');

try {
  // Read package.json
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  
  // Parse version (e.g., "1.0.0")
  const versionParts = packageJson.version.split('.');
  const major = parseInt(versionParts[0]) || 1;
  const minor = parseInt(versionParts[1]) || 0;
  const patch = parseInt(versionParts[2]) || 0;
  
  // Increment patch version
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  // Update package.json
  packageJson.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  
  console.log(`✅ Version incremented: ${packageJson.version} -> ${newVersion}`);
  
  // Export for use in build
  process.env.APP_VERSION = newVersion;
} catch (error) {
  console.error('❌ Error incrementing version:', error);
  // Fallback to current version
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    process.env.APP_VERSION = packageJson.version;
  } catch (e) {
    process.env.APP_VERSION = '1.0.0';
  }
}

