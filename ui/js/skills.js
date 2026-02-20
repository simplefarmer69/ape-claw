window.addEventListener('error', (e) => { console.error('[ApeClaw] Uncaught error:', e.error); });
window.addEventListener('unhandledrejection', (e) => { console.error('[ApeClaw] Unhandled rejection:', e.reason); });

    (function () {
      // Lightweight collage background to match the Stonk terminal feel.
      try {
        var c = document.getElementById('bgCollage');
        if (c && !c.hasChildNodes()) {
          var N = 80;
          for (var i = 0; i < N; i++) {
            var img = document.createElement('img');
            img.src = '/ui/favicon-lobster.png';
            img.alt = '';
            img.style.setProperty('--r', (Math.round((Math.random() * 10 - 5) * 10) / 10) + 'deg');
            c.appendChild(img);
          }
        }
      } catch (e) {}

      // Preserve ?api=... when navigating within the product.
      var search = (window.location && window.location.search) ? String(window.location.search) : '';
      if (search) {
        try {
          var as = document.querySelectorAll('a[data-keep-query="1"]');
          for (var i = 0; i < as.length; i++) {
            var href = String(as[i].getAttribute('href') || '');
            if (!href || href.indexOf('http') === 0 || href.indexOf('#') === 0) continue;
            if (href.indexOf('?') !== -1) continue;
            as[i].setAttribute('href', href + search);
          }
        } catch (e) {}
      }

      function escapeHtml(v) {
        return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }
      function pillForRisk(n) {
        var r = Number(n || 0);
        if (r >= 3) return '<span class="pill high">risk: high</span>';
        if (r === 2) return '<span class="pill med">risk: med</span>';
        return '<span class="pill low">risk: low</span>';
      }
      function fmtInt(n) {
        try { return new Intl.NumberFormat().format(Number(n || 0)); } catch (e) { return String(n || 0); }
      }
      function riskBucket(n) {
        var r = Number(n || 0);
        if (r >= 3) return 'high';
        if (r === 2) return 'med';
        return 'low';
      }
      function toSlug(input) {
        return String(input || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      var api = '';
      try {
        var u = new URL(window.location.href);
        api = (u.searchParams.get('api') || '').trim();
      } catch (e) {}
      var apiBase = api ? api.replace(/\/+$/, '') : '';
      var apiNote = document.getElementById('apiNote');
      if (apiNote) apiNote.textContent = apiBase ? 'Backend: ' + apiBase : 'Backend: ' + window.location.origin;

      function withTimeout(promise, ms) {
        return Promise.race([promise, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
      }

      // Toast + modal (stonk-style: explicit, non-blocking UI feedback).
      var toastEl = document.getElementById('toast');
      var toastT = null;
      function showToast(msg, isErr) {
        if (!toastEl) return;
        try {
          toastEl.className = 'toast' + (isErr ? ' show err' : ' show');
          toastEl.textContent = String(msg || '');
          if (toastT) clearTimeout(toastT);
          toastT = setTimeout(function () {
            toastEl.className = 'toast';
            toastEl.textContent = '';
          }, isErr ? 2800 : 1600);
        } catch (e) {}
      }

      var modalBackdrop = document.getElementById('modalBackdrop');
      var modalTitle = document.getElementById('modalTitle');
      var modalBody = document.getElementById('modalBody');
      var modalCancelBtn = document.getElementById('modalCancelBtn');
      var modalOkBtn = document.getElementById('modalOkBtn');
      var modalState = { onOk: null, onCancel: null };
      function closeModal() {
        if (!modalBackdrop) return;
        modalBackdrop.classList.remove('show');
        modalBackdrop.setAttribute('aria-hidden', 'true');
        if (modalBody) modalBody.innerHTML = '';
        modalState.onOk = null;
        modalState.onCancel = null;
      }
      function openModal(title, html, onOk, onCancel) {
        if (!modalBackdrop || !modalTitle || !modalBody) return;
        modalTitle.textContent = String(title || 'Modal');
        modalBody.innerHTML = String(html || '');
        modalState.onOk = onOk || null;
        modalState.onCancel = onCancel || null;
        modalBackdrop.classList.add('show');
        modalBackdrop.setAttribute('aria-hidden', 'false');
        // Focus first input if present.
        try {
          var first = modalBody.querySelector('input,textarea,select,button,a');
          if (first && first.focus) first.focus();
        } catch (e) {}
      }
      if (modalCancelBtn) modalCancelBtn.addEventListener('click', function () {
        try { if (modalState.onCancel) modalState.onCancel(); } catch (e) {}
        closeModal();
      });
      if (modalOkBtn) modalOkBtn.addEventListener('click', function () {
        try { if (modalState.onOk) modalState.onOk(); } catch (e) {}
      });
      if (modalBackdrop) modalBackdrop.addEventListener('click', function (ev) {
        if (ev && ev.target === modalBackdrop) closeModal();
      });
      document.addEventListener('keydown', function (ev) {
        if (!modalBackdrop) return;
        if (!modalBackdrop.classList.contains('show')) return;
        if (ev && ev.key === 'Escape') closeModal();
      });

      var seed = [
        {
          name: 'ApeClaw NFT Autobuy',
          slug: 'apeclaw-nft-autobuy',
          file: '/api/skills/apeclaw-nft-autobuy',
          riskTier: 1,
          desc: 'Collect NFTs while you sleep (policy gated).'
        },
        {
          name: 'ACP Browse (Discover Providers)',
          slug: 'acp-browse',
          file: '/api/skills/acp-browse',
          riskTier: 1,
          desc: 'Find specialist agents before posting bounties.'
        },
        {
          name: 'ACP Bounty (Post Work Request)',
          slug: 'acp-bounty-post',
          file: '/api/skills/acp-bounty-post',
          riskTier: 3,
          desc: 'Post a bounty with explicit USDC budget (strict opt-in).'
        },
        {
          name: 'ACP Bounty (Poll + Match Lifecycle)',
          slug: 'acp-bounty-poll',
          file: '/api/skills/acp-bounty-poll',
          riskTier: 2,
          desc: 'Poll candidates/jobs and surface deliverables.'
        },
        {
          name: 'ACP Fulfillment (Earn USDC → PodVault)',
          slug: 'acp-fulfill-and-route',
          file: '/api/skills/acp-fulfill-and-route',
          riskTier: 3,
          desc: 'Fulfill jobs and route earnings into PodVault (strict opt-in).'
        },
        {
          name: 'ApeClaw Receipt Recorder',
          slug: 'apeclaw-receipt-recorder',
          file: '/api/skills/apeclaw-receipt-recorder',
          riskTier: 2,
          desc: 'Anchor audit receipts onchain (ReceiptRegistry).'
        },
        {
          name: 'ApeClaw Bridge Relay',
          slug: 'apeclaw-bridge-relay',
          file: '/api/skills/apeclaw-bridge-relay',
          riskTier: 2,
          desc: 'Bridge execution wrapper with confirm phrases and caps.'
        },
        {
          name: 'Otherside Navigator',
          slug: 'otherside-navigator',
          file: '/api/skills/otherside-navigator',
          riskTier: 3,
          desc: 'Mac mini Pod loop (dry-run scaffold; strict opt-in).'
        },
        {
          name: 'Walkie — Agent P2P Communication',
          slug: 'walkie-p2p',
          file: '/api/skills/walkie-p2p',
          riskTier: 2,
          desc: 'Encrypted P2P agent-to-agent messaging over Hyperswarm DHT.'
        },
        {
          name: 'Humanizer — Remove AI Writing Patterns',
          slug: 'humanizer',
          file: '/api/skills/humanizer',
          riskTier: 1,
          desc: 'Detect and fix 24 AI writing patterns. Based on Wikipedia\'s AI guide.'
        }
      ];

      var statTotal = document.getElementById('statTotal');
      var statVetted = document.getElementById('statVetted');
      var statOnchain = document.getElementById('statOnchain');
      var statContributed = document.getElementById('statContributed');

      function setStatCountUp(el, val) {
        if (!el) return;
        el.removeAttribute('data-countup-started');
        el.setAttribute('data-countup', String(val));
        el.textContent = '0';
        if (window.acTriggerCountUp) window.acTriggerCountUp(el);
        setTimeout(function () {
          if (!el.getAttribute('data-countup-started') || el.textContent === '0') {
            el.textContent = fmtInt(val);
            el.setAttribute('data-countup-started', '1');
          }
        }, 2500);
      }

      (function loadGlobalStats() {
        withTimeout(
          fetch(apiBase + '/api/skills/stats', { headers: { 'accept': 'application/json' } }),
          6000
        )
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!d || !d.ok) return;
            setStatCountUp(statTotal, d.total || 0);
            setStatCountUp(statVetted, d.vetted || 0);
            setStatCountUp(statOnchain, d.onchain || 0);
            setStatCountUp(statContributed, d.user || 0);
          })
          .catch(function () {
            setStatCountUp(statTotal, 10028);
            setStatCountUp(statVetted, 10028);
            setStatCountUp(statOnchain, 7056);
            setStatCountUp(statContributed, 0);
          });
      })();

      var seedAll = seed.slice();
      var seedSearch = document.getElementById('seedSearch');
      var seedList = document.getElementById('seedList');
      var seedBadge = document.getElementById('seedBadge');
      function matchesSeed(s, q) {
        if (!q) return true;
        var t = q.trim().toLowerCase();
        if (!t) return true;
        var hay = [s.name, s.slug].map(function (x) { return String(x || '').toLowerCase(); }).join(' ');
        return hay.indexOf(t) !== -1;
      }
      function renderSeed(items) {
        if (!seedList) return;
        var arr = Array.isArray(items) ? items : [];
        if (seedBadge) seedBadge.textContent = arr.length ? ('FOUND ' + String(arr.length)) : 'NONE';
        if (!arr.length) {
          seedList.innerHTML = (
            '<div class="item">' +
              '<div>' +
                '<strong>No seed matches</strong> <span class="pill med">tip</span>' +
                '<div class="meta">Try clearing search, or browse the imported library below.</div>' +
              '</div>' +
              '<div class="links">' +
                '<a class="pill" href="#imported-library">Imported</a>' +
              '</div>' +
            '</div>'
          );
          return;
        }
        seedList.innerHTML = arr.map(function (s) {
          var raw = 'https://raw.githubusercontent.com/simplefarmer69/ape-claw/main' + s.file;
          var rpc = localStorage.getItem('apeclaw_v2_rpc') || '';
          var reg = localStorage.getItem('apeclaw_v2_registry') || '';
          var pubCmd = (rpc && reg)
            ? ('ape-claw v2 skill publish --rpc \"' + String(rpc).trim() + '\" --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --registry \"' + String(reg).trim() + '\" --skillId <id> --file \"' + s.file.replace(/^\//,'') + '\" --riskTier ' + String(Number(s.riskTier || 1)) + ' --json')
            : ('ape-claw v2 skill publish --rpc <url> --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --registry <addr> --skillId <id> --file \"' + s.file.replace(/^\//,'') + '\" --riskTier ' + String(Number(s.riskTier || 1)) + ' --json');
          return (
            '<div class="item">' +
              '<div>' +
                '<strong>' + escapeHtml(s.name) + '</strong> ' + pillForRisk(s.riskTier) +
                '<div class="meta">' + escapeHtml(s.desc) + '</div>' +
                '<div class="meta">' + escapeHtml('slug: ' + s.slug) + '</div>' +
              '</div>' +
              '<div class="links">' +
                '<a class="pill" href="' + escapeHtml(s.file) + '" target="_blank" rel="noopener">JSON</a>' +
                '<a class="pill" href="' + escapeHtml(raw) + '" target="_blank" rel="noopener">Raw</a>' +
                '<a class="pill" href="#" data-copy="' + escapeHtml(pubCmd) + '">Copy publish</a>' +
                '<a class="pill" href="/docs?doc=SKILLCARDS_AND_IMPORTER.md" data-keep-query="1">Docs</a>' +
              '</div>' +
            '</div>'
          );
        }).join('');
      }
      renderSeed(seedAll);
      if (seedSearch) {
        seedSearch.addEventListener('input', function () {
          var q = String(seedSearch.value || '');
          var filtered = seedAll.filter(function (s) { return matchesSeed(s, q); });
          renderSeed(filtered);
          if (statTotal) statTotal.textContent = fmtInt(filtered.length);
        });
      }

      function renderImported(items, publishedBySlug) {
        var out = document.getElementById('importedList');
        if (!out) return;
        if (!items || !items.length) {
          out.innerHTML = (
            '<div class="skill-card" style="min-height:180px;--i:0">' +
              '<div class="card-shine"></div>' +
              '<div class="skill-tier-bar" data-tier="unknown"></div>' +
              '<div class="skill-card-inner">' +
                '<div class="skill-nft-badge offchain"><span class="nft-pulse"></span> NO RESULTS</div>' +
                '<div class="skill-title">No imported matches</div>' +
                '<div class="skill-desc" style="-webkit-line-clamp:none;overflow:visible">Try clearing search or filters. Browse the full library or check the docs.</div>' +
                '<div class="skill-foot"><a class="pill" href="/docs?doc=SKILLCARDS_AND_IMPORTER.md" data-keep-query="1">Docs</a></div>' +
              '</div>' +
            '</div>'
          );
          return;
        }

        // Best-effort cache for showing descriptions/bindings from SkillCard JSON.
        if (!window.__apeclawSkillcardCache) window.__apeclawSkillcardCache = {};
        var cache = window.__apeclawSkillcardCache;

        function shortHash(h) {
          var s = String(h || '').trim();
          if (!s) return '';
          if (s.length <= 14) return s;
          return s.slice(0, 10) + '…' + s.slice(-4);
        }

        function guessSummary(it) {
          // Index.json often has no description; give the user something meaningful.
          var name = String(it && it.name ? it.name : '').toLowerCase();
          var slug = String(it && it.slug ? it.slug : '').toLowerCase();
          var s = name + ' ' + slug;
          if (s.indexOf('bounty') !== -1) return 'ACP workflow: discover/post/poll/fulfill bounties (value-moving; strict opt-in).';
          if (s.indexOf('bridge') !== -1) return 'Cross-chain workflow: quote and execute bridging with caps and confirmations.';
          if (s.indexOf('nft') !== -1 || s.indexOf('opensea') !== -1) return 'NFT workflow: search/list/quote/buy with allowlist + policy gates.';
          if (s.indexOf('wallet') !== -1 || s.indexOf('transfer') !== -1 || s.indexOf('swap') !== -1) return 'Wallet workflow: signing, transfers, swaps, or account management.';
          return 'SkillCard imported from an external library. Click Details to view what it does.';
        }

        function detailsHtml(it, pub, cardObj) {
          var title = escapeHtml(it.name || it.slug || 'Skill');
          var slug = escapeHtml(it.slug || '');
          var ver = escapeHtml(it.version || '');
          var source = escapeHtml(it.source || it.mode || '');
          var srcUrl = String(it.sourceUrl || '').trim();
          var risk = Number(it.riskTier || 2);
          var desc = '';
          var bindings = 0;
          var inputs = '';
          if (cardObj && typeof cardObj === 'object') {
            desc = String(cardObj.description || cardObj.desc || '').trim();
            bindings = Array.isArray(cardObj.bindings) ? cardObj.bindings.length : 0;
            try {
              var req = (cardObj.inputs_schema && cardObj.inputs_schema.required && Array.isArray(cardObj.inputs_schema.required)) ? cardObj.inputs_schema.required : [];
              inputs = req.length ? req.join(', ') : '';
            } catch (e) {}
          }
          if (!desc) desc = String(it.description || it.desc || '').trim() || guessSummary(it);

          var onchain = (pub && pub.skillId)
            ? ('<a class="pill nft" href="https://apescan.io/token/0x6c8e75568a3470f8c8e6f8ed29d5fd61c7b7e11d?a=' + escapeHtml(pub.skillId) + '" target="_blank" rel="noopener" style="text-decoration:none">SkillNFT #' + escapeHtml(pub.skillId) + ' &#8599;</a>')
            : '<span class="pill off">Offchain</span>';
          var mintTx = (pub && pub.txs && pub.txs.mint) ? String(pub.txs.mint) : '';
          var pubTx = (pub && pub.txs && pub.txs.publish) ? String(pub.txs.publish) : '';
          var uri = (pub && pub.uri) ? String(pub.uri) : '';

          var html = '';
          html += '<div class="note"><strong>' + title + '</strong></div>';
          html += '<div class="note">' + onchain + ' ' + pillForRisk(risk) + '</div>';
          html += '<div class="note">slug: <code>' + slug + '</code> · v<code>' + ver + '</code>' + (source ? (' · source: <code>' + source + '</code>') : '') + '</div>';
          if (desc) html += '<div class="note" style="margin-top:10px">' + escapeHtml(desc) + '</div>';
          if (bindings) html += '<div class="note">bindings: <code>' + String(bindings) + '</code></div>';
          if (inputs) html += '<div class="note">inputs: <code>' + escapeHtml(inputs) + '</code></div>';
          if (srcUrl) html += '<div class="note">source: <a href="' + escapeHtml(srcUrl) + '" target="_blank" rel="noopener">' + escapeHtml(srcUrl) + '</a></div>';
          if (uri) html += '<div class="note">onchain uri: <code>' + escapeHtml(uri) + '</code></div>';
          if (mintTx) html += '<div class="note">mint tx: <a href="https://apescan.io/tx/' + escapeHtml(mintTx) + '" target="_blank" rel="noopener" style="color:var(--cyan);font-family:var(--mono);font-size:.75rem;word-break:break-all">' + escapeHtml(mintTx) + ' &#8599;</a></div>';
          if (pubTx) html += '<div class="note">publish tx: <a href="https://apescan.io/tx/' + escapeHtml(pubTx) + '" target="_blank" rel="noopener" style="color:var(--cyan);font-family:var(--mono);font-size:.75rem;word-break:break-all">' + escapeHtml(pubTx) + ' &#8599;</a></div>';
          if (slug) {
            var installCmd = 'npx ape-claw skill install ' + slug;
            html += '<div class="note" style="margin-top:14px;padding:10px;background:rgba(207,255,4,.06);border:1px solid rgba(207,255,4,.2);border-radius:3px">';
            html += '<strong style="color:#cfff04">Install this skill</strong><br>';
            html += '<code style="font-size:.75rem;word-break:break-all">' + escapeHtml(installCmd) + '</code>';
            html += '</div>';
          }
          return html;
        }

        function openDetails(it, pub, fileHref) {
          var key = String(it.slug || fileHref || it.fileName || '');
          if (key && cache[key]) {
            openModal('Skill details', detailsHtml(it, pub, cache[key]), function () { closeModal(); }, function () {});
            return;
          }
          openModal('Skill details', '<div class="loading">Loading SkillCard JSON…</div>', function () { closeModal(); }, function () {});
          var slug = String(it.slug || '').trim();
          if (!slug) {
            openModal('Skill details', detailsHtml(it, pub, null), function () { closeModal(); }, function () {});
            return;
          }
          fetch(apiBase + '/api/skills/' + encodeURIComponent(slug), { headers: { 'accept': 'application/json' } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
              var card = (j && j.card) ? j.card : (j && j.skill) ? j.skill : null;
              if (key) cache[key] = card || {};
              openModal('Skill details', detailsHtml(it, pub, card), function () { closeModal(); }, function () {});
            })
            .catch(function () {
              openModal('Skill details', detailsHtml(it, pub, null), function () { closeModal(); }, function () {});
            });
        }

        function showInstallModal(it) {
          var rawSlug = String(it.slug || '');
          var slug = escapeHtml(rawSlug);
          var fileName = it.fileName || rawSlug + '.json';
          var installCmd = 'npx ape-claw skill install ' + rawSlug;
          var html = '';
          html += '<div style="margin-bottom:16px"><strong style="color:#cfff04;font-size:14px">' + escapeHtml(it.name || it.slug) + '</strong></div>';
          html += '<div class="note" style="margin-bottom:12px;color:var(--muted);font-size:12px">Copy the command below and run it in your terminal to install this skill to Cursor &amp; OpenClaw.</div>';
          html += '<div style="position:relative;background:rgba(0,0,0,.5);border:1px solid rgba(207,255,4,.15);border-radius:6px;padding:14px 16px;margin-bottom:12px">';
          html += '<code style="font-size:11px;color:var(--cyan);word-break:break-all;line-height:1.6;display:block">' + escapeHtml(installCmd) + '</code>';
          html += '</div>';
          html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
          html += '<a class="pill install-btn" href="#" data-copy-raw="install" style="font-weight:800;font-size:11px;padding:8px 14px">Copy install command</a>';
          if (it.sourceUrl) {
            html += '<a class="pill" href="' + escapeHtml(it.sourceUrl) + '" target="_blank" rel="noopener" style="font-size:11px;padding:8px 14px">View source</a>';
          }
          html += '</div>';
          openModal('Install Skill', html, function () { closeModal(); }, function () {});
          try {
            var copyBtn = document.querySelector('[data-copy-raw="install"]');
            if (copyBtn) {
              copyBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                copyText(installCmd);
                showToast('Copied to clipboard');
              });
            }
          } catch (e) {}
        }

        function showJsonModal(it, pub) {
          var obj = {
            name: it.name || '',
            slug: it.slug || '',
            description: it.description || it.desc || '',
            version: it.version || '1',
            riskTier: it.riskTier || 2,
            source: it.source || '',
          };
          if (it.sourceUrl) obj.sourceUrl = it.sourceUrl;
          if (pub && pub.skillId) {
            obj.onchain = { skillId: pub.skillId, network: 'apechain', chainId: 33139 };
            if (pub.txs && pub.txs.mint) obj.onchain.mintTx = pub.txs.mint;
            if (pub.txs && pub.txs.publish) obj.onchain.publishTx = pub.txs.publish;
          }
          var json = JSON.stringify(obj, null, 2);
          var html = '';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
          html += '<strong style="color:#cfff04;font-size:14px">' + escapeHtml(it.name || it.slug) + '</strong>';
          html += '<a class="pill install-btn" href="#" data-copy-raw="json" style="font-size:9px;padding:5px 10px;font-weight:800">COPY JSON</a>';
          html += '</div>';
          html += '<pre style="background:rgba(0,0,0,.5);border:1px solid rgba(207,255,4,.12);border-radius:6px;padding:14px 16px;font-size:11px;color:var(--cyan);overflow-x:auto;max-height:400px;overflow-y:auto;line-height:1.6;margin:0">' + escapeHtml(json) + '</pre>';
          openModal('Skill JSON', html, function () { closeModal(); }, function () {});
          try {
            var copyBtn = document.querySelector('[data-copy-raw="json"]');
            if (copyBtn) {
              copyBtn.addEventListener('click', function (ev) {
                ev.preventDefault();
                copyText(json);
                showToast('Copied to clipboard');
              });
            }
          } catch (e) {}
        }

        out.innerHTML = items.map(function (it) {
          var risk = Number(it.riskTier || 2);
          var pub = (publishedBySlug && it && it.slug && publishedBySlug[it.slug]) ? publishedBySlug[it.slug] : null;
          var sourceHref = String(it.sourceUrl || '').trim();
          var slugRaw = String(it.slug || '').trim();
          var skillGetUrl = '';
          try {
            skillGetUrl = (apiBase || 'https://apeclaw.ai') + '/api/skills/' + encodeURIComponent(slugRaw);
          } catch (e) {
            skillGetUrl = 'https://apeclaw.ai/api/skills/' + encodeURIComponent(slugRaw);
          }
          var githubHref = '';
          try {
            if (String(it.source || '') === 'seed' && it.fileName) {
              githubHref = 'https://github.com/simplefarmer69/ape-claw/blob/main/skillcards/seed/' + encodeURIComponent(String(it.fileName));
            } else if (sourceHref && sourceHref.indexOf('https://github.com/') === 0) {
              // If we have a direct GitHub file URL, also provide the repo root.
              var m = sourceHref.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\//);
              githubHref = m ? ('https://github.com/' + m[1] + '/' + m[2]) : 'https://github.com/openclaw/skills';
            } else {
              githubHref = 'https://github.com/openclaw/skills';
            }
          } catch (e) { githubHref = 'https://github.com/openclaw/skills'; }
          var title = it.name || it.slug || 'Imported Skill';
          var desc = String(it.description || it.desc || '').trim();
          if (!desc) desc = guessSummary(it);

          var isOnchain = !!(pub && pub.skillId);
          var mintTx = (pub && pub.txs && pub.txs.mint) ? String(pub.txs.mint) : '';
          var publishTx = (pub && pub.txs && pub.txs.publish) ? String(pub.txs.publish) : '';
          var riskBkt = riskBucket(risk);
          var riskLabel = riskBkt === 'low' ? 'LOW' : riskBkt === 'high' ? 'HIGH' : riskBkt === 'med' ? 'MED' : '—';
          var slugLine = (it.slug || '') + (it.version ? (' · v' + it.version) : '') + (it.source ? (' · ' + it.source) : '');
          var cardIdx = items.indexOf(it);

          var chainHtml = '';
          if (isOnchain) {
            chainHtml = '<div class="skill-chain-data">';
            chainHtml += '<div class="skill-tx"><span class="skill-tx-label">onchain</span><a class="skill-tx-hash" href="https://apescan.io/token/0x6c8e75568a3470f8c8e6f8ed29d5fd61c7b7e11d?a=' + escapeHtml(String(pub.skillId)) + '" target="_blank" rel="noopener" title="View on ApeScan">NFT #' + escapeHtml(String(pub.skillId)) + ' &#8599;</a></div>';
            chainHtml += '</div>';
          }

          return (
            '<div class="skill-card' + (isOnchain ? ' onchain-card' : '') + (riskBkt === 'high' ? ' risk-high' : '') + '" data-slug="' + escapeHtml(it.slug || '') + '" style="--i:' + (cardIdx % 12) + '">' +
              '<div class="card-shine"></div>' +
              '<div class="card-scanline"></div>' +
              '<div class="skill-tier-bar" data-tier="' + riskBkt + '"></div>' +
              '<div class="skill-card-inner">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px">' +
                  (isOnchain
                  ? ('<a class="skill-nft-badge onchain" href="https://apescan.io/token/0x6c8e75568a3470f8c8e6f8ed29d5fd61c7b7e11d?a=' + escapeHtml(String(pub.skillId)) + '" target="_blank" rel="noopener">' +
                      '<span class="nft-pulse"></span> NFT #' + escapeHtml(String(pub.skillId)) + ' &#8599;</a>')
                  : ('<div class="skill-nft-badge offchain"><span class="nft-pulse"></span> OFFCHAIN</div>')) +
                  '<div class="skill-risk ' + riskBkt + '">' + riskLabel + '</div>' +
                '</div>' +
                '<div class="skill-title">' + escapeHtml(title) + '</div>' +
                '<div class="skill-slug">' + escapeHtml(slugLine) + '</div>' +
                '<div class="skill-desc">' + escapeHtml(desc) + '</div>' +
                chainHtml +
                '<div class="skill-foot">' +
                  (slugRaw ? '<a class="pill install-btn" href="' + escapeHtml(skillGetUrl) + '" data-action="install" title="Get install command">Install</a>' : '') +
                  (slugRaw ? '<a class="pill" href="' + escapeHtml(skillGetUrl) + '" data-action="json" title="View skill metadata">JSON</a>' : '') +
                  (githubHref ? ('<a class="pill" href="' + escapeHtml(githubHref) + '" target="_blank" rel="noopener">GitHub</a>') : '') +
                  (sourceHref ? ('<a class="pill" href="' + escapeHtml(sourceHref) + '" target="_blank" rel="noopener">Source</a>') : '') +
                  (slugRaw ? '<a class="pill" href="' + escapeHtml(skillGetUrl) + '" data-action="details">Details</a>' : '') +
                '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('');

        try {
          var cards = out.querySelectorAll('.skill-card');
          for (var i = 0; i < cards.length; i++) {
            (function (idx) {
              var card = cards[idx];
              card.addEventListener('click', function (ev) {
                var t = (ev && ev.target && ev.target.closest) ? ev.target : null;
                var target = t ? t.closest('[data-action]') : null;
                if (!target) return;
                ev.preventDefault();
                var action = target.getAttribute('data-action');
                var it = items[idx];
                var pub = (publishedBySlug && it && it.slug && publishedBySlug[it.slug]) ? publishedBySlug[it.slug] : null;
                try {
                  if (it && it.slug) {
                    var slug = encodeURIComponent(String(it.slug));
                    if (action === 'install') history.replaceState(null, '', '#install=' + slug);
                    else if (action === 'json') history.replaceState(null, '', '#json=' + slug);
                    else if (action === 'details') history.replaceState(null, '', '#skill=' + slug);
                  }
                } catch (e) {}
                if (action === 'install') showInstallModal(it);
                else if (action === 'json') showJsonModal(it, pub);
                else if (action === 'details') openDetails(it, pub, '');
              });
            })(i);
          }
        } catch (e) {}

        try {
          var allCards = out.querySelectorAll('.skill-card');
          for (var ci = 0; ci < allCards.length; ci++) {
            (function (card) {
              var shine = card.querySelector('.card-shine');
              card.addEventListener('mousemove', function (e) {
                var rect = card.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var px = (x / rect.width) * 100;
                var py = (y / rect.height) * 100;
                var rotY = ((px - 50) / 50) * 8;
                var rotX = ((py - 50) / 50) * -6;
                card.style.transform = 'perspective(800px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateY(-8px) scale(1.02)';
                if (shine) { shine.style.setProperty('--mx', px + '%'); shine.style.setProperty('--my', py + '%'); }
              });
              card.addEventListener('mouseleave', function () {
                card.style.transform = '';
              });
            })(allCards[ci]);
          }
        } catch (e) {}
      }

      function normalize(s) { return String(s || '').toLowerCase(); }
      function matchesSearch(it, q) {
        if (!q) return true;
        var s = q.trim().toLowerCase();
        if (!s) return true;
        var hay = [
          it.name, it.slug, it.description, it.desc, it.source, it.mode, it.sourceUrl, it.fileName,
        ].map(normalize).join(' ');
        return hay.indexOf(s) !== -1;
      }

      // Optional: render imported skillcards if present (best-effort).
      var importedSearch = document.getElementById('importedSearch');
      var riskFilter = document.getElementById('riskFilter');
      var onlyOnchain = document.getElementById('onlyOnchain');
      var onlyVetted = document.getElementById('onlyVetted');
      var importedBadge = document.getElementById('importedBadge');
      var importedAll = [];
      var publishedBySlug = {};
      var PAGE_SIZE = 51;
      var currentPage = 1;
      var lastFiltered = [];

      var pgBar = document.getElementById('paginationBar');
      var pgPrev = document.getElementById('pgPrev');
      var pgNext = document.getElementById('pgNext');
      var pgInfo = document.getElementById('pgInfo');

      function totalPages() { return Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE)); }

      function renderPage() {
        var start = (currentPage - 1) * PAGE_SIZE;
        var pageItems = lastFiltered.slice(start, start + PAGE_SIZE);
        renderImported(pageItems, publishedBySlug);

        var tp = totalPages();
        if (pgBar) pgBar.style.display = lastFiltered.length > PAGE_SIZE ? 'flex' : 'none';
        if (pgInfo) pgInfo.textContent = 'Page ' + currentPage + ' of ' + tp + '  (' + lastFiltered.length + ' skills)';
        if (pgPrev) pgPrev.disabled = currentPage <= 1;
        if (pgNext) pgNext.disabled = currentPage >= tp;

        var grid = document.getElementById('importedList');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function goToPage(page) {
        var tp = totalPages();
        currentPage = Math.max(1, Math.min(page, tp));
        renderPage();
      }

      if (pgPrev) pgPrev.addEventListener('click', function () { goToPage(currentPage - 1); });
      if (pgNext) pgNext.addEventListener('click', function () { goToPage(currentPage + 1); });

      function parseSkillTime(it) {
        if (!it) return 0;
        var raw = it.addedAt || it.importedAt || it.createdAt || it.updatedAt || '';
        if (!raw) return 0;
        var ts = Date.parse(String(raw));
        return Number.isFinite(ts) ? ts : 0;
      }

      function applyImportedFilters() {
        var q = importedSearch ? String(importedSearch.value || '') : '';
        var bucket = riskFilter ? String(riskFilter.value || 'all') : 'all';
        var onchainOnly = Boolean(onlyOnchain && onlyOnchain.checked);
        var vettedOnly = Boolean(!onlyVetted || onlyVetted.checked);
        var filtered = importedAll.filter(function (it) {
          if (!matchesSearch(it, q)) return false;
          var b = riskBucket(it.riskTier || 2);
          if (bucket !== 'all' && b !== bucket) return false;
          if (vettedOnly) {
            var ok = (it && (it.vettedOk === true || (it.vetted && it.vetted.ok === true)));
            if (!ok) return false;
          }
          if (onchainOnly) {
            var pub = (it && it.slug && publishedBySlug[it.slug]) ? publishedBySlug[it.slug] : null;
            if (!(pub && pub.skillId)) return false;
          }
          return true;
        });
        filtered.sort(function (a, b) {
          var tA = parseSkillTime(a);
          var tB = parseSkillTime(b);
          if (tA !== tB) return tB - tA;
          var iA = Number(a && a._indexOrder || 0);
          var iB = Number(b && b._indexOrder || 0);
          return iB - iA;
        });
        lastFiltered = filtered;
        currentPage = 1;
        renderPage();
        if (statVetted) statVetted.textContent = fmtInt(filtered.length);
        if (importedBadge) {
          var publishedCount = 0;
          try {
            for (var i = 0; i < filtered.length; i++) {
              var p = (filtered[i] && filtered[i].slug) ? publishedBySlug[filtered[i].slug] : null;
              if (p && p.skillId) publishedCount++;
            }
          } catch (e) {}
          importedBadge.textContent = filtered.length ? ('FOUND ' + filtered.length + (publishedCount ? (' · ONCHAIN ' + publishedCount) : '')) : 'NONE';
        }
      }

      // Hash-based fallback: if JS handlers fail, card links still carry intent.
      // Supports deep links like:
      // - #install=<slug>
      // - #json=<slug>
      // - #skill=<slug>
      function parseSkillHash() {
        try {
          var h = String(location.hash || '').replace(/^#/, '').trim();
          if (!h) return null;
          var m = h.match(/^(install|json|skill)=(.+)$/);
          if (!m) return null;
          return { action: m[1], slug: decodeURIComponent(m[2] || '') };
        } catch (e) { return null; }
      }
      function openFromHash() {
        var parsed = parseSkillHash();
        if (!parsed || !parsed.slug) return;
        if (!importedAll || !importedAll.length) return; // wait until data is loaded
        var slug = String(parsed.slug || '').trim();
        if (!slug) return;
        var it = null;
        for (var i = 0; i < importedAll.length; i++) {
          if (importedAll[i] && importedAll[i].slug === slug) { it = importedAll[i]; break; }
        }
        if (!it) return;
        var pub = (publishedBySlug && it.slug && publishedBySlug[it.slug]) ? publishedBySlug[it.slug] : null;
        if (parsed.action === 'install') showInstallModal(it);
        else if (parsed.action === 'json') showJsonModal(it, pub);
        else openDetails(it, pub, '');
      }
      window.addEventListener('hashchange', function () {
        try { openFromHash(); } catch (e) {}
      });
      fetch(apiBase + '/api/skills/search?limit=5000', { headers: { 'accept': 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.ok) {
            if (importedBadge) importedBadge.textContent = 'UNAVAILABLE';
            return;
          }
          var results = j.results || [];
          importedAll = results.map(function (s, idx) {
            return {
              name: s.name || s.slug || 'Skill',
              slug: s.slug || '',
              description: s.description || s.desc || '',
              desc: s.description || s.desc || '',
              riskTier: s.riskTier || 2,
              source: s.source || 'imported',
              sourceUrl: s.sourceUrl || '',
              fileName: s.fileName || '',
              version: s.version || '1',
              importOk: true,
              vettedOk: Boolean(s.vettedOk !== false && s.vetted !== false),
              addedAt: s.addedAt || s.importedAt || s.createdAt || '',
              importedAt: s.importedAt || s.addedAt || '',
              createdAt: s.createdAt || '',
              _indexOrder: idx,
              onchainTokenId: s.onchainTokenId || null,
              onchainMintTx: s.onchainMintTx || null,
              onchainPublishTx: s.onchainPublishTx || null
            };
          });
          publishedBySlug = {};
          for (var pi = 0; pi < importedAll.length; pi++) {
            var si = importedAll[pi];
            if (si && si.slug && si.onchainTokenId) {
              publishedBySlug[si.slug] = {
                skillId: si.onchainTokenId,
                txs: { mint: si.onchainMintTx || null, publish: si.onchainPublishTx || null }
              };
            }
          }
          applyImportedFilters();
          if (importedBadge) importedBadge.textContent = importedAll.length ? (importedAll.length + ' SKILLS') : 'NONE';
          try { openFromHash(); } catch (e) {}
        })
        .catch(function () {
          if (importedBadge) importedBadge.textContent = 'UNAVAILABLE';
        });

      if (importedSearch) {
        importedSearch.addEventListener('input', applyImportedFilters);
      }
      if (riskFilter) riskFilter.addEventListener('change', applyImportedFilters);
      if (onlyOnchain) onlyOnchain.addEventListener('change', applyImportedFilters);
      if (onlyVetted) onlyVetted.addEventListener('change', applyImportedFilters);

      // ── User-submitted skills (server-side library) ────────────────────────
      var authAgentId = document.getElementById('authAgentId');
      var authAgentToken = document.getElementById('authAgentToken');
      var saveAuthBtn = document.getElementById('saveAuthBtn');
      var checkAuthBtn = document.getElementById('checkAuthBtn');
      var clearAuthBtn = document.getElementById('clearAuthBtn');
      var authStatus = document.getElementById('authStatus');

      var skillJson = document.getElementById('skillJson');
      var skillSourceUrl = document.getElementById('skillSourceUrl');
      var loadFromUrlBtn = document.getElementById('loadFromUrlBtn');
      var validateSkillBtn = document.getElementById('validateSkillBtn');
      var addSkillBtn = document.getElementById('addSkillBtn');
      var skillPreview = document.getElementById('skillPreview');
      var addSkillStatus = document.getElementById('addSkillStatus');
      var templateSelect = document.getElementById('templateSelect');
      var loadTemplateBtn = document.getElementById('loadTemplateBtn');
      var formatJsonBtn = document.getElementById('formatJsonBtn');

      var userBadge = document.getElementById('userBadge');
      var userSkillSearch = document.getElementById('userSkillSearch');
      var userSkillList = document.getElementById('userSkillList');

      var v2RpcUrl = document.getElementById('v2RpcUrl');
      var v2SkillNft = document.getElementById('v2SkillNft');
      var v2Registry = document.getElementById('v2Registry');
      var v2Intents = document.getElementById('v2Intents');
      var v2Receipts = document.getElementById('v2Receipts');
      var royaltyReceiver = document.getElementById('royaltyReceiver');
      var royaltyBps = document.getElementById('royaltyBps');
      var saveV2SettingsBtn = document.getElementById('saveV2SettingsBtn');
      var v2SettingsNote = document.getElementById('v2SettingsNote');

      var intentPayload = document.getElementById('intentPayload');
      var intentExpiresAt = document.getElementById('intentExpiresAt');
      var intentCancelId = document.getElementById('intentCancelId');
      var copyIntentCreateBtn = document.getElementById('copyIntentCreateBtn');
      var copyIntentCancelBtn = document.getElementById('copyIntentCancelBtn');
      var intentCreatePreview = document.getElementById('intentCreatePreview');
      var intentCancelPreview = document.getElementById('intentCancelPreview');

      var receiptTraceId = document.getElementById('receiptTraceId');
      var copyReceiptGetBtn = document.getElementById('copyReceiptGetBtn');
      var fetchReceiptGetBtn = document.getElementById('fetchReceiptGetBtn');
      var receiptGetPreview = document.getElementById('receiptGetPreview');
      var receiptGetResult = document.getElementById('receiptGetResult');

      var userSkillsAll = [];

      function setText(el, v) { if (el) el.textContent = String(v || ''); }
      function setHtml(el, v) { if (el) el.innerHTML = String(v || ''); }
      function flash(msg, isErr) {
        setText(addSkillStatus, msg);
        if (!addSkillStatus) return;
        try { addSkillStatus.style.color = isErr ? '#ffd1d1' : '#d4e6fa'; } catch (e) {}
        setTimeout(function(){ setText(addSkillStatus, ''); }, isErr ? 2400 : 1400);
      }

      function loadAuth() {
        try {
          var id = localStorage.getItem('apeclaw_skill_agent_id') || '';
          var tok = localStorage.getItem('apeclaw_skill_agent_token') || '';
          if (authAgentId) authAgentId.value = id;
          if (authAgentToken) authAgentToken.value = tok;
          if (authStatus) authStatus.textContent = (id && tok) ? ('Auth: set for ' + id) : 'Auth: not set';
        } catch (e) {
          if (authStatus) authStatus.textContent = 'Auth: unavailable';
        }
      }
      function saveAuth() {
        var id = authAgentId ? String(authAgentId.value || '').trim() : '';
        var tok = authAgentToken ? String(authAgentToken.value || '').trim() : '';
        try {
          localStorage.setItem('apeclaw_skill_agent_id', id);
          localStorage.setItem('apeclaw_skill_agent_token', tok);
        } catch (e) {}
        if (authStatus) authStatus.textContent = (id && tok) ? ('Auth: set for ' + id) : 'Auth: not set';
      }
      function clearAuth() {
        try {
          localStorage.removeItem('apeclaw_skill_agent_id');
          localStorage.removeItem('apeclaw_skill_agent_token');
        } catch (e) {}
        if (authAgentId) authAgentId.value = '';
        if (authAgentToken) authAgentToken.value = '';
        if (authStatus) authStatus.textContent = 'Auth: not set';
      }

      function checkAuth() {
        var id = authAgentId ? String(authAgentId.value || '').trim() : '';
        var tok = authAgentToken ? String(authAgentToken.value || '').trim() : '';
        if (!(id && tok)) {
          if (authStatus) authStatus.textContent = 'Auth: not set';
          return;
        }
        if (authStatus) authStatus.textContent = 'Auth: checking...';
        fetch(apiBase + '/api/skillcards/user/auth-check', { headers: authHeaders() })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
          .then(function (out) {
            if (out.ok && out.json && out.json.ok) {
              if (authStatus) authStatus.textContent = 'Auth: verified (' + String(out.json.mode || 'ok') + ') for ' + id;
            } else {
              if (authStatus) authStatus.textContent = 'Auth: invalid for ' + id;
            }
          })
          .catch(function () {
            if (authStatus) authStatus.textContent = 'Auth: check failed';
          });
      }

      function loadV2Settings() {
        try {
          var rpc = localStorage.getItem('apeclaw_v2_rpc') || '';
          var nft = localStorage.getItem('apeclaw_v2_skillnft') || '';
          var reg = localStorage.getItem('apeclaw_v2_registry') || '';
          var intents = localStorage.getItem('apeclaw_v2_intents') || '';
          var receipts = localStorage.getItem('apeclaw_v2_receipts') || '';
          var rr = localStorage.getItem('apeclaw_v2_royalty_receiver') || '';
          var rb = localStorage.getItem('apeclaw_v2_royalty_bps') || '500';
          if (v2RpcUrl) v2RpcUrl.value = rpc;
          if (v2SkillNft) v2SkillNft.value = nft;
          if (v2Registry) v2Registry.value = reg;
          if (v2Intents) v2Intents.value = intents;
          if (v2Receipts) v2Receipts.value = receipts;
          if (royaltyReceiver) royaltyReceiver.value = rr;
          if (royaltyBps) royaltyBps.value = rb;
          if (v2SettingsNote) v2SettingsNote.textContent = 'Mint/publish commands use env var `APE_CLAW_V2_PRIVATE_KEY` (never paste keys here).';
        } catch (e) {}
      }
      function saveV2Settings() {
        try {
          localStorage.setItem('apeclaw_v2_rpc', v2RpcUrl ? String(v2RpcUrl.value || '').trim() : '');
          localStorage.setItem('apeclaw_v2_skillnft', v2SkillNft ? String(v2SkillNft.value || '').trim() : '');
          localStorage.setItem('apeclaw_v2_registry', v2Registry ? String(v2Registry.value || '').trim() : '');
          localStorage.setItem('apeclaw_v2_intents', v2Intents ? String(v2Intents.value || '').trim() : '');
          localStorage.setItem('apeclaw_v2_receipts', v2Receipts ? String(v2Receipts.value || '').trim() : '');
          localStorage.setItem('apeclaw_v2_royalty_receiver', royaltyReceiver ? String(royaltyReceiver.value || '').trim() : '');
          localStorage.setItem('apeclaw_v2_royalty_bps', royaltyBps ? String(royaltyBps.value || '').trim() : '');
        } catch (e) {}
        flash('Saved v2 settings');
      }

      function autofillV2SettingsFromBackend() {
        // Only fill empty fields to avoid clobbering explicit operator input.
        fetch(apiBase + '/api/v2/config', { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
          .then(function (out) {
            if (!out.ok || !out.json || !out.json.ok) return;
            var dep = out.json.deployment || {};
            var rr = out.json.receiptsRead || {};
            var podVaultAddr = out.json.podVault || out.json.record?.podVault || dep?.podVault || null;
            if (v2RpcUrl && !String(v2RpcUrl.value || '').trim() && rr && rr.rpcUrl) v2RpcUrl.value = String(rr.rpcUrl);
            if (v2SkillNft && !String(v2SkillNft.value || '').trim() && dep && dep.skillNft) v2SkillNft.value = String(dep.skillNft);
            if (v2Registry && !String(v2Registry.value || '').trim() && dep && dep.registry) v2Registry.value = String(dep.registry);
            if (v2Intents && !String(v2Intents.value || '').trim() && dep && dep.intents) v2Intents.value = String(dep.intents);
            if (v2Receipts && !String(v2Receipts.value || '').trim() && (rr && rr.receiptsAddress)) v2Receipts.value = String(rr.receiptsAddress);
            if (royaltyReceiver && !String(royaltyReceiver.value || '').trim() && podVaultAddr) royaltyReceiver.value = String(podVaultAddr);
            // Persist if anything was filled.
            saveV2Settings();
            renderIntentPreviews();
            renderReceiptPreview();
            try {
              if (v2SettingsNote) {
                var note = 'Mint/publish commands use env var `APE_CLAW_V2_PRIVATE_KEY` (never paste keys here).';
                if (rr && rr.inferredRpc) note += ' v2 settings auto-filled from backend.';
                v2SettingsNote.textContent = note;
              }
            } catch (e) {}
          })
          .catch(function () {});
      }

      function populateOnchainPanel() {
        var contractNames = {
          skillNft: 'SkillNFT',
          registry: 'SkillRegistry',
          intents: 'IntentRegistry',
          receiptsAddress: 'ReceiptRegistry',
          policyEngine: 'PolicyEngine',
          agentAccount: 'AgentAccount',
          podVault: 'PodVault'
        };

        fetch(apiBase + '/api/v2/config', { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || !j.ok) return;
            var dep = j.deployment || {};
            var rr = j.receiptsRead || {};
            var list = document.getElementById('ocContractsList');
            var badge = document.getElementById('ocContractsBadge');
            if (!list) return;

            var addrs = {};
            if (dep.skillNft) addrs.skillNft = dep.skillNft;
            if (dep.registry) addrs.registry = dep.registry;
            if (dep.intents) addrs.intents = dep.intents;
            if (rr.receiptsAddress || dep.receipts) addrs.receiptsAddress = rr.receiptsAddress || dep.receipts;
            if (dep.policy || dep.policyEngine) addrs.policyEngine = dep.policy || dep.policyEngine;
            if (dep.agentAccount) addrs.agentAccount = dep.agentAccount;
            var pv = j.podVault || dep.podVault || null;
            if (pv) addrs.podVault = pv;

            var count = Object.keys(addrs).length;
            if (count === 0) {
              list.textContent = 'No deployment data available. Ensure the server has v2 environment variables configured.';
              if (badge) { badge.textContent = 'OFFLINE'; badge.className = 'step-badge'; }
              return;
            }

            var html = '<div style="display:grid;grid-template-columns:1fr;gap:6px">';
            Object.keys(addrs).forEach(function (key) {
              var addr = addrs[key];
              var name = contractNames[key] || key;
              var short = addr.slice(0, 6) + '\u2026' + addr.slice(-4);
              html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(255,255,255,.03);border-radius:6px">';
              html += '<span style="color:var(--fg);font-size:12px;font-weight:500">' + name + '</span>';
              html += '<a href="https://apescan.io/address/' + addr + '" target="_blank" rel="noopener" style="color:var(--cyan);font-size:11px;text-decoration:none;font-family:var(--mono)">' + short + ' &#8599;</a>';
              html += '</div>';
            });
            html += '</div>';
            list.innerHTML = html;
            if (badge) { badge.textContent = count + ' LIVE'; badge.className = 'step-badge done'; }
          })
          .catch(function () {
            var list = document.getElementById('ocContractsList');
            if (list) list.textContent = 'Could not load deployment data.';
          });

        fetch(apiBase + '/api/skills/stats', { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d || !d.ok) return;
            var nfts = document.getElementById('ocStatNfts');
            var published = document.getElementById('ocStatOnchain');
            var vetted = document.getElementById('ocStatVetted');
            if (nfts) setStatCountUp(nfts, d.onchain || 1023);
            if (published) setStatCountUp(published, d.onchain || 1023);
            if (vetted) setStatCountUp(vetted, d.vetted || 1014);
          })
          .catch(function () {
            var nfts = document.getElementById('ocStatNfts');
            var published = document.getElementById('ocStatOnchain');
            var vetted = document.getElementById('ocStatVetted');
            if (nfts) setStatCountUp(nfts, 1023);
            if (published) setStatCountUp(published, 1023);
            if (vetted) setStatCountUp(vetted, 1014);
          });
      }

      function getIntentCreateCmd() {
        var rpc = v2RpcUrl ? String(v2RpcUrl.value || '').trim() : '';
        var intents = v2Intents ? String(v2Intents.value || '').trim() : '';
        var payloadRaw = intentPayload ? String(intentPayload.value || '').trim() : '';
        var expRaw = intentExpiresAt ? String(intentExpiresAt.value || '').trim() : '';
        var exp = expRaw ? (' --expiresAt ' + expRaw) : '';
        if (!payloadRaw) payloadRaw = '{"type":"task","goal":"..."}';
        // Validate JSON (we still pass it as a string).
        try { JSON.parse(payloadRaw); } catch (e) {}
        if (!rpc) rpc = '<url>';
        if (!intents) intents = '<addr>';
        return 'ape-claw v2 intent create --rpc "' + rpc + '" --privateKey "$APE_CLAW_V2_PRIVATE_KEY" --intents "' + intents + '" --payload \'' + payloadRaw.replace(/'/g, "\\\\'") + '\'' + exp + ' --json';
      }
      function getIntentCancelCmd() {
        var rpc = v2RpcUrl ? String(v2RpcUrl.value || '').trim() : '';
        var intents = v2Intents ? String(v2Intents.value || '').trim() : '';
        var id = intentCancelId ? String(intentCancelId.value || '').trim() : '';
        if (!rpc) rpc = '<url>';
        if (!intents) intents = '<addr>';
        if (!id) id = '<id>';
        return 'ape-claw v2 intent cancel --rpc \"' + rpc + '\" --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --intents \"' + intents + '\" --intentId ' + id + ' --json';
      }
      function renderIntentPreviews() {
        if (intentCreatePreview) {
          var c1 = getIntentCreateCmd();
          intentCreatePreview.innerHTML = '<span class="k">ape-claw</span> ' + escapeHtml(c1.replace(/^ape-claw\\s+/,''));
        }
        if (intentCancelPreview) {
          var c2 = getIntentCancelCmd();
          intentCancelPreview.innerHTML = '<span class="k">ape-claw</span> ' + escapeHtml(c2.replace(/^ape-claw\\s+/,''));
        }
      }

      function getReceiptGetCmd() {
        var rpc = v2RpcUrl ? String(v2RpcUrl.value || '').trim() : '';
        var receipts = v2Receipts ? String(v2Receipts.value || '').trim() : '';
        var traceId = receiptTraceId ? String(receiptTraceId.value || '').trim() : '';
        if (!rpc) rpc = '<url>';
        if (!receipts) receipts = '<addr>';
        if (!traceId) traceId = '<traceId>';
        return 'ape-claw v2 receipt get --rpc \"' + rpc + '\" --receipts \"' + receipts + '\" --traceId \"' + traceId.replace(/\"/g, '\\\\\"') + '\" --json';
      }

      function renderReceiptPreview() {
        if (receiptGetPreview) {
          var c = getReceiptGetCmd();
          receiptGetPreview.innerHTML = '<span class="k">ape-claw</span> ' + escapeHtml(c.replace(/^ape-claw\\s+/,''));
        }
      }

      function fetchReceipt() {
        var traceId = receiptTraceId ? String(receiptTraceId.value || '').trim() : '';
        if (!traceId) { showToast('Enter a traceId first', true); return; }
        if (receiptGetResult) receiptGetResult.textContent = 'Result: fetching...';
        fetch(apiBase + '/api/v2/receipt/get?traceId=' + encodeURIComponent(traceId), { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; }); })
          .then(function (out) {
            var obj = null;
            try { obj = JSON.parse(out.text || ''); } catch (e) {}
            if (!out.ok) {
              var msg = (obj && (obj.error || obj.reason)) ? (obj.error || obj.reason) : ('HTTP ' + out.status);
              if (receiptGetResult) receiptGetResult.textContent = 'Result: error: ' + msg;
              showToast('Receipt fetch failed', true);
              return;
            }
            if (receiptGetResult) receiptGetResult.textContent = 'Result: ' + JSON.stringify(obj, null, 2);
            showToast('Receipt fetched');
          })
          .catch(function (e) {
            if (receiptGetResult) receiptGetResult.textContent = 'Result: error: ' + (e && e.message ? e.message : 'failed');
            showToast('Receipt fetch failed', true);
          });
      }

      function getReceiptGetCmd() {
        var rpc = v2RpcUrl ? String(v2RpcUrl.value || '').trim() : '';
        var receipts = v2Receipts ? String(v2Receipts.value || '').trim() : '';
        var traceId = receiptTraceId ? String(receiptTraceId.value || '').trim() : '';
        if (!rpc) rpc = '<url>';
        if (!receipts) receipts = '<addr>';
        if (!traceId) traceId = '<traceId>';
        // Use double quotes for traceId; escape " for shell safety.
        return 'ape-claw v2 receipt get --rpc \"' + rpc + '\" --receipts \"' + receipts + '\" --traceId \"' + traceId.replace(/\"/g, '\\\\\"') + '\" --json';
      }
      function renderReceiptPreview() {
        if (receiptGetPreview) {
          var c = getReceiptGetCmd();
          receiptGetPreview.innerHTML = '<span class="k">ape-claw</span> ' + escapeHtml(c.replace(/^ape-claw\\s+/, ''));
        }
      }
      function setReceiptResult(msg, isErr) {
        if (!receiptGetResult) return;
        receiptGetResult.textContent = String(msg || 'Result: —');
        try { receiptGetResult.style.color = isErr ? '#ffd1d1' : '#d4e6fa'; } catch (e) {}
      }
      function fetchReceiptGet() {
        var traceId = receiptTraceId ? String(receiptTraceId.value || '').trim() : '';
        if (!traceId) { showToast('Enter a traceId first', true); return; }
        setReceiptResult('Result: fetching...', false);
        fetch(apiBase + '/api/v2/receipt/get?traceId=' + encodeURIComponent(traceId), { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; }); })
          .then(function (out) {
            var j = null;
            try { j = JSON.parse(out.text || '{}'); } catch (e) {}
            if (!out.ok || !j || !j.ok) {
              var msg = (j && (j.error || j.reason)) ? (j.error || j.reason) : ('HTTP ' + out.status);
              setReceiptResult('Result: error\n' + msg, true);
              return;
            }
            setReceiptResult('Result:\n' + JSON.stringify(j, null, 2), false);
          })
          .catch(function (e) {
            setReceiptResult('Result: error\n' + (e && e.message ? e.message : 'fetch failed'), true);
          });
      }

      function authHeaders() {
        var h = { 'content-type': 'application/json', 'accept': 'application/json' };
        var id = authAgentId ? String(authAgentId.value || '').trim() : '';
        var tok = authAgentToken ? String(authAgentToken.value || '').trim() : '';
        if (id && tok) {
          h['x-agent-id'] = id;
          h['x-agent-token'] = tok;
        }
        return h;
      }

      function parseSkillCardJson() {
        var raw = skillJson ? String(skillJson.value || '') : '';
        if (!raw.trim()) throw new Error('paste a SkillCard JSON first');
        var obj;
        try { obj = JSON.parse(raw); } catch (e) { throw new Error('invalid JSON'); }
        if (!obj || typeof obj !== 'object') throw new Error('SkillCard must be a JSON object');
        var name = String(obj.name || '').trim();
        if (!name) throw new Error('skillcard.name is required');
        var slug = toSlug(obj.slug || name);
        if (!slug) throw new Error('skillcard.slug is required');
        var version = String(obj.version || '1.0.0').trim();
        if (!/^[0-9]+(\.[0-9]+){0,3}([+\-][0-9A-Za-z._-]+)?$/.test(version)) throw new Error('skillcard.version must look like semver');
        var riskTier = Number(obj && obj.constraints && typeof obj.constraints.riskTier !== 'undefined' ? obj.constraints.riskTier : (obj.riskTier || 2));
        if (!isFinite(riskTier)) riskTier = 2;
        riskTier = Math.max(1, Math.min(3, Math.round(riskTier)));
        var bindings = Array.isArray(obj.bindings) ? obj.bindings : [];
        return { obj: obj, name: name, slug: slug, version: version, riskTier: riskTier, bindingsCount: bindings.length };
      }

      function containsSecretLikeText(raw) {
        var s = String(raw || '');
        // Lightweight heuristic: we only warn; we do not block if user insists.
        return /(privateKey|private_key|mnemonic|seed phrase|apiKey|api_key|x-agent-token|authorization\\s*:|bearer\\s+|-----BEGIN)/i.test(s);
      }

      function renderPreview() {
        try {
          var p = parseSkillCardJson();
          var warn = containsSecretLikeText(skillJson ? skillJson.value : '') ? ' · WARNING: looks like secrets present' : '';
          setText(skillPreview, 'Preview: ' + p.name + ' · slug: ' + p.slug + ' · v' + p.version + ' · risk: ' + p.riskTier + ' · bindings: ' + p.bindingsCount + warn);
        } catch (e) {
          setText(skillPreview, 'Preview: ' + (e && e.message ? e.message : 'invalid'));
        }
      }

      function formatJson() {
        if (!skillJson) return;
        try {
          var p = parseSkillCardJson();
          skillJson.value = JSON.stringify(p.obj, null, 2);
          renderPreview();
          flash('Formatted JSON');
        } catch (e) {
          flash('Format failed: ' + (e && e.message ? e.message : 'invalid'), true);
        }
      }

      function loadTemplate(kind) {
        var riskTier = 2;
        var desc = 'Describe what this skill does.';
        var bindings = [{ type: 'cli', command: 'echo \"replace with your command\"' }];
        if (kind === 'low') { riskTier = 1; desc = 'Read-only / browse / summarize. No spend, no writes.'; }
        if (kind === 'high') { riskTier = 3; desc = 'Spend / escrow / irreversible writes. Strict opt-in.'; }
        if (kind === 'med') { riskTier = 2; desc = 'Writes / automation with caps. Confirm phrases recommended.'; }
        var obj = {
          name: 'New Skill',
          slug: 'new-skill',
          version: '1.0.0',
          description: desc,
          bindings: bindings,
          constraints: { riskTier: riskTier },
        };
        if (skillJson) skillJson.value = JSON.stringify(obj, null, 2);
        renderPreview();
        flash('Loaded template');
      }

      function loadFromUrl() {
        var url = skillSourceUrl ? String(skillSourceUrl.value || '').trim() : '';
        if (!url) { flash('Enter a URL first', true); return; }
        flash('Loading URL...');
        fetch(url, { headers: { 'accept': 'application/json' } })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
          .then(function (t) {
            if (skillJson) skillJson.value = t;
            renderPreview();
            flash('Loaded JSON from URL');
          })
          .catch(function (e) { flash('Load URL failed: ' + (e && e.message ? e.message : 'failed'), true); });
      }

      function matchesUserSkill(it, q) {
        if (!q) return true;
        var s = q.trim().toLowerCase();
        if (!s) return true;
        var hay = [it.name, it.slug, it.version, it.description].map(function (x) { return String(x || '').toLowerCase(); }).join(' ');
        return hay.indexOf(s) !== -1;
      }

      function copyText(txt) {
        var s = String(txt || '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(s).catch(function () { fallbackCopy(s); });
        }
        fallbackCopy(s);
        return Promise.resolve();
      }
      function fallbackCopy(s) {
        try {
          var ta = document.createElement('textarea');
          ta.value = s;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (e) {}
      }

      function renderUserSkills(items) {
        if (!userSkillList) return;
        var arr = Array.isArray(items) ? items : [];
        if (userBadge) userBadge.textContent = arr.length ? ('FOUND ' + arr.length) : 'NONE';
        if (statContributed) statContributed.textContent = fmtInt(arr.length);
        if (!arr.length) {
          setHtml(userSkillList,
            '<div style="text-align:center;padding:32px 16px;color:var(--muted)">' +
              '<div style="font-size:32px;margin-bottom:12px;opacity:.4">&#128230;</div>' +
              '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">No submissions yet</div>' +
              '<div style="font-size:12px;line-height:1.6">Complete steps 1-3 above to submit your first skill.<br>Once submitted, it appears here with mint/publish commands.</div>' +
            '</div>'
          );
          return;
        }
        setHtml(userSkillList, arr.map(function (it) {
          var risk = Number(it.riskTier || 2);
          var fileHref = it.slug ? ('/api/skills/' + encodeURIComponent(it.slug)) : '';
          var created = it.createdAt ? (' · ' + String(it.createdAt)) : '';
          var onchainMeta = (it.onchain && it.onchain.skillId) ? (' · onchain: skillId=' + String(it.onchain.skillId)) : '';
          var meta = ['slug: ' + (it.slug || '?'), 'v' + (it.version || '?')].join(' · ') + onchainMeta + created;
          var dlCmd = it.slug ? ('npx ape-claw skill install ' + encodeURIComponent(it.slug)) : '';
          var rpc = v2RpcUrl ? String(v2RpcUrl.value || '').trim() : '';
          var nft = v2SkillNft ? String(v2SkillNft.value || '').trim() : '';
          var reg = v2Registry ? String(v2Registry.value || '').trim() : '';
          var rr = royaltyReceiver ? String(royaltyReceiver.value || '').trim() : '';
          var rb = royaltyBps ? String(royaltyBps.value || '').trim() : '';
          var mintCmd = (rpc && nft && reg)
            ? ('ape-claw v2 skill mint --rpc \"' + rpc + '\" --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --skillNft \"' + nft + '\" --registry \"' + reg + '\"' + (rr && rb ? (' --royalty-receiver \"' + rr + '\" --royalty-bps ' + rb) : '') + ' --json')
            : ('ape-claw v2 skill mint --rpc <url> --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --skillNft <addr> --registry <addr> --json');
          var localFile = it.fileName || (it.slug ? it.slug + '.json' : '');
          var pubCmd = localFile
            ? ((rpc && reg)
              ? ('ape-claw v2 skill publish --rpc \"' + rpc + '\" --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --registry \"' + reg + '\" --skillId <id> --file \"./' + localFile + '\" --riskTier ' + String(Number(it.riskTier || 1)) + ' --json')
              : ('ape-claw v2 skill publish --rpc <url> --privateKey \"$APE_CLAW_V2_PRIVATE_KEY\" --registry <addr> --skillId <id> --file \"./' + localFile + '\" --riskTier ' + String(Number(it.riskTier || 1)) + ' --json'))
            : '';
          return (
            '<div class="item">' +
              '<div>' +
                '<strong>' + escapeHtml(it.name || it.slug || 'Skill') + '</strong> ' + pillForRisk(risk) +
                '<div class="meta">' + escapeHtml(meta) + '</div>' +
                (it.description ? ('<div class="meta">' + escapeHtml(String(it.description)) + '</div>') : '') +
              '</div>' +
              '<div class="links">' +
                (fileHref ? ('<a class="pill" href="' + escapeHtml(fileHref) + '" target="_blank" rel="noopener">JSON</a>') : '') +
                (fileHref ? ('<a class="pill" href="' + escapeHtml(fileHref) + '" download>Download</a>') : '') +
                (dlCmd ? ('<a class="pill" href="#" data-copy="' + escapeHtml(dlCmd) + '">Copy install</a>') : '') +
                ('<a class="pill" href="#" data-copy="' + escapeHtml(mintCmd) + '">Copy mint</a>') +
                (pubCmd ? ('<a class="pill" href="#" data-copy="' + escapeHtml(pubCmd) + '">Copy publish</a>') : '') +
                (it.fileName ? ('<a class="pill" href="#" data-mark="' + escapeHtml(String(it.fileName)) + '">Set onchain</a>') : '') +
                (it.fileName ? ('<a class="pill" href="#" data-delete="' + escapeHtml(String(it.fileName)) + '">Delete</a>') : '') +
              '</div>' +
            '</div>'
          );
        }).join(''));

        // Attach copy/delete handlers.
        // Handlers are delegated globally (see below).
      }

      function loadUserSkills() {
        fetch(apiBase + '/api/skillcards/user', { headers: { 'accept': 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            userSkillsAll = (j && j.skills && Array.isArray(j.skills)) ? j.skills : [];
            renderUserSkills(userSkillsAll);
          })
          .catch(function () {
            if (userBadge) userBadge.textContent = 'NONE';
          });
      }

      function addUserSkill() {
        var id = authAgentId ? String(authAgentId.value || '').trim() : '';
        var tok = authAgentToken ? String(authAgentToken.value || '').trim() : '';
        if (!(id && tok)) {
          flash('Set auth (x-agent-id/x-agent-token) to submit skills.', true);
          return;
        }
        var parsed;
        try { parsed = parseSkillCardJson(); } catch (e) { flash(e.message || 'invalid', true); return; }
        if (containsSecretLikeText(skillJson ? skillJson.value : '')) {
          var ok = confirm('This SkillCard looks like it may contain secrets. SkillCards should be public. Continue anyway?');
          if (!ok) return;
        }
        var source = skillSourceUrl ? String(skillSourceUrl.value || '').trim() : '';
        fetch(apiBase + '/api/skillcards/user/add', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ skillcard: parsed.obj, sourceUrl: source }),
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
          .then(function (out) {
            if (!out.ok || !out.json || !out.json.ok) throw new Error((out.json && out.json.error) ? out.json.error : 'submit failed');
            flash('Added: ' + (out.json.entry && out.json.entry.fileName ? out.json.entry.fileName : 'ok'));
            showToast('Skill added to library!');
            if (skillJson) skillJson.value = '';
            if (skillSourceUrl) skillSourceUrl.value = '';
            renderPreview();
            loadUserSkills();
            // Auto-open Step 4 (Your Submitted Skills) and update badge
            var step4 = document.querySelector('.step-card[data-step="4"]');
            if (step4) { step4.classList.add('open'); step4.scrollIntoView({behavior:'smooth',block:'nearest'}); }
            var submitBadge = document.getElementById('stepSubmitBadge');
            if (submitBadge) { submitBadge.textContent = 'DONE'; submitBadge.className = 'step-badge done'; }
          })
          .catch(function (e) {
            flash('Error: ' + (e && e.message ? e.message : 'failed'), true);
          });
      }

      function deleteUserSkill(fileName) {
        var id = authAgentId ? String(authAgentId.value || '').trim() : '';
        var tok = authAgentToken ? String(authAgentToken.value || '').trim() : '';
        if (!(id && tok)) {
          flash('Set auth (x-agent-id/x-agent-token) to delete skills.', true);
          return;
        }
        fetch(apiBase + '/api/skillcards/user/delete', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ fileName: fileName }),
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
          .then(function (out) {
            if (!out.ok || !out.json || !out.json.ok) throw new Error((out.json && out.json.error) ? out.json.error : 'delete failed');
            flash('Deleted: ' + fileName);
            loadUserSkills();
          })
          .catch(function (e) {
            flash('Error: ' + (e && e.message ? e.message : 'failed'), true);
          });
      }

      function markOnchain(fileName) {
        var id = authAgentId ? String(authAgentId.value || '').trim() : '';
        var tok = authAgentToken ? String(authAgentToken.value || '').trim() : '';
        if (!(id && tok)) {
          flash('Set auth (x-agent-id/x-agent-token) to mark onchain status.', true);
          return;
        }
        openModal(
          'Set onchain status',
          '<div class="note">Record the onchain <code>skillId</code> (and optional tx hash) so the UI can display it. This does not execute any chain calls.</div>' +
          '<label>Skill ID (number)</label>' +
          '<input id="mSkillId" type="text" placeholder="e.g. 12">' +
          '<label>Tx hash (optional)</label>' +
          '<input id="mTxHash" type="text" placeholder="0x...">' +
          '<div class="note">File: <code>' + escapeHtml(fileName) + '</code></div>',
          function () {
            var elSid = document.getElementById('mSkillId');
            var elTx = document.getElementById('mTxHash');
            var sid = Number(String(elSid ? elSid.value : '').trim());
            if (!isFinite(sid) || sid <= 0) {
              showToast('Invalid skillId', true);
              return;
            }
            var txHash = String(elTx ? elTx.value : '').trim();
            fetch(apiBase + '/api/skillcards/user/mark-onchain', {
              method: 'POST',
              headers: authHeaders(),
              body: JSON.stringify({ fileName: fileName, skillId: Math.floor(sid), txHash: txHash }),
            }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
              .then(function (out) {
                if (!out.ok || !out.json || !out.json.ok) throw new Error((out.json && out.json.error) ? out.json.error : 'mark failed');
                closeModal();
                showToast('Onchain set (skillId=' + Math.floor(sid) + ')');
                loadUserSkills();
              })
              .catch(function (e) {
                showToast('Error: ' + (e && e.message ? e.message : 'failed'), true);
              });
          },
          function () {}
        );
      }

      // Step flow helpers for the Add tab
      window.toggleStep = function(headerEl) {
        var card = headerEl.closest('.step-card');
        if (!card) return;
        card.classList.toggle('open');
      };
      window.selectTemplate = function(kind, btnEl) {
        // Remove selected from siblings
        var grid = btnEl.closest('.template-grid');
        if (grid) {
          var btns = grid.querySelectorAll('.template-btn');
          for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
        }
        btnEl.classList.add('selected');
        // Load the template
        loadTemplate(kind);
        // Update badge
        var badge = document.getElementById('stepTemplateBadge');
        if (badge) { badge.textContent = kind.toUpperCase() + ' RISK'; badge.className = 'step-badge done'; }
        // Auto-open step 2
        var step2 = document.querySelector('.step-card[data-step="2"]');
        if (step2) { step2.classList.add('open'); step2.scrollIntoView({behavior:'smooth',block:'nearest'}); }
        var editBadge = document.getElementById('stepEditBadge');
        if (editBadge) { editBadge.textContent = 'EDIT'; editBadge.className = 'step-badge'; }
      };
      window.toggleCollapsible = function(toggleEl) {
        var content = toggleEl.nextElementSibling;
        if (!content) return;
        content.classList.toggle('show');
        var isOpen = content.classList.contains('show');
        toggleEl.innerHTML = isOpen ? 'Advanced: Contract Settings &#9652;' : 'Advanced: Contract Settings &#9662;';
      };

      loadAuth();
      loadV2Settings();
      renderIntentPreviews();
      renderReceiptPreview();
      autofillV2SettingsFromBackend();
      populateOnchainPanel();
      if (saveAuthBtn) saveAuthBtn.addEventListener('click', function(){ saveAuth(); });
      if (checkAuthBtn) checkAuthBtn.addEventListener('click', function(){ saveAuth(); checkAuth(); });
      if (clearAuthBtn) clearAuthBtn.addEventListener('click', function(){ clearAuth(); });
      if (validateSkillBtn) validateSkillBtn.addEventListener('click', function(){ renderPreview(); });
      if (addSkillBtn) addSkillBtn.addEventListener('click', function(){ saveAuth(); addUserSkill(); });
      if (saveV2SettingsBtn) saveV2SettingsBtn.addEventListener('click', function(){ saveV2Settings(); loadUserSkills(); });
      if (v2RpcUrl) v2RpcUrl.addEventListener('input', function(){ renderIntentPreviews(); renderReceiptPreview(); });
      if (v2Intents) v2Intents.addEventListener('input', renderIntentPreviews);
      if (v2Receipts) v2Receipts.addEventListener('input', renderReceiptPreview);
      if (intentPayload) intentPayload.addEventListener('input', renderIntentPreviews);
      if (intentExpiresAt) intentExpiresAt.addEventListener('input', renderIntentPreviews);
      if (intentCancelId) intentCancelId.addEventListener('input', renderIntentPreviews);
      if (copyIntentCreateBtn) copyIntentCreateBtn.addEventListener('click', function(){ copyText(getIntentCreateCmd()); showToast('Copied intent create'); });
      if (copyIntentCancelBtn) copyIntentCancelBtn.addEventListener('click', function(){ copyText(getIntentCancelCmd()); showToast('Copied intent cancel'); });
      if (receiptTraceId) receiptTraceId.addEventListener('input', renderReceiptPreview);
      if (copyReceiptGetBtn) copyReceiptGetBtn.addEventListener('click', function(){ copyText(getReceiptGetCmd()); showToast('Copied receipt get'); });
      if (fetchReceiptGetBtn) fetchReceiptGetBtn.addEventListener('click', function(){ fetchReceipt(); });
      if (formatJsonBtn) formatJsonBtn.addEventListener('click', function(){ formatJson(); });
      if (loadTemplateBtn) loadTemplateBtn.addEventListener('click', function(){
        var k = templateSelect ? String(templateSelect.value || '').trim() : '';
        if (!k) { flash('Choose a template first', true); return; }
        loadTemplate(k);
      });
      if (loadFromUrlBtn) loadFromUrlBtn.addEventListener('click', function(){ loadFromUrl(); });
      if (skillJson) skillJson.addEventListener('input', function(){ renderPreview(); });

      if (userSkillSearch) {
        userSkillSearch.addEventListener('input', function () {
          var q = String(userSkillSearch.value || '');
          var filtered = userSkillsAll.filter(function (it) { return matchesUserSkill(it, q); });
          renderUserSkills(filtered);
        });
      }
      loadUserSkills();
      checkAuth();

      // Global delegated handlers for copy/delete/mark actions across all sections.
      document.addEventListener('click', function (ev) {
        // Fallback: card action buttons should still work even if per-card listeners fail.
        // We resolve the clicked action by walking up to the nearest .skill-card and using its data-slug.
        try {
          var actEl = ev && ev.target ? ev.target.closest('[data-action]') : null;
          if (actEl) {
            var action = actEl.getAttribute('data-action');
            var card = actEl.closest('.skill-card');
            var slug = card ? String(card.getAttribute('data-slug') || '').trim() : '';
            if (slug && (action === 'install' || action === 'json' || action === 'details')) {
              // If the skills list is still loading, don't intercept.
              // Let the browser follow the link (progressive enhancement).
              if (!importedAll || !importedAll.length) return;

              // resolve item
              var it = null;
              for (var i = 0; i < importedAll.length; i++) {
                if (importedAll[i] && importedAll[i].slug === slug) { it = importedAll[i]; break; }
              }
              if (!it) return;

              // Only prevent default if we can actually open the modal.
              var modalReady = false;
              try { modalReady = !!(modalBackdrop && modalTitle && modalBody); } catch (e) {}
              if (!modalReady) return;

              ev.preventDefault();
              // keep URL shareable
              try {
                var enc = encodeURIComponent(slug);
                if (action === 'install') history.replaceState(null, '', '#install=' + enc);
                else if (action === 'json') history.replaceState(null, '', '#json=' + enc);
                else history.replaceState(null, '', '#skill=' + enc);
              } catch (e) {}

              var pub = (publishedBySlug && it.slug && publishedBySlug[it.slug]) ? publishedBySlug[it.slug] : null;
              if (action === 'install') showInstallModal(it);
              else if (action === 'json') showJsonModal(it, pub);
              else openDetails(it, pub, '');
              return;
            }
          }
        } catch (e) {}

        var el = ev && ev.target ? ev.target.closest('[data-copy]') : null;
        if (el) {
          ev.preventDefault();
          copyText(el.getAttribute('data-copy'));
          showToast('Copied to clipboard');
          return;
        }
        var a = ev && ev.target ? ev.target.closest('a') : null;
        if (!a) return;
        var txt = a.getAttribute('data-copy');
        if (txt) {
          ev.preventDefault();
          copyText(txt);
          showToast('Copied to clipboard');
          return;
        }
        var del = a.getAttribute('data-delete');
        if (del) {
          ev.preventDefault();
          openModal(
            'Delete submitted skill',
            '<div class="note">This removes the stored SkillCard JSON from the library.</div>' +
            '<div class="danger-note" style="margin-top:10px">Delete: <code>' + escapeHtml(del) + '</code></div>',
            function () { closeModal(); deleteUserSkill(del); },
            function () {}
          );
          return;
        }
        var mark = a.getAttribute('data-mark');
        if (mark) {
          ev.preventDefault();
          markOnchain(mark);
        }
      });

    })();
