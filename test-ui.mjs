import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SHOTS = '/Volumes/2Tb-Backup/ApeClaw/test-screenshots';
mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // ── 1. Load the skills page ──
  console.log('1. Loading apeclaw.ai/skills...');
  await page.goto('https://apeclaw.ai/skills', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/01-page-loaded.png`, fullPage: false });

  // ── 2. Check stats banner ──
  console.log('2. Checking stats...');
  const stats = await page.evaluate(() => {
    const t = document.getElementById('statTotal');
    const v = document.getElementById('statVetted');
    const o = document.getElementById('statOnchain');
    const c = document.getElementById('statContributed');
    return {
      total: t?.textContent?.trim(),
      vetted: v?.textContent?.trim(),
      onchain: o?.textContent?.trim(),
      contributed: c?.textContent?.trim(),
    };
  });
  console.log('   Stats:', stats);

  // ── 3. Check skill cards rendered ──
  const cardCount = await page.$$eval('.skill-card', c => c.length);
  console.log('3. Skill cards rendered:', cardCount);

  // ── 4. Scroll to skill cards ──
  console.log('4. Scrolling to skill grid...');
  const firstCard = await page.$('.skill-card');
  if (firstCard) await firstCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/02-skill-cards.png`, fullPage: false });

  // ── 5. Test Install button ──
  console.log('5. Testing Install button...');
  const installBtn = await page.$('[data-action="install"]');
  if (installBtn) {
    const info = await installBtn.evaluate(el => ({
      text: el.textContent?.trim(),
      parent: el.closest('.skill-card')?.querySelector('h3')?.textContent?.trim(),
    }));
    console.log('   Clicking Install on:', info.parent);
    await installBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/03-install-modal.png`, fullPage: false });

    const modalState = await page.evaluate(() => {
      const bd = document.getElementById('modalBackdrop');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      return {
        visible: bd?.classList.contains('show'),
        title: title?.textContent?.trim(),
        bodyLength: body?.innerHTML?.length || 0,
        hasCode: body?.querySelector('code') !== null,
        hasCopyBtn: body?.querySelector('[data-copy-raw]') !== null,
        bodySnippet: (body?.textContent || '').slice(0, 200),
      };
    });
    console.log('   Modal:', modalState.visible ? 'VISIBLE' : 'NOT VISIBLE');
    console.log('   Title:', modalState.title);
    console.log('   Has curl command:', modalState.hasCode);
    console.log('   Has copy button:', modalState.hasCopyBtn);
    console.log('   Content preview:', modalState.bodySnippet.slice(0, 100));

    // Close modal
    const closeBtn = await page.$('#modalCancelBtn');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    console.log('   ERROR: No Install button found');
  }

  // ── 6. Test JSON button ──
  console.log('6. Testing JSON button...');
  const jsonBtn = await page.$('[data-action="json"]');
  if (jsonBtn) {
    await jsonBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/04-json-modal.png`, fullPage: false });

    const jsonModal = await page.evaluate(() => {
      const bd = document.getElementById('modalBackdrop');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      return {
        visible: bd?.classList.contains('show'),
        title: title?.textContent?.trim(),
        hasPre: body?.querySelector('pre') !== null,
        bodySnippet: (body?.textContent || '').slice(0, 200),
      };
    });
    console.log('   Modal:', jsonModal.visible ? 'VISIBLE' : 'NOT VISIBLE');
    console.log('   Title:', jsonModal.title);
    console.log('   Has JSON pre block:', jsonModal.hasPre);
    console.log('   Content preview:', jsonModal.bodySnippet.slice(0, 120));

    const closeBtn = await page.$('#modalCancelBtn');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    console.log('   ERROR: No JSON button found');
  }

  // ── 7. Test Details button ──
  console.log('7. Testing Details button...');
  const detailsBtn = await page.$('[data-action="details"]');
  if (detailsBtn) {
    await detailsBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/05-details-modal.png`, fullPage: false });

    const detailsModal = await page.evaluate(() => {
      const bd = document.getElementById('modalBackdrop');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      return {
        visible: bd?.classList.contains('show'),
        title: title?.textContent?.trim(),
        bodyLength: body?.innerHTML?.length || 0,
        bodySnippet: (body?.textContent || '').slice(0, 200),
      };
    });
    console.log('   Modal:', detailsModal.visible ? 'VISIBLE' : 'NOT VISIBLE');
    console.log('   Title:', detailsModal.title);
    console.log('   Body length:', detailsModal.bodyLength);
    console.log('   Content preview:', detailsModal.bodySnippet.slice(0, 120));

    const closeBtn = await page.$('#modalCancelBtn');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    console.log('   ERROR: No Details button found');
  }

  // ── 8. Check GitHub links ──
  console.log('8. Checking GitHub links...');
  const ghLinks = await page.$$eval('.skill-card a', links =>
    links.filter(a => a.textContent?.trim() === 'GitHub').slice(0, 3).map(a => ({
      href: a.href,
      target: a.target,
    }))
  );
  console.log('   GitHub links found:', ghLinks.length);
  ghLinks.forEach(l => console.log('   ', l.href));

  // ── 9. Test grid layout (last row) ──
  console.log('9. Checking grid layout...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SHOTS}/06-grid-bottom.png`, fullPage: false });
  console.log('   Total cards:', cardCount, '| mod 3:', cardCount % 3);

  // ── 10. Test the actual install API endpoint ──
  console.log('10. Testing /api/skills/get endpoint...');
  const apiResp = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/skills/get?slug=apeclaw-nft-autobuy');
      const status = r.status;
      if (!r.ok) return { status, error: 'HTTP ' + status };
      const d = await r.json();
      return {
        status,
        ok: d.ok,
        hasCard: !!d.card,
        cardName: d.card?.name,
        cardVersion: d.card?.version,
        cardKeys: d.card ? Object.keys(d.card) : [],
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('   API response:', JSON.stringify(apiResp, null, 2));

  // ── 11. Test search/filter ──
  console.log('11. Testing search filter...');
  const searchInput = await page.$('#importedSearch');
  if (searchInput) {
    await searchInput.fill('bridge');
    await page.waitForTimeout(1000);
    const filteredCount = await page.$$eval('.skill-card', c => c.length);
    console.log('   Search "bridge" -> cards:', filteredCount);
    await page.screenshot({ path: `${SHOTS}/07-search-filter.png`, fullPage: false });
    await searchInput.fill('');
    await page.waitForTimeout(500);
  }

  // ── 12. Test onchain filter ──
  console.log('12. Testing onchain filter...');
  const onchainCheck = await page.$('#onlyOnchain');
  if (onchainCheck) {
    await onchainCheck.check();
    await page.waitForTimeout(1000);
    const onchainCards = await page.$$eval('.skill-card', c => c.length);
    console.log('   Onchain only -> cards:', onchainCards);
    await onchainCheck.uncheck();
    await page.waitForTimeout(500);
  }

  // ── Summary ──
  console.log('\n========== SUMMARY ==========');
  console.log('Page loads:     OK');
  console.log('Stats:         ', stats);
  console.log('Cards:          ' + cardCount);
  console.log('Install modal:  ' + (await page.$('[data-action="install"]') ? 'Present' : 'Missing'));
  console.log('JSON modal:     ' + (await page.$('[data-action="json"]') ? 'Present' : 'Missing'));
  console.log('Details modal:  ' + (await page.$('[data-action="details"]') ? 'Present' : 'Missing'));
  console.log('API endpoint:   ' + (apiResp.error ? 'BROKEN (' + apiResp.error + ')' : (apiResp.hasCard ? 'Working' : 'No card')));
  console.log('Grid layout:    ' + cardCount + ' cards, ' + (cardCount % 3 === 0 ? 'even rows' : 'uneven last row'));
  if (errors.length) console.log('Page errors:    ' + errors.join('; '));
  console.log('Screenshots:    ' + SHOTS);
  console.log('=============================');

  await browser.close();
})();
