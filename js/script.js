/* ── Quotidian — Quote Generator ─────────────────────────
   Features:
   • Fetch from DummyJSON API with up to 3 auto-retries
   • Retry countdown toast with progress bar
   • Offline fallback quotes
   • Background theme cycles on every new quote
   • Save / unsave favourites via localStorage
   • Favourites drawer with per-item delete & copy
──────────────────────────────────────────────────────── */

const API_URL     = 'https://dummyjson.com/quotes/random';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2; // seconds
const LS_KEY      = 'quotidian_favourites';

const FALLBACKS = [
  { quote: 'Every moment is a fresh beginning.',                               author: 'T.S. Eliot' },
  { quote: 'In the middle of difficulty lies opportunity.',                    author: 'Albert Einstein' },
  { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { quote: "Life is what happens when you're busy making other plans.",        author: 'John Lennon' },
  { quote: 'The only way to do great work is to love what you do.',            author: 'Steve Jobs' },
  { quote: 'Simplicity is the ultimate sophistication.',                       author: 'Leonardo da Vinci' },
  { quote: 'Be yourself; everyone else is already taken.',                     author: 'Oscar Wilde' },
  { quote: 'Imagination is more important than knowledge.',                    author: 'Albert Einstein' },
  { quote: 'The journey of a thousand miles begins with a single step.',       author: 'Lao Tzu' },
  { quote: 'What we think, we become.',                                        author: 'Buddha' },
];

const CATEGORIES = ['wisdom', 'inspiration', 'life', 'philosophy', 'courage', 'perseverance', 'mindfulness', 'creativity'];

const BG_THEMES = [
  { from: '#0d1b3e', mid: '#0a2a4a', to: '#0d3b4f', orb1: '#5ee7c8', orb2: '#7b9ef0', accent: '#5ee7c8' },
  { from: '#1a0a2e', mid: '#2d1060', to: '#1a0540', orb1: '#c084fc', orb2: '#818cf8', accent: '#c084fc' },
  { from: '#1a0a00', mid: '#3d1a00', to: '#2a0f00', orb1: '#fb923c', orb2: '#fbbf24', accent: '#fb923c' },
  { from: '#001a10', mid: '#003d20', to: '#001a12', orb1: '#34d399', orb2: '#6ee7b7', accent: '#34d399' },
  { from: '#1a0020', mid: '#3d0048', to: '#200020', orb1: '#f472b6', orb2: '#c084fc', accent: '#f472b6' },
  { from: '#001220', mid: '#002d48', to: '#001830', orb1: '#38bdf8', orb2: '#818cf8', accent: '#38bdf8' },
  { from: '#1f1000', mid: '#3d2200', to: '#291500', orb1: '#fcd34d', orb2: '#fb923c', accent: '#fcd34d' },
  { from: '#001a1a', mid: '#003d3d', to: '#001f1f', orb1: '#2dd4bf', orb2: '#34d399', accent: '#2dd4bf' },
  { from: '#0f0a1a', mid: '#1e1040', to: '#120a25', orb1: '#a78bfa', orb2: '#60a5fa', accent: '#a78bfa' },
  { from: '#1a0808', mid: '#3d1010', to: '#250808', orb1: '#f87171', orb2: '#fb923c', accent: '#f87171' },
];
let lastThemeIndex = 0;

// ── DOM refs ───────────────────────────────────────────────
const quoteText      = document.getElementById('quoteText');
const authorName     = document.getElementById('authorName');
const categoryEl     = document.getElementById('category');
const newQuoteBtn    = document.getElementById('newQuoteBtn');
const copyBtn        = document.getElementById('copyBtn');
const copyLabel      = document.getElementById('copyLabel');
const shimmerBar     = document.getElementById('shimmerBar');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText    = document.getElementById('loadingText');
const newQuoteLabel  = document.getElementById('newQuoteLabel');
// Toast
const errorToast     = document.getElementById('errorToast');
const toastMessage   = document.getElementById('toastMessage');
const toastSub       = document.getElementById('toastSub');
const toastProgress  = document.getElementById('toastProgress');
const toastClose     = document.getElementById('toastClose');
// Favourites
const heartBtn       = document.getElementById('heartBtn');
const favTrigger     = document.getElementById('favTrigger');
const favCount       = document.getElementById('favCount');
const favDrawer      = document.getElementById('favDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const drawerClose    = document.getElementById('drawerClose');
const drawerBody     = document.getElementById('drawerBody');
const drawerEmpty    = document.getElementById('drawerEmpty');
const clearAllBtn    = document.getElementById('clearAllBtn');

let currentQuote = { quote: '', author: '' };
let isFetching   = false;
let retryTimer   = null;
let retryTimeout = null;

// ══════════════════════════════════════════════════════════
//  FAVOURITES — localStorage CRUD
// ══════════════════════════════════════════════════════════

function loadFavourites() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

function saveFavourites(favs) {
  localStorage.setItem(LS_KEY, JSON.stringify(favs));
}

function isSaved(quote, author) {
  return loadFavourites().some(f => f.quote === quote && f.author === author);
}

function toggleFavourite() {
  const { quote, author } = currentQuote;
  if (!quote) return;

  let favs = loadFavourites();
  const idx = favs.findIndex(f => f.quote === quote && f.author === author);

  if (idx === -1) {
    // Add
    favs.unshift({ quote, author, savedAt: new Date().toISOString() });
    saveFavourites(favs);
    heartBtn.classList.add('saved');
    animateHeart();
  } else {
    // Remove
    favs.splice(idx, 1);
    saveFavourites(favs);
    heartBtn.classList.remove('saved');
  }

  updateFavCount();
  if (favDrawer.classList.contains('open')) renderDrawer();
}

function updateHeartState() {
  const saved = isSaved(currentQuote.quote, currentQuote.author);
  heartBtn.classList.toggle('saved', saved);
}

function animateHeart() {
  heartBtn.classList.remove('pop');
  void heartBtn.offsetWidth;
  heartBtn.classList.add('pop');
  heartBtn.addEventListener('animationend', () => heartBtn.classList.remove('pop'), { once: true });
}

function updateFavCount() {
  const count = loadFavourites().length;
  favCount.textContent = count;
  favCount.hidden = count === 0;
  favTrigger.classList.toggle('has-items', count > 0);
}

// ══════════════════════════════════════════════════════════
//  FAVOURITES DRAWER
// ══════════════════════════════════════════════════════════

function openDrawer() {
  renderDrawer();
  favDrawer.classList.add('open');
  drawerBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  favDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function renderDrawer() {
  const favs = loadFavourites();
  drawerBody.innerHTML = '';
  drawerEmpty.classList.toggle('visible', favs.length === 0);
  clearAllBtn.style.display = favs.length === 0 ? 'none' : '';

  favs.forEach((fav, idx) => {
    const item = document.createElement('div');
    item.className = 'fav-item';
    item.dataset.idx = idx;

    const dateStr = fav.savedAt
      ? new Date(fav.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    item.innerHTML = `
      <button class="fav-delete" title="Remove" aria-label="Remove quote">✕</button>
      <p class="fav-quote">${escHtml(fav.quote)}</p>
      <div class="fav-author">— ${escHtml(fav.author)}</div>
      ${dateStr ? `<div class="fav-date">Saved ${dateStr}</div>` : ''}
      <div class="fav-item-actions">
        <button class="fav-copy">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy
        </button>
      </div>`;

    // Delete button
    item.querySelector('.fav-delete').addEventListener('click', () => removeFromDrawer(item, fav));

    // Copy button
    const copyEl = item.querySelector('.fav-copy');
    copyEl.addEventListener('click', () => {
      copyToClipboard(`"${fav.quote}" — ${fav.author}`);
      copyEl.classList.add('copied');
      copyEl.textContent = '✓ Copied';
      setTimeout(() => { copyEl.classList.remove('copied'); copyEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`; }, 1800);
    });

    drawerBody.appendChild(item);
  });
}

function removeFromDrawer(itemEl, fav) {
  itemEl.classList.add('removing');
  itemEl.addEventListener('animationend', () => {
    let favs = loadFavourites();
    favs = favs.filter(f => !(f.quote === fav.quote && f.author === fav.author));
    saveFavourites(favs);
    updateFavCount();
    updateHeartState();
    itemEl.remove();
    drawerEmpty.classList.toggle('visible', favs.length === 0);
    clearAllBtn.style.display = favs.length === 0 ? 'none' : '';
  }, { once: true });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Drawer events ──────────────────────────────────────────
favTrigger.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerBackdrop.addEventListener('click', closeDrawer);
clearAllBtn.addEventListener('click', () => {
  saveFavourites([]);
  updateFavCount();
  updateHeartState();
  renderDrawer();
});
heartBtn.addEventListener('click', toggleFavourite);

// ══════════════════════════════════════════════════════════
//  BACKGROUND THEMES
// ══════════════════════════════════════════════════════════
function cycleBackground() {
  let idx;
  do { idx = Math.floor(Math.random() * BG_THEMES.length); } while (idx === lastThemeIndex);
  lastThemeIndex = idx;
  const t = BG_THEMES[idx];
  const root = document.documentElement.style;
  root.setProperty('--bg-from',    t.from);
  root.setProperty('--bg-mid',     t.mid);
  root.setProperty('--bg-to',      t.to);
  root.setProperty('--accent',     t.accent);
  root.setProperty('--accent-glow', t.accent + '55');
  document.querySelector('.orb-1').style.background = `radial-gradient(circle, ${t.orb1}, transparent 70%)`;
  document.querySelector('.orb-2').style.background = `radial-gradient(circle, ${t.orb2}, transparent 70%)`;
}

// ══════════════════════════════════════════════════════════
//  LOADING STATE
// ══════════════════════════════════════════════════════════
function setLoading(on, overlayMsg = 'Fetching quote…') {
  if (on) {
    loadingOverlay.classList.add('visible');
    loadingText.textContent = overlayMsg;
    loadingText.classList.toggle('retry-text', overlayMsg.startsWith('Retrying'));
    newQuoteBtn.classList.add('is-loading');
    newQuoteBtn.disabled = true;
    newQuoteLabel.textContent = 'Loading…';
    copyBtn.disabled = true;
    heartBtn.disabled = true;
  } else {
    loadingOverlay.classList.remove('visible');
    loadingText.classList.remove('retry-text');
    newQuoteBtn.classList.remove('is-loading');
    newQuoteBtn.disabled = false;
    newQuoteLabel.textContent = 'New Quote';
    copyBtn.disabled = false;
    heartBtn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════
//  ERROR TOAST
// ══════════════════════════════════════════════════════════
let toastDismissTimeout = null;

function showToast({ message, sub, isOffline = false, duration = null }) {
  clearTimeout(toastDismissTimeout);
  clearInterval(retryTimer);
  toastProgress.classList.remove('counting');
  void toastProgress.offsetWidth;
  toastMessage.textContent = message;
  toastSub.innerHTML = sub;
  errorToast.classList.toggle('is-offline', isOffline);
  errorToast.classList.add('show');
  if (duration) {
    toastProgress.style.animationDuration = `${duration / 1000}s`;
    toastProgress.classList.add('counting');
    toastDismissTimeout = setTimeout(hideToast, duration);
  }
}

function hideToast() {
  errorToast.classList.remove('show');
  toastProgress.classList.remove('counting');
  clearInterval(retryTimer);
  clearTimeout(toastDismissTimeout);
}

toastClose.addEventListener('click', () => {
  clearTimeout(retryTimeout);
  clearInterval(retryTimer);
  hideToast();
  if (isFetching) {
    isFetching = false;
    setLoading(false);
    displayQuote(FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)], true);
  }
});

// ══════════════════════════════════════════════════════════
//  FETCH & RETRY
// ══════════════════════════════════════════════════════════
async function attemptFetch() {
  const res = await fetch(API_URL, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.quote) throw new Error('Empty response');
  return { quote: data.quote, author: data.author || 'Unknown' };
}

function scheduleRetry(attempt) {
  let secondsLeft = RETRY_DELAY;
  showToast({
    message: `Couldn't reach the server. (Attempt ${attempt}/${MAX_RETRIES})`,
    sub: `Retrying in <strong id="retryCountdown">${secondsLeft}</strong>s…`,
    isOffline: false,
  });
  retryTimer = setInterval(() => {
    secondsLeft--;
    const el = document.getElementById('retryCountdown');
    if (el) el.textContent = secondsLeft;
    if (secondsLeft <= 0) clearInterval(retryTimer);
  }, 1000);
  toastProgress.style.animationDuration = `${RETRY_DELAY}s`;
  toastProgress.classList.remove('counting');
  void toastProgress.offsetWidth;
  toastProgress.classList.add('counting');
  setLoading(true, `Retrying… (${attempt}/${MAX_RETRIES})`);
  retryTimeout = setTimeout(() => { hideToast(); fetchWithRetry(attempt + 1); }, RETRY_DELAY * 1000);
}

async function fetchWithRetry(attempt = 1) {
  try {
    setLoading(true, attempt === 1 ? 'Fetching quote…' : `Retrying… (${attempt - 1}/${MAX_RETRIES})`);
    triggerShimmer();
    const quote = await attemptFetch();
    hideToast();
    displayQuote(quote, false);
  } catch {
    if (attempt <= MAX_RETRIES) {
      scheduleRetry(attempt);
    } else {
      hideToast();
      displayQuote(FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)], true);
      showToast({ message: 'No internet connection.', sub: 'Showing a saved quote instead.', isOffline: true, duration: 5000 });
    }
  }
}

// ══════════════════════════════════════════════════════════
//  DISPLAY QUOTE
// ══════════════════════════════════════════════════════════
function displayQuote(quote, isFallback) {
  quoteText.classList.add('fade-out');
  authorName.classList.add('fade-out');
  setTimeout(() => {
    currentQuote = quote;
    quoteText.textContent  = quote.quote;
    authorName.textContent = quote.author;
    categoryEl.textContent = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    cycleBackground();
    updateHeartState();
    quoteText.classList.remove('fade-out');
    authorName.classList.remove('fade-out');
    resetCopy();
    setLoading(false);
    isFetching = false;
  }, 400);
}

// ══════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════
function fetchQuote() {
  if (isFetching) return;
  isFetching = true;
  clearTimeout(retryTimeout);
  clearInterval(retryTimer);
  hideToast();
  quoteText.classList.add('fade-out');
  authorName.classList.add('fade-out');
  fetchWithRetry(1);
}

// ══════════════════════════════════════════════════════════
//  SHIMMER BAR
// ══════════════════════════════════════════════════════════
function triggerShimmer() {
  shimmerBar.classList.remove('loading');
  void shimmerBar.offsetWidth;
  shimmerBar.classList.add('loading');
}

// ══════════════════════════════════════════════════════════
//  COPY TO CLIPBOARD (shared utility)
// ══════════════════════════════════════════════════════════
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

async function copyQuote() {
  if (!currentQuote.quote || isFetching) return;
  await copyToClipboard(`"${currentQuote.quote}" — ${currentQuote.author}`);
  copyBtn.classList.add('copied');
  copyLabel.textContent = '✓ Copied!';
  setTimeout(resetCopy, 2200);
}

function resetCopy() {
  copyBtn.classList.remove('copied');
  copyLabel.textContent = 'Copy Quote';
}

// ══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
  if (favDrawer.classList.contains('open')) {
    if (e.key === 'Escape') closeDrawer();
    return;
  }
  if (e.key === 'n' || e.key === 'N' || e.key === ' ') { e.preventDefault(); fetchQuote(); }
  if (e.key === 'c' || e.key === 'C') copyQuote();
  if (e.key === 's' || e.key === 'S') toggleFavourite();
  if (e.key === 'f' || e.key === 'F') openDrawer();
});

// ── Events ─────────────────────────────────────────────────
newQuoteBtn.addEventListener('click', fetchQuote);
copyBtn.addEventListener('click', copyQuote);

// ── Init ───────────────────────────────────────────────────
updateFavCount();
fetchQuote();
