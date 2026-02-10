#!/usr/bin/env node

/**
 * Creates a Powerlevel dashboard (GitHub Project board)
 */

import { execSync } from 'child_process';
import { calculatePowerlevel } from '../lib/project-manager.js';

try {
  const powerlevel = calculatePowerlevel();
  const title = `Powerlevel ${powerlevel}`;
  const description = 'They say you can raise your Powerlevel by training hard and believing in your friends. But really it just goes up when you start tracking more projects. 📊';
  
  console.log(`Creating GitHub Project: ${title}`);
  
  const output = execSync(
    `gh project create --owner @me --title "${title}"`,
    { encoding: 'utf-8' }
  );
  
  console.log(output);
  console.log(`✓ Dashboard created: ${title}`);
  console.log(`Note: Add this description manually: "${description}"`);
} catch (error) {
  console.error('Failed to create dashboard:', error.message);
  process.exit(1);
}
