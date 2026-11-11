/* ═══════════════════════════════════════════════════════════════
   AJINKYA MOHARIR — RAG PORTFOLIO
   Interactive Retrieval & Verification Engine — Vanilla ES6
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  document.documentElement.classList.add('js-ready');

  // ─── DOM References ───
  const queryInput = document.getElementById('query-input');
  const queryClearBtn = document.getElementById('query-clear');
  const kbdHint = document.getElementById('kbd-hint');
  const filterChips = document.querySelectorAll('.filter-chip');
  const chunkCards = Array.from(document.querySelectorAll('.chunk-card'));
  const filterableSections = Array.from(document.querySelectorAll('.filterable-section'));
  const archiveItems = Array.from(document.querySelectorAll('.archive-item'));
  const archiveSection = document.getElementById('archive-section');
  const featuredHeading = document.getElementById('featured-projects-heading');
  const retrievalTelemetry = document.getElementById('retrieval-telemetry');

  const synthesisWindow = document.getElementById('rag-synthesis-window');
  const synthesisMetrics = document.getElementById('synthesis-metrics');
  const synthesisText = document.getElementById('synthesis-text');
  const synthesisCitations = document.getElementById('synthesis-citations');
  const synthesisResetBtn = document.getElementById('synthesis-reset');

  const emptyState = document.getElementById('empty-retrieval-state');
  const emptyClearBtn = document.getElementById('empty-clear-btn');
  const suggestionPills = document.querySelectorAll('.suggestion-pill[data-suggest]');

  const themeToggle = document.getElementById('theme-toggle');
  const modal = document.getElementById('certificate-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalDetail = document.getElementById('modal-detail');
  const modalMetaId = document.getElementById('modal-meta-id');
  const modalMetaFile = document.getElementById('modal-meta-file');
  const modalPdfFrame = document.getElementById('modal-pdf-frame');
  const modalPdfLoading = document.getElementById('modal-pdf-loading');
  const modalOpenNewTab = document.getElementById('modal-open-new-tab');
  const modalDownloadPdf = document.getElementById('modal-download-pdf');
  const modalClose = document.getElementById('modal-close');
  const modalTriggers = document.querySelectorAll('.modal-trigger');

  const archiveToggle = document.getElementById('archive-toggle');
  const archiveDrawer = document.getElementById('archive-drawer');
  const scrollTopBtn = document.getElementById('scroll-top');
  const currentDateEl = document.getElementById('current-date');

  // ─── Current Date & Platform Shortcut Hint ───
  if (currentDateEl) {
    currentDateEl.textContent = new Date().toISOString().split('T')[0];
  }
  if (kbdHint && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')) {
    kbdHint.textContent = '⌘ K';
  }

  // ═══════════════════ THEME TOGGLE ═══════════════════
  function initTheme() {
    const saved = localStorage.getItem('portfolio-theme');
    if (saved === 'dark') {
      document.body.classList.add('dark-mode');
    } else if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-mode');
    }
  }

  initTheme();

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('portfolio-theme', isDark ? 'dark' : 'light');
  });

  // ═══════════════════ RAG RETRIEVAL & SYNTHESIS ENGINE ═══════════════════
  let activeFilter = 'all';
  let userOpenedArchive = false;
  const totalChunks = chunkCards.length;

  const FILTER_SYNTHESIS_COPY = {
    hackathon: 'Retrieved top hackathon & honors artifacts: ACM PVG Buildathon Winner (Team Kingfisher — Civicfixx), Adobe University Hackathon 2026, ISRO Bharatiya Antariksh Hackathon 2026, and Smart India Hackathon 2026 (ColorNex).',
    ai: 'Retrieved AI, RAG, and ML knowledge chunks covering Conventional & Agentic RAG, LangChain, LangGraph, RAG Earnings Call, Industrial Predictive Maintenance (RUL & Anomaly Detection), and Rule-Based Expert Systems.',
    fullstack: 'Retrieved full-stack web builds across PERN (PostgreSQL, Express, React, Node.js) and MERN stacks — including Samvardhan Foundation Production Site, College Cricket Manager, Civicfixx, and deployment infra.',
    data: 'Retrieved data engineering, database, and ML pipeline chunks: OpExWorks Predictive Maintenance (RUL & Anomaly Detection), PostgreSQL/MongoDB systems, ASD SVC Prediction, and TPSA AI&DS data management.',
    leadership: 'Retrieved campus leadership & sports chunks: PVGCOET College Cricket Team bowler (inspiring College Cricket Manager), EDC Finance Team, and TPSA Internal Data Management.'
  };

  function getCardTitle(card) {
    const heading = card.querySelector('h3, h4, .archive-item-name');
    return heading ? heading.textContent.trim() : card.dataset.chunkId;
  }

  function computeRelevanceScore(card, queryTerms) {
    const base = parseFloat(card.dataset.baseScore || '0.85');
    if (!queryTerms.length) {
      return base;
    }

    const titleText = getCardTitle(card).toLowerCase();
    const tagsText = (card.dataset.tags || '').toLowerCase();
    const bodyText = card.textContent.toLowerCase();

    let hits = 0;
    let boost = 0;

    queryTerms.forEach(term => {
      const inTitle = titleText.includes(term);
      const inTags = tagsText.includes(term);
      const inBody = bodyText.includes(term);
      if (inTitle || inTags || inBody) {
        hits += 1;
        if (inTitle) boost += 0.08;
        else if (inTags) boost += 0.05;
        else boost += 0.02;
      }
    });

    if (hits === 0) return 0;
    const coverage = hits / queryTerms.length;
    const score = Math.min(0.99, Math.max(0.72, 0.72 + coverage * 0.16 + boost));
    return score;
  }

  function updateSimilarityBadge(card, score) {
    const badge = card.querySelector('.similarity-badge');
    if (badge) {
      badge.textContent = `similarity: ${score.toFixed(2)}`;
    }
  }

  function setArchiveOpen(isOpen) {
    archiveToggle.setAttribute('aria-expanded', String(isOpen));
    archiveDrawer.hidden = !isOpen;
  }

  function runRetrieval() {
    const t0 = performance.now();
    const rawQuery = queryInput.value.trim();
    const queryLower = rawQuery.toLowerCase();
    const queryTerms = queryLower ? queryLower.split(/\s+/).filter(Boolean) : [];
    const isSearching = queryTerms.length > 0;
    const isFiltering = isSearching || activeFilter !== 'all';

    queryClearBtn.hidden = !isSearching;
    document.body.classList.toggle('is-filtering', isFiltering);

    const matchedCards = [];

    chunkCards.forEach(card => {
      const tags = (card.dataset.tags || '').toLowerCase().split(',');
      let matched = false;
      let score = parseFloat(card.dataset.baseScore || '0.85');

      if (isSearching) {
        score = computeRelevanceScore(card, queryTerms);
        matched = score > 0;
        card.classList.toggle('search-match', matched);
      } else {
        card.classList.remove('search-match');
        matched = activeFilter === 'all' || tags.includes(activeFilter);
      }

      if (matched) {
        card.classList.remove('card-hidden');
        card.classList.add('visible');
        updateSimilarityBadge(card, score);
        matchedCards.push({ card, score, id: card.dataset.chunkId, title: getCardTitle(card) });
      } else {
        card.classList.add('card-hidden');
      }
    });

    // Archive drawer visibility & auto-expand on archive search hits
    const visibleArchiveCount = archiveItems.filter(item => !item.classList.contains('card-hidden')).length;
    if (archiveSection) {
      archiveSection.hidden = visibleArchiveCount === 0;
    }
    if (isSearching && visibleArchiveCount > 0) {
      setArchiveOpen(true);
    } else if (!isSearching) {
      setArchiveOpen(userOpenedArchive);
    }

    // Hide featured projects heading if no featured project matches
    const featuredCards = Array.from(document.querySelectorAll('.project-card'));
    const visibleFeaturedCount = featuredCards.filter(card => !card.classList.contains('card-hidden')).length;
    if (featuredHeading) {
      featuredHeading.hidden = visibleFeaturedCount === 0;
    }

    // Collapse empty sections so no orphaned headers remain
    filterableSections.forEach(section => {
      const sectionCards = Array.from(section.querySelectorAll('.chunk-card'));
      const anyVisible = sectionCards.some(card => !card.classList.contains('card-hidden'));
      section.hidden = !anyVisible;
    });

    const elapsedMs = Math.max(2, Math.round(performance.now() - t0 + 3));
    const retrievedCount = matchedCards.length;

    // Update telemetry strip
    if (retrievalTelemetry) {
      if (isSearching) {
        retrievalTelemetry.textContent = `corpus: ${totalChunks} chunks · retrieved: ${retrievedCount} · query: "${rawQuery}" · latency: ${elapsedMs}ms`;
      } else if (activeFilter !== 'all') {
        retrievalTelemetry.textContent = `corpus: ${totalChunks} chunks · retrieved: ${retrievedCount} · filter: ${activeFilter} · latency: ${elapsedMs}ms`;
      } else {
        retrievalTelemetry.textContent = `corpus: ${totalChunks} chunks · retrieved: ${totalChunks} · mode: full-index`;
      }
    }

    // Empty state vs Synthesized Response Window
    emptyState.hidden = !(isFiltering && retrievedCount === 0);

    if (isFiltering && retrievedCount > 0) {
      matchedCards.sort((a, b) => b.score - a.score);
      const topScore = matchedCards[0].score;
      const topMatches = matchedCards.slice(0, 6);

      synthesisMetrics.textContent = `retrieved: ${retrievedCount} chunks · top_similarity: ${topScore.toFixed(2)} · latency: ${elapsedMs}ms`;

      if (isSearching) {
        const namesList = topMatches.slice(0, 4).map(m => m.title).join(', ');
        const extra = retrievedCount > 4 ? ` (+${retrievedCount - 4} more)` : '';
        synthesisText.textContent = `Matched ${retrievedCount} context chunk${retrievedCount === 1 ? '' : 's'} for "${rawQuery}". Highest-ranked context: ${namesList}${extra}. Select any citation below to jump directly to the source chunk.`;
      } else {
        synthesisText.textContent = FILTER_SYNTHESIS_COPY[activeFilter] || `Showing ${retrievedCount} context chunks matching "${activeFilter}".`;
      }

      synthesisCitations.innerHTML = '';
      topMatches.forEach(match => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'citation-chip';
        btn.textContent = `[${match.id}] ${match.title} (${match.score.toFixed(2)})`;
        btn.addEventListener('click', () => {
          if (match.card.classList.contains('archive-item')) {
            setArchiveOpen(true);
          }
          match.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          match.card.classList.remove('citation-flash');
          void match.card.offsetWidth;
          match.card.classList.add('citation-flash');
        });
        synthesisCitations.appendChild(btn);
      });

      synthesisWindow.hidden = false;
    } else {
      synthesisWindow.hidden = true;
    }
  }

  function resetAllQueries() {
    queryInput.value = '';
    activeFilter = 'all';
    filterChips.forEach((chip, i) => chip.classList.toggle('active', i === 0));
    runRetrieval();
  }

  function scrollToRetrievalResultsIfNeeded() {
    if (window.scrollY > 360) {
      const target = synthesisWindow.hidden ? document.getElementById('main-content') : synthesisWindow;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      queryInput.value = '';
      runRetrieval();
      scrollToRetrievalResultsIfNeeded();
    });
  });

  // Search input with debounce
  let searchDebounce = null;
  queryInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      if (queryInput.value.trim()) {
        filterChips.forEach((c, i) => c.classList.toggle('active', i === 0));
        activeFilter = 'all';
      }
      runRetrieval();
      if (queryInput.value.trim()) {
        scrollToRetrievalResultsIfNeeded();
      }
    }, 150);
  });

  queryClearBtn.addEventListener('click', () => {
    queryInput.value = '';
    runRetrieval();
    queryInput.focus();
  });

  synthesisResetBtn.addEventListener('click', resetAllQueries);
  emptyClearBtn.addEventListener('click', resetAllQueries);

  suggestionPills.forEach(pill => {
    pill.addEventListener('click', () => {
      queryInput.value = pill.dataset.suggest || '';
      activeFilter = 'all';
      filterChips.forEach((c, i) => c.classList.toggle('active', i === 0));
      runRetrieval();
      scrollToRetrievalResultsIfNeeded();
    });
  });

  // ═══════════════════ CERTIFICATE / PDF MODAL ═══════════════════
  let lastFocusedElement = null;
  let pdfLoadTimer = null;

  function openModal(trigger) {
    lastFocusedElement = trigger;
    const certId = trigger.dataset.cert || 'doc';
    const pdfPath = trigger.dataset.pdf || '';
    const title = trigger.dataset.title || 'Verification Document';
    const detail = trigger.dataset.detail || '';
    const filename = pdfPath.split('/').pop() || 'certificate.pdf';

    modalTitle.textContent = title;
    modalDetail.textContent = detail;
    modalMetaId.textContent = `cert_id: 0x${certId.toUpperCase()}`;
    modalMetaFile.textContent = `file: ${filename}`;

    modalOpenNewTab.href = pdfPath;
    modalDownloadPdf.href = pdfPath;
    modalDownloadPdf.setAttribute('download', filename);

    clearTimeout(pdfLoadTimer);
    modalPdfLoading.hidden = false;
    modalPdfFrame.src = pdfPath;
    pdfLoadTimer = setTimeout(() => {
      modalPdfLoading.hidden = true;
    }, 3500);

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      modalClose.focus();
    });
  }

  modalPdfFrame.addEventListener('load', () => {
    if (modalPdfFrame.getAttribute('src') && modalPdfFrame.getAttribute('src') !== 'about:blank') {
      clearTimeout(pdfLoadTimer);
      modalPdfLoading.hidden = true;
    }
  });

  function closeModal() {
    clearTimeout(pdfLoadTimer);
    modal.hidden = true;
    document.body.style.overflow = '';
    modalPdfFrame.src = 'about:blank';
    modalPdfLoading.hidden = true;

    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => openModal(trigger));
  });

  modalClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ═══════════════════ ARCHIVE DRAWER ═══════════════════
  archiveToggle.addEventListener('click', () => {
    const isExpanded = archiveToggle.getAttribute('aria-expanded') === 'true';
    userOpenedArchive = !isExpanded;
    setArchiveOpen(userOpenedArchive);
  });

  // ═══════════════════ KEYBOARD SHORTCUTS ═══════════════════
  document.addEventListener('keydown', (e) => {
    const isShortcutK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    const isSlash = e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA';

    if (isShortcutK || isSlash) {
      e.preventDefault();
      queryInput.focus();
      queryInput.select();
    }

    if (e.key === 'Escape') {
      if (!modal.hidden) {
        closeModal();
      } else if (document.activeElement === queryInput) {
        if (queryInput.value.trim()) {
          resetAllQueries();
        }
        queryInput.blur();
      }
    }
  });

  // Focus trap inside certificate modal
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ═══════════════════ SCROLL REVEAL & SCROLL TO TOP ═══════════════════
  if ('IntersectionObserver' in window) {
    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, Math.min(index * 45, 240));
          scrollObserver.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

    chunkCards.forEach(card => scrollObserver.observe(card));
  } else {
    chunkCards.forEach(card => card.classList.add('visible'));
  }

  window.addEventListener('scroll', () => {
    scrollTopBtn.hidden = window.scrollY <= 500;
  }, { passive: true });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Initialize telemetry count on first paint
  runRetrieval();
})();
