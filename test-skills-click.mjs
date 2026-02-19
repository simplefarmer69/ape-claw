import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLog = [];
  const pageErrors = [];
  page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(err.message));

  console.log('=== Navigating to apeclaw.ai/skills ===');
  await page.goto('https://apeclaw.ai/skills', { waitUntil: 'networkidle', timeout: 30000 });

  const cardCount = await page.$$eval('.skill-card', c => c.length);
  console.log('Cards rendered:', cardCount);

  // Check JS state of modal variables inside the IIFE closure
  // We can't access closure vars directly, but we can test openModal behavior
  const preClickState = await page.evaluate(() => {
    const bd = document.getElementById('modalBackdrop');
    return {
      backdropExists: !!bd,
      display: bd ? getComputedStyle(bd).display : 'N/A',
      zIndex: bd ? getComputedStyle(bd).zIndex : 'N/A',
    };
  });
  console.log('Pre-click modal state:', preClickState);

  // Find and click an Install button
  console.log('\n=== Clicking Install button ===');
  const installBtn = await page.$('[data-action="install"]');
  if (!installBtn) {
    console.log('ERROR: No [data-action="install"] button found!');
    // Check what buttons exist
    const btns = await page.$$eval('.skill-card a', els => els.slice(0, 5).map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
      dataAction: a.getAttribute('data-action'),
    })));
    console.log('Buttons found:', JSON.stringify(btns, null, 2));
  } else {
    const btnInfo = await installBtn.evaluate(el => ({
      text: el.textContent?.trim(),
      href: el.getAttribute('href'),
      dataAction: el.getAttribute('data-action'),
    }));
    console.log('Button info:', btnInfo);

    await installBtn.click();
    await page.waitForTimeout(2000);

    const postClickState = await page.evaluate(() => {
      const bd = document.getElementById('modalBackdrop');
      if (!bd) return { error: 'No backdrop element' };
      const computed = getComputedStyle(bd);
      return {
        classList: Array.from(bd.classList),
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        zIndex: computed.zIndex,
        ariaHidden: bd.getAttribute('aria-hidden'),
        titleText: document.getElementById('modalTitle')?.textContent || '(null)',
        bodyHTML: (document.getElementById('modalBody')?.innerHTML || '').slice(0, 200),
        url: window.location.href,
      };
    });
    console.log('Post-click modal state:', JSON.stringify(postClickState, null, 2));

    if (!postClickState.classList?.includes('show')) {
      console.log('\nMODAL DID NOT OPEN! Investigating...');

      // Test if openModal works by manually calling it via eval
      const manualTest = await page.evaluate(() => {
        const bd = document.getElementById('modalBackdrop');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        if (!bd || !title || !body) return 'Elements missing from DOM';

        // Manually toggle
        bd.classList.add('show');
        bd.setAttribute('aria-hidden', 'false');
        title.textContent = 'Manual Test';
        body.innerHTML = '<p>Testing direct DOM manipulation</p>';
        const hasShow = bd.classList.contains('show');
        const display = getComputedStyle(bd).display;

        // Cleanup
        bd.classList.remove('show');
        bd.setAttribute('aria-hidden', 'true');
        title.textContent = 'Modal';
        body.innerHTML = '';

        return { hasShow, display };
      });
      console.log('Manual DOM toggle test:', manualTest);
    }
  }

  // Now test via hash navigation (the fallback path)
  console.log('\n=== Testing hash navigation fallback ===');
  await page.evaluate(() => {
    const bd = document.getElementById('modalBackdrop');
    if (bd) { bd.classList.remove('show'); bd.setAttribute('aria-hidden', 'true'); }
  });
  await page.goto('https://apeclaw.ai/skills#install=bankr-openclaw-botchan', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  const hashState = await page.evaluate(() => {
    const bd = document.getElementById('modalBackdrop');
    return {
      classList: bd ? Array.from(bd.classList) : [],
      display: bd ? getComputedStyle(bd).display : 'N/A',
      titleText: document.getElementById('modalTitle')?.textContent || '(null)',
      bodySnippet: (document.getElementById('modalBody')?.innerHTML || '').slice(0, 200),
    };
  });
  console.log('Hash nav modal state:', JSON.stringify(hashState, null, 2));

  // Check for JS errors
  if (pageErrors.length) {
    console.log('\n=== Page errors ===');
    pageErrors.forEach(e => console.log('  ERROR:', e));
  }

  const errors = consoleLog.filter(m => m.type === 'error');
  if (errors.length) {
    console.log('\n=== Console errors ===');
    errors.forEach(e => console.log('  ', e.text));
  }

  await browser.close();
  console.log('\n=== DONE ===');
})();
