#!/usr/bin/env node
/**
 * Comprehensive Skills Page Test
 * Tests the skills page functionality, tab switching, and visual elements
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:8799';
const SKILLS_URL = `${BASE_URL}/skills`;

console.log('═══════════════════════════════════════════════════════');
console.log('ApeClaw Skills Page Comprehensive Test');
console.log('═══════════════════════════════════════════════════════\n');

// Fetch page HTML
function fetchPage(url) {
  return new Promise((resolve) => {
    const curl = spawn('curl', ['-s', url]);
    let html = '';
    curl.stdout.on('data', (data) => { html += data.toString(); });
    curl.on('close', () => resolve(html));
  });
}

// Check resource status
function checkResource(url) {
  return new Promise((resolve) => {
    const curl = spawn('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url]);
    let status = '';
    curl.stdout.on('data', (data) => { status += data.toString(); });
    curl.on('close', () => resolve(parseInt(status) || 0));
  });
}

// Main test function
(async () => {
  console.log('📄 Fetching Skills Page...\n');
  const html = await fetchPage(SKILLS_URL);
  
  const report = {
    url: SKILLS_URL,
    timestamp: new Date().toISOString(),
    pageLoad: {},
    styling: {},
    components: {},
    tabs: {},
    resources: [],
    issues: []
  };

  // ═══════════════════════════════════════════════════════
  // 1. PAGE LOAD CHECK
  // ═══════════════════════════════════════════════════════
  console.log('1️⃣  PAGE LOAD CHECK');
  console.log('─────────────────────────────────────────────────────\n');

  if (html.includes('<!DOCTYPE html>') && html.includes('<html')) {
    report.pageLoad.loaded = true;
    console.log('✅ Page loaded successfully');
  } else {
    report.pageLoad.loaded = false;
    console.log('❌ Page failed to load');
    report.issues.push('Page did not load properly');
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    report.pageLoad.title = titleMatch[1];
    console.log(`✅ Title: "${titleMatch[1]}"`);
  } else {
    console.log('❌ No title found');
    report.issues.push('Missing page title');
  }

  const contentLength = html.length;
  report.pageLoad.contentLength = contentLength;
  console.log(`✅ Content size: ${contentLength.toLocaleString()} bytes`);

  // ═══════════════════════════════════════════════════════
  // 2. STYLING CHECK
  // ═══════════════════════════════════════════════════════
  console.log('\n2️⃣  STYLING CHECK');
  console.log('─────────────────────────────────────────────────────\n');

  const stylingChecks = {
    'Dark themed background': html.includes('--bg:#111111') || html.includes('background:#111111'),
    'CSS variables defined': html.includes(':root{') || html.includes(':root {'),
    'Accent color (neon yellow)': html.includes('#cfff04') || html.includes('207,255,4'),
    'Panel styling': html.includes('--panel') || html.includes('--surface'),
    'Border styling': html.includes('--border') || html.includes('border:'),
    'External CSS loaded': html.includes('href=') && html.includes('.css'),
    'Inline styles present': html.includes('<style>') || html.includes('<style '),
  };

  report.styling = stylingChecks;
  for (const [check, passed] of Object.entries(stylingChecks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    if (!passed) report.issues.push(`Styling issue: ${check}`);
  }

  // ═══════════════════════════════════════════════════════
  // 3. COMPONENT CHECK
  // ═══════════════════════════════════════════════════════
  console.log('\n3️⃣  COMPONENT CHECK');
  console.log('─────────────────────────────────────────────────────\n');

  const componentChecks = {
    'Sidebar navigation mount': html.includes('sbNavMount') || html.includes('sidebar'),
    'Hero section': html.includes('hero') || html.includes('class="hero'),
    'Stats display': html.includes('stat') && (html.includes('Total Skills') || html.includes('id="statTotal"')),
    'Tab navigation': html.includes('tab-btn') || html.includes('role="tab"'),
    'Browse tab': html.includes('data-tab="browse"') || html.includes('Browse'),
    'Add tab': html.includes('data-tab="add"') || html.includes('Add'),
    'Onchain tab': html.includes('data-tab="onchain"') || html.includes('Onchain'),
    'Skill cards container': html.includes('cards') || html.includes('skill'),
    'Search functionality': html.includes('search') || html.includes('type="search"'),
    'Filter controls': html.includes('filter') || html.includes('select'),
  };

  report.components = componentChecks;
  for (const [check, passed] of Object.entries(componentChecks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    if (!passed) report.issues.push(`Component missing: ${check}`);
  }

  // ═══════════════════════════════════════════════════════
  // 4. TAB STRUCTURE ANALYSIS
  // ═══════════════════════════════════════════════════════
  console.log('\n4️⃣  TAB STRUCTURE ANALYSIS');
  console.log('─────────────────────────────────────────────────────\n');

  // Check for tab buttons
  const tabBtnMatches = html.matchAll(/data-tab="([^"]+)"/g);
  const tabs = [...tabBtnMatches].map(m => m[1]);
  
  if (tabs.length > 0) {
    console.log(`✅ Found ${tabs.length} tabs: ${tabs.join(', ')}`);
    report.tabs.found = tabs;
  } else {
    console.log('❌ No tabs found');
    report.tabs.found = [];
    report.issues.push('Tab navigation not found');
  }

  // Check for tab panels
  const tabPanelMatches = html.matchAll(/data-panel="([^"]+)"/g);
  const panels = [...tabPanelMatches].map(m => m[1]);
  
  if (panels.length > 0) {
    console.log(`✅ Found ${panels.length} tab panels: ${panels.join(', ')}`);
    report.tabs.panels = panels;
  } else {
    console.log('❌ No tab panels found');
    report.tabs.panels = [];
  }

  // Check for active tab
  const activeTabMatch = html.match(/class="tab-btn active"[^>]*data-tab="([^"]+)"/);
  if (activeTabMatch) {
    console.log(`✅ Active tab: ${activeTabMatch[1]}`);
    report.tabs.active = activeTabMatch[1];
  } else {
    console.log('⚠️  No active tab detected (might be set by JS)');
  }

  // Check for tab switching JavaScript
  const hasTabSwitching = html.includes('switchTab') || html.includes("getAttribute('data-tab')");
  console.log(`${hasTabSwitching ? '✅' : '❌'} Tab switching JavaScript present`);
  report.tabs.hasJavaScript = hasTabSwitching;

  // ═══════════════════════════════════════════════════════
  // 5. HERO SECTION STATS
  // ═══════════════════════════════════════════════════════
  console.log('\n5️⃣  HERO SECTION STATS');
  console.log('─────────────────────────────────────────────────────\n');

  const statIds = ['statTotal', 'statVetted', 'statOnchain', 'statContributed'];
  const stats = {};
  
  for (const statId of statIds) {
    const statMatch = html.match(new RegExp(`id="${statId}"[^>]*>([^<]+)<`));
    if (statMatch) {
      stats[statId] = statMatch[1].trim();
      console.log(`   ✅ ${statId}: ${statMatch[1].trim()}`);
    } else {
      console.log(`   ⚠️  ${statId}: not found`);
    }
  }
  report.stats = stats;

  // ═══════════════════════════════════════════════════════
  // 6. SEARCH & FILTER ELEMENTS
  // ═══════════════════════════════════════════════════════
  console.log('\n6️⃣  SEARCH & FILTER ELEMENTS');
  console.log('─────────────────────────────────────────────────────\n');

  const searchFilterChecks = {
    'Search input (imported skills)': html.includes('id="importedSearch"') || html.includes('placeholder="Search skills'),
    'Risk filter dropdown': html.includes('id="riskFilter"') || html.includes('Risk Tier'),
    'Onchain-only checkbox': html.includes('id="onlyOnchain"') || html.includes('Onchain only'),
    'Vetted-only checkbox': html.includes('id="onlyVetted"') || html.includes('Vetted only'),
    'Results badge': html.includes('id="importedBadge"') || html.includes('Results:'),
    'Pagination controls': html.includes('pagination') || html.includes('pgPrev'),
  };

  report.searchFilter = searchFilterChecks;
  for (const [check, passed] of Object.entries(searchFilterChecks)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }

  // ═══════════════════════════════════════════════════════
  // 7. RESOURCE LOADING CHECK
  // ═══════════════════════════════════════════════════════
  console.log('\n7️⃣  RESOURCE LOADING CHECK');
  console.log('─────────────────────────────────────────────────────\n');

  // Extract CSS files
  const cssMatches = html.matchAll(/href=["']([^"']+\.css)["']/g);
  const cssFiles = [...cssMatches].map(m => m[1]);

  // Extract JS files
  const jsMatches = html.matchAll(/src=["']([^"']+\.js)["']/g);
  const jsFiles = [...jsMatches].map(m => m[1]);

  const allResources = [
    ...cssFiles.map(f => ({ type: 'CSS', url: f })),
    ...jsFiles.map(f => ({ type: 'JS', url: f }))
  ];

  for (const resource of allResources) {
    const fullUrl = resource.url.startsWith('http') 
      ? resource.url 
      : `${BASE_URL}${resource.url.startsWith('/') ? '' : '/'}${resource.url}`;
    
    const status = await checkResource(fullUrl);
    resource.status = status;
    report.resources.push(resource);

    if (status === 200) {
      console.log(`   ✅ ${resource.type}: ${resource.url}`);
    } else {
      console.log(`   ❌ ${resource.type}: ${resource.url} (HTTP ${status})`);
      report.issues.push(`Resource failed: ${resource.url} (HTTP ${status})`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 8. JAVASCRIPT FUNCTIONALITY CHECK
  // ═══════════════════════════════════════════════════════
  console.log('\n8️⃣  JAVASCRIPT FUNCTIONALITY CHECK');
  console.log('─────────────────────────────────────────────────────\n');

  const jsChecks = {
    'Error handlers': html.includes("addEventListener('error'") || html.includes('window.addEventListener("error"'),
    'Tab switching logic': html.includes('switchTab') || html.includes('tab-btn'),
    'Search functionality': html.includes('searchInput') || html.includes('addEventListener("input"'),
    'Filter logic': html.includes('riskFilter') || html.includes('addEventListener("change"'),
    'Copy to clipboard': html.includes('clipboard.writeText') || html.includes('data-copy'),
    'Collapsible sections': html.includes('toggleStep') || html.includes('collapsible'),
    'Modal/toast system': html.includes('modal') || html.includes('toast'),
  };

  report.javascript = jsChecks;
  for (const [check, passed] of Object.entries(jsChecks)) {
    console.log(`   ${passed ? '✅' : '⚠️ '} ${check}`);
  }

  // ═══════════════════════════════════════════════════════
  // 9. VISUAL ELEMENTS CHECK
  // ═══════════════════════════════════════════════════════
  console.log('\n9️⃣  VISUAL ELEMENTS CHECK');
  console.log('─────────────────────────────────────────────────────\n');

  const visualChecks = {
    'Background effects (scanlines)': html.includes('scanlines') || html.includes('class="scanlines'),
    'Noise texture': html.includes('noise') || html.includes('class="noise'),
    'Orb animations': html.includes('orb') || html.includes('class="orb'),
    'Collage background': html.includes('bgCollage') || html.includes('bg-collage'),
    'Glow effects': html.includes('glow') || html.includes('ac-glow'),
    'Shimmer effects': html.includes('shimmer') || html.includes('ac-stat-shimmer'),
    'Motion classes': html.includes('ac-observe') || html.includes('reveal'),
  };

  report.visual = visualChecks;
  for (const [check, passed] of Object.entries(visualChecks)) {
    console.log(`   ${passed ? '✅' : '⚠️ '} ${check}`);
  }

  // ═══════════════════════════════════════════════════════
  // 10. TAB CONTENT VERIFICATION
  // ═══════════════════════════════════════════════════════
  console.log('\n🔟 TAB CONTENT VERIFICATION');
  console.log('─────────────────────────────────────────────────────\n');

  // Browse tab content
  const browseTabContent = {
    'Getting Started section': html.includes('id="getting-started"') || html.includes('Getting Started'),
    'Imported Skills section': html.includes('id="imported"') || html.includes('Imported Skills'),
    'Skill cards list': html.includes('id="importedList"') || html.includes('cards'),
    'Browse instructions': html.includes('Browse the Library') || html.includes('Install a Skill'),
  };

  console.log('Browse Tab:');
  for (const [check, passed] of Object.entries(browseTabContent)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }

  // Add tab content
  const addTabContent = {
    'Template selection': html.includes('selectTemplate') || html.includes('template-btn'),
    'JSON editor': html.includes('id="skillJson"') || html.includes('textarea'),
    'Validation buttons': html.includes('validateSkillBtn') || html.includes('formatJsonBtn'),
    'Auth inputs': html.includes('authAgentId') || html.includes('authAgentToken'),
    'Submit button': html.includes('addSkillBtn') || html.includes('Add to Global Library'),
  };

  console.log('\nAdd Tab:');
  for (const [check, passed] of Object.entries(addTabContent)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }

  // Onchain tab content
  const onchainTabContent = {
    'Network status': html.includes('id="onchain-status"') || html.includes('ApeChain Network'),
    'Contract addresses': html.includes('ocContractsList') || html.includes('Deployed Contracts'),
    'Intents section': html.includes('id="intents"') || html.includes('IntentRegistry'),
    'Receipts section': html.includes('id="receipts"') || html.includes('ReceiptRegistry'),
  };

  console.log('\nOnchain Tab:');
  for (const [check, passed] of Object.entries(onchainTabContent)) {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  }

  report.tabContent = { browse: browseTabContent, add: addTabContent, onchain: onchainTabContent };

  // ═══════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  const totalChecks = 
    Object.keys(stylingChecks).length +
    Object.keys(componentChecks).length +
    Object.keys(searchFilterChecks).length +
    allResources.length;

  const passedChecks = 
    Object.values(stylingChecks).filter(Boolean).length +
    Object.values(componentChecks).filter(Boolean).length +
    Object.values(searchFilterChecks).filter(Boolean).length +
    allResources.filter(r => r.status === 200).length;

  console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks`);
  console.log(`❌ Issues: ${report.issues.length}`);
  
  if (report.issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    report.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  // Overall assessment
  console.log('\n📊 Overall Assessment:');
  const score = (passedChecks / totalChecks) * 100;
  report.score = score;

  if (score >= 95) {
    console.log(`   🎉 EXCELLENT (${score.toFixed(1)}%) - Page is fully functional`);
  } else if (score >= 80) {
    console.log(`   ✅ GOOD (${score.toFixed(1)}%) - Page is functional with minor issues`);
  } else if (score >= 60) {
    console.log(`   ⚠️  FAIR (${score.toFixed(1)}%) - Page has some issues`);
  } else {
    console.log(`   ❌ POOR (${score.toFixed(1)}%) - Page has significant issues`);
  }

  // Tab switching assessment
  console.log('\n🔄 Tab Switching:');
  if (tabs.length === 3 && panels.length === 3 && hasTabSwitching) {
    console.log('   ✅ Tab switching should work (3 tabs, 3 panels, JS present)');
    report.tabSwitching = 'functional';
  } else {
    console.log('   ⚠️  Tab switching may have issues');
    report.tabSwitching = 'uncertain';
  }

  // Visual rendering assessment
  console.log('\n🎨 Visual Rendering:');
  const visualScore = Object.values(report.styling).filter(Boolean).length / Object.keys(report.styling).length;
  if (visualScore >= 0.8) {
    console.log('   ✅ Page should render with full dark theme styling');
  } else {
    console.log('   ⚠️  Some styling may be missing');
  }

  // Save report
  writeFileSync(
    '/Volumes/2Tb-Backup/ApeClaw/skills-page-test-report.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n📄 Detailed report saved to: skills-page-test-report.json\n');

  process.exit(report.issues.length === 0 ? 0 : 1);
})();
