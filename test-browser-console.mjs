#!/usr/bin/env node
/**
 * Browser Console Test for ApeClaw UI
 * Tests pages for console errors, resource loading, and visual rendering
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const BASE_URL = process.env.APE_CLAW_UI_PORT
  ? `http://localhost:${process.env.APE_CLAW_UI_PORT}`
  : 'http://localhost:8787';

// Test configuration
const pages = [
  { name: 'Dashboard', url: `${BASE_URL}/ui`, expectedTitle: 'ApeClaw' },
  { name: 'Skills', url: `${BASE_URL}/skills`, expectedTitle: 'Skills' }
];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function checkHealth() {
  return new Promise((resolve) => {
    const curl = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `${BASE_URL}/api/health`]);
    let status = '';
    curl.stdout.on('data', (data) => { status += data.toString(); });
    curl.on('close', () => resolve(parseInt(status, 10) === 200));
    curl.on('error', () => resolve(false));
  });
}

async function ensureServerReady() {
  if (await checkHealth()) return { started: false, child: null };
  const child = spawn(process.execPath, [path.join(ROOT, 'src', 'server', 'index.mjs')], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    // ~10s max wait
    await new Promise((r) => setTimeout(r, 250));
    if (await checkHealth()) return { started: true, child };
  }
  try { child.kill('SIGTERM'); } catch {}
  return { started: false, child: null, failed: true };
}

console.log('═══════════════════════════════════════════════════════');
console.log('ApeClaw Browser Console Test');
console.log('═══════════════════════════════════════════════════════\n');

// Function to test a page using curl and check resources
async function testPage(page) {
  console.log(`\n📄 Testing: ${page.name}`);
  console.log(`   URL: ${page.url}`);
  console.log('─────────────────────────────────────────────────────\n');

  return new Promise((resolve) => {
    // Fetch the page HTML
    const curl = spawn('curl', ['-s', page.url]);
    let html = '';

    curl.stdout.on('data', (data) => {
      html += data.toString();
    });

    curl.on('close', async () => {
      const results = {
        name: page.name,
        url: page.url,
        loaded: false,
        hasStyles: false,
        hasScripts: false,
        resources: [],
        potentialErrors: []
      };

      // Check if page loaded
      if (html.includes('<!DOCTYPE html>') && html.includes('<html')) {
        results.loaded = true;
        console.log('✅ Page loaded successfully');
      } else {
        console.log('❌ Page failed to load');
        resolve(results);
        return;
      }

      // Check for title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        console.log(`✅ Title: "${titleMatch[1]}"`);
        results.title = titleMatch[1];
      }

      // Extract CSS links
      const cssMatches = html.matchAll(/href=["']([^"']+\.css)["']/g);
      const cssFiles = [...cssMatches].map(m => m[1]);
      
      if (cssFiles.length > 0) {
        results.hasStyles = true;
        console.log(`\n📦 CSS Files Found: ${cssFiles.length}`);
        
        for (const css of cssFiles) {
          const cssUrl = css.startsWith('http') ? css : `${BASE_URL}${css.startsWith('/') ? '' : '/'}${css}`;
          const status = await checkResource(cssUrl);
          results.resources.push({ type: 'css', url: css, status });
          
          if (status === 200) {
            console.log(`   ✅ ${css}`);
          } else {
            console.log(`   ❌ ${css} (HTTP ${status})`);
            results.potentialErrors.push(`CSS file not found: ${css}`);
          }
        }
      }

      // Extract JS scripts
      const jsMatches = html.matchAll(/src=["']([^"']+\.js)["']/g);
      const jsFiles = [...jsMatches].map(m => m[1]);
      
      if (jsFiles.length > 0) {
        results.hasScripts = true;
        console.log(`\n📦 JavaScript Files Found: ${jsFiles.length}`);
        
        for (const js of jsFiles) {
          const jsUrl = js.startsWith('http') ? js : `${BASE_URL}${js.startsWith('/') ? '' : '/'}${js}`;
          const status = await checkResource(jsUrl);
          results.resources.push({ type: 'js', url: js, status });
          
          if (status === 200) {
            console.log(`   ✅ ${js}`);
          } else {
            console.log(`   ❌ ${js} (HTTP ${status})`);
            results.potentialErrors.push(`JS file not found: ${js}`);
          }
        }
      }

      // Check for inline styles
      const hasInlineStyle = html.includes('<style>') || html.includes('<style ');
      if (hasInlineStyle) {
        console.log('\n✅ Inline styles detected');
        results.hasStyles = true;
      }

      // Check for inline scripts
      const hasInlineScript = html.includes('<script>') || (html.includes('<script ') && !html.includes('src='));
      if (hasInlineScript) {
        console.log('✅ Inline scripts detected');
        results.hasScripts = true;
      }

      // Check for common UI elements
      console.log('\n🔍 UI Elements Check:');
      const uiChecks = {
        'Sidebar navigation': html.includes('sbNavMount') || html.includes('sidebar'),
        'Panel elements': html.includes('panel') || html.includes('class="panel'),
        'Activity feed': html.includes('activity') || html.includes('feed'),
        'Dark theme vars': html.includes('--bg:') || html.includes('background:'),
      };

      for (const [check, passed] of Object.entries(uiChecks)) {
        console.log(`   ${passed ? '✅' : '⚠️ '} ${check}`);
      }

      // Check for potential JavaScript errors in HTML
      console.log('\n🐛 Potential Issues:');
      if (results.potentialErrors.length === 0) {
        console.log('   ✅ No resource loading errors detected');
      } else {
        results.potentialErrors.forEach(err => {
          console.log(`   ❌ ${err}`);
        });
      }

      // Summary
      console.log('\n📊 Summary:');
      console.log(`   Loaded: ${results.loaded ? '✅' : '❌'}`);
      console.log(`   Has Styles: ${results.hasStyles ? '✅' : '❌'}`);
      console.log(`   Has Scripts: ${results.hasScripts ? '✅' : '❌'}`);
      console.log(`   Resources OK: ${results.resources.filter(r => r.status === 200).length}/${results.resources.length}`);
      console.log(`   Errors: ${results.potentialErrors.length}`);

      resolve(results);
    });
  });
}

// Function to check if a resource loads
function checkResource(url) {
  return new Promise((resolve) => {
    const curl = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url]);
    let status = '';

    curl.stdout.on('data', (data) => {
      status += data.toString();
    });

    curl.on('close', () => {
      resolve(parseInt(status) || 0);
    });
  });
}

// Run tests
(async () => {
  const server = await ensureServerReady();
  if (server.failed) {
    console.log('❌ Could not start local UI server for browser test');
    process.exit(1);
  }

  const allResults = [];

  for (const page of pages) {
    const result = await testPage(page);
    allResults.push(result);
  }

  // Generate summary report
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  let allPassed = true;
  for (const result of allResults) {
    const passed = result.loaded && result.hasStyles && result.hasScripts && result.potentialErrors.length === 0;
    allPassed = allPassed && passed;
    
    console.log(`${passed ? '✅' : '❌'} ${result.name}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed && result.potentialErrors.length > 0) {
      result.potentialErrors.forEach(err => {
        console.log(`   └─ ${err}`);
      });
    }
  }

  console.log('\n' + (allPassed ? '🎉 All pages passed!' : '⚠️  Some pages have issues'));
  
  // Save detailed results
  const resultsPath = path.join(ROOT, 'browser-test-results.json');
  writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  console.log(`\n📄 Detailed results saved to: ${resultsPath}\n`);

  if (server.started && server.child) {
    try { server.child.kill('SIGTERM'); } catch {}
  }

  process.exit(allPassed ? 0 : 1);
})();
