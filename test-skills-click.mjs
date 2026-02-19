import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // === TEST 1: Production (current live code - should be BROKEN) ===
  console.log('====================================');
  console.log('TEST 1: PRODUCTION (apeclaw.ai/skills)');
  console.log('====================================');
  const prodPage = await browser.newPage();
  await prodPage.goto('https://apeclaw.ai/skills', { waitUntil: 'networkidle', timeout: 20000 });

  const prodCardCount = await prodPage.$$eval('.skill-card', c => c.length);
  console.log('Cards:', prodCardCount);

  const prodInstallBtn = await prodPage.$('.skill-card a[href*="#install="]');
  if (prodInstallBtn) {
    console.log('Clicking Install on production...');
    await prodInstallBtn.click();
    await prodPage.waitForTimeout(1000);
    const visible = await prodPage.$eval('#modalBackdrop', el => el.classList.contains('show'));
    console.log('Modal visible:', visible ? 'YES' : 'NO (BROKEN)');
  }
  await prodPage.close();

  // === TEST 2: Local (with fix) ===
  console.log('\n====================================');
  console.log('TEST 2: LOCAL (with DOM fix)');
  console.log('====================================');
  const localPage = await browser.newPage();

  const skillsSearch = readFileSync(resolve(ROOT, 'data/skills-search.json'), 'utf8');
  const skillsStats = readFileSync(resolve(ROOT, 'data/skills-stats.json'), 'utf8');

  await localPage.route('**/api/skills/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: skillsSearch })
  );
  await localPage.route('**/api/skills/stats**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: skillsStats })
  );
  await localPage.route('**/api/skills/get**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"test","version":"1.0.0"}' })
  );

  await localPage.goto('http://localhost:8765/ui/skills.html', { waitUntil: 'networkidle', timeout: 15000 });
  await localPage.waitForTimeout(3000);

  const localCardCount = await localPage.$$eval('.skill-card', c => c.length);
  console.log('Cards rendered:', localCardCount);

  if (localCardCount === 0) {
    console.log('WARN: Still no cards. Checking console errors...');
    localPage.on('console', msg => console.log('  CONSOLE:', msg.text()));
    await localPage.waitForTimeout(2000);
  }

  // Test Install button
  const installBtn = await localPage.$('.skill-card a[href*="#install="]');
  if (installBtn) {
    console.log('\n--- Click Install ---');
    await installBtn.click();
    await localPage.waitForTimeout(1000);
    const visible = await localPage.$eval('#modalBackdrop', el => el.classList.contains('show'));
    console.log('Modal visible:', visible ? 'YES (FIXED!)' : 'NO (still broken)');
    if (visible) {
      const title = await localPage.$eval('#modalTitle', el => el.textContent);
      const bodyLen = await localPage.$eval('#modalBody', el => el.innerHTML.length);
      console.log('Title:', title);
      console.log('Body length:', bodyLen);
    }

    // Close modal
    const cancelBtn = await localPage.$('#modalCancelBtn');
    if (cancelBtn) await cancelBtn.click();
    await localPage.waitForTimeout(500);
  } else {
    console.log('No Install button found');
  }

  // Test JSON button
  const jsonBtn = await localPage.$('.skill-card a[href*="#json="]');
  if (jsonBtn) {
    console.log('\n--- Click JSON ---');
    await jsonBtn.click();
    await localPage.waitForTimeout(1000);
    const visible = await localPage.$eval('#modalBackdrop', el => el.classList.contains('show'));
    console.log('Modal visible:', visible ? 'YES (FIXED!)' : 'NO (still broken)');
    if (visible) {
      const title = await localPage.$eval('#modalTitle', el => el.textContent);
      console.log('Title:', title);
    }
    const cancelBtn = await localPage.$('#modalCancelBtn');
    if (cancelBtn) await cancelBtn.click();
    await localPage.waitForTimeout(500);
  }

  // Test Details button
  const detailsBtn = await localPage.$('.skill-card a[href*="#skill="]');
  if (detailsBtn) {
    console.log('\n--- Click Details ---');
    await detailsBtn.click();
    await localPage.waitForTimeout(1000);
    const visible = await localPage.$eval('#modalBackdrop', el => el.classList.contains('show'));
    console.log('Modal visible:', visible ? 'YES (FIXED!)' : 'NO (still broken)');
    if (visible) {
      const title = await localPage.$eval('#modalTitle', el => el.textContent);
      console.log('Title:', title);
    }
  }

  // Grid layout check
  console.log('\n--- Grid Layout ---');
  console.log('Total cards:', localCardCount);
  console.log('Cards mod 3:', localCardCount % 3, localCardCount % 3 === 0 ? '(even rows)' : '(uneven last row)');

  await localPage.close();
  await browser.close();
  console.log('\n=== DONE ===');
})();
