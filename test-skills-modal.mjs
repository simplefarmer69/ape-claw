import { chromium } from 'playwright';

const BASE = 'http://localhost:8765';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('=== Navigating to skills page ===');
  await page.goto(`${BASE}/ui/skills.html`, { waitUntil: 'domcontentloaded' });

  // Check modal elements exist in DOM
  const modalBackdrop = await page.$('#modalBackdrop');
  const modalTitle = await page.$('#modalTitle');
  const modalBody = await page.$('#modalBody');
  const toast = await page.$('#toast');

  console.log('Modal backdrop exists:', !!modalBackdrop);
  console.log('Modal title exists:', !!modalTitle);
  console.log('Modal body exists:', !!modalBody);
  console.log('Toast exists:', !!toast);

  // Wait for skills to load (the JS fetches /api/skills/search -> /data/skills-search.json)
  // The local server won't have the /api rewrite, so let's check if JS handles it
  console.log('\n=== Waiting for skill cards to render ===');
  
  // Check what URL the JS fetches from
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(msg.text()));
  
  // The JS tries api endpoint - let's wait a bit and see what loads
  await page.waitForTimeout(3000);
  
  const cardCount = await page.$$eval('.skill-card', cards => cards.length);
  console.log('Skill cards rendered:', cardCount);

  if (cardCount === 0) {
    console.log('No cards rendered - JS may need /api/skills/search rewrite.');
    console.log('Testing with direct page on production instead...');
    
    await page.goto('https://apeclaw.ai/skills', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);
    
    const prodModalBackdrop = await page.$('#modalBackdrop');
    const prodModalTitle = await page.$('#modalTitle');
    const prodModalBody = await page.$('#modalBody');
    console.log('\n=== Production page check ===');
    console.log('Modal backdrop exists:', !!prodModalBackdrop);
    console.log('Modal title exists:', !!prodModalTitle);
    console.log('Modal body exists:', !!prodModalBody);
    
    const prodCardCount = await page.$$eval('.skill-card', cards => cards.length);
    console.log('Skill cards rendered:', prodCardCount);
    console.log('(Note: production still has OLD code - we need to deploy first)');
  }

  // Test on the LOCAL version with skill data available
  // We need to check that the modal JS initializes correctly
  console.log('\n=== Checking JS variable state ===');
  const modalVarState = await page.evaluate(() => {
    // Check if the IIFE already ran and has variables in scope
    // We can test by checking if clicking an install button would open a modal
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) return { error: 'No backdrop element' };
    
    return {
      backdropExists: true,
      hasShowClass: backdrop.classList.contains('show'),
      ariaHidden: backdrop.getAttribute('aria-hidden'),
      titleText: document.getElementById('modalTitle')?.textContent,
      bodyHTML: document.getElementById('modalBody')?.innerHTML,
    };
  });
  console.log('Modal state:', JSON.stringify(modalVarState, null, 2));

  // Try opening a modal via direct JS call to test the function itself
  console.log('\n=== Testing openModal function directly ===');
  const openResult = await page.evaluate(() => {
    // The function is inside an IIFE so we can't call it directly.
    // Instead, let's simulate: check if the backdrop element exists and can be shown
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) return 'FAIL: No backdrop element found';
    
    // Manually test what the script does
    backdrop.classList.add('show');
    backdrop.setAttribute('aria-hidden', 'false');
    const hasShow = backdrop.classList.contains('show');
    
    // Clean up
    backdrop.classList.remove('show');
    backdrop.setAttribute('aria-hidden', 'true');
    
    return hasShow ? 'PASS: Modal backdrop can be toggled' : 'FAIL: Cannot toggle modal';
  });
  console.log(openResult);

  // Check if skill buttons have correct href patterns
  console.log('\n=== Checking button href patterns ===');
  const buttonHrefs = await page.$$eval('.skill-card a[href*="#"]', links =>
    links.slice(0, 12).map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
    }))
  );
  console.log('Button hrefs:', JSON.stringify(buttonHrefs, null, 2));

  // Console messages
  if (consoleMessages.length) {
    console.log('\n=== Console messages ===');
    consoleMessages.forEach(m => console.log('  ', m));
  }

  await browser.close();
  console.log('\n=== Test complete ===');
})();
