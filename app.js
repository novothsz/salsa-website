
const LEVEL_LABELS = {
  beginer1: 'Beginner 1',
  beginer2: 'Beginner 2',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  unknown: 'Unknown'
};

const LEVEL_SORT_ORDER = {
  beginer1: 1,
  beginer2: 2,
  intermediate: 3,
  advanced: 4,
  unknown: 5
};

const DATA_SOURCES = ['salsa_moves_vscode.json', 'salsa_moves.json'];

const DEFAULT_AUTH_CONFIG = {
  enabled: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  profileTable: 'profiles',
  userIdColumn: 'user_id',
  approvalColumn: 'approved',
  rejectedColumn: ''
};

const authConfig = normalizeAuthConfig(window.SALSA_AUTH_CONFIG);

const authState = {
  status: 'checking',
  message: 'Checking authentication setup...',
  user: null,
  approved: false
};

let supabaseClient = null;
let movesCache = [];
let applyFiltersRef = null;
let authControlsBound = false;

let hoverPreviewRoot = null;
let hoverPreviewFrame = null;
let hoverPreviewHideTimer = null;

const canUseHoverPreview = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;

async function loadMoves() {
  const container = document.getElementById('movesContainer');
  setupAuthControls();

  try {
    await initAuth();

    const rawMoves = await fetchMovesData();
    movesCache = rawMoves.map(normalizeMove);

    updateHeaderStats(movesCache.length, movesCache.length, countMovesWithVideo(movesCache));
    setupFilters(movesCache);
    refreshAuthUi();
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="empty-state">Failed to load moves.</p>';
    updateResultsBar(0, 0, 0, 0);
    updateHeaderStats(0, 0, 0);
  }
}

async function initAuth() {
  authState.status = 'checking';
  authState.message = 'Checking authentication setup...';
  authState.user = null;
  authState.approved = false;
  refreshAuthUi();

  if (!authConfig.enabled) {
    authState.status = 'not-configured';
    authState.message = 'Member-only videos are disabled. Edit auth-config.js to enable Google sign-in.';
    refreshAuthUi();
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    authState.status = 'error';
    authState.message = 'Supabase client script could not be loaded.';
    refreshAuthUi();
    return;
  }

  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    authState.status = 'error';
    authState.message = 'Missing Supabase URL or anon key in auth-config.js.';
    refreshAuthUi();
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    await applySessionState(data.session);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      applySessionState(session)
        .then(refreshVisibleMoves)
        .catch((authError) => {
          console.error(authError);
          authState.status = 'error';
          authState.message = 'Auth state update failed. Reload and try again.';
          authState.approved = false;
          refreshVisibleMoves();
        });
    });
  } catch (error) {
    console.error(error);
    authState.status = 'error';
    authState.message = 'Could not initialize auth. Check Supabase settings and try again.';
    authState.user = null;
    authState.approved = false;
  }

  refreshAuthUi();
}

async function applySessionState(session) {
  const user = session?.user || null;
  authState.user = user;

  if (!user) {
    authState.approved = false;
    authState.status = 'signed-out';
    authState.message = 'Sign in with Google. Video links unlock after admin approval.';
    return;
  }

  const email = asTrimmedString(user.email) || 'your account';
  const metadataApproved = user.app_metadata?.approved === true || user.user_metadata?.approved === true;

  if (metadataApproved) {
    authState.approved = true;
    authState.status = 'approved';
    authState.message = `Approved member: ${email}. Member videos are unlocked.`;
    return;
  }

  const approvalState = await fetchApprovalState(user.id);

  if (approvalState === 'approved') {
    authState.approved = true;
    authState.status = 'approved';
    authState.message = `Approved member: ${email}. Member videos are unlocked.`;
    return;
  }

  authState.approved = false;

  if (approvalState === 'rejected') {
    authState.status = 'rejected';
    authState.message = `Signed in as ${email}, but access is not approved. Contact an admin.`;
  } else {
    authState.status = 'pending';
    authState.message = `Signed in as ${email}. Your registration is pending admin approval.`;
  }
}

async function fetchApprovalState(userId) {
  if (!supabaseClient) return 'pending';

  const selectedColumns = [authConfig.approvalColumn];
  if (authConfig.rejectedColumn) {
    selectedColumns.push(authConfig.rejectedColumn);
  }

  try {
    const { data, error } = await supabaseClient
      .from(authConfig.profileTable)
      .select(selectedColumns.join(', '))
      .eq(authConfig.userIdColumn, userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return 'pending';
    }

    if (!data) return 'pending';

    if (authConfig.rejectedColumn && data[authConfig.rejectedColumn] === true) {
      return 'rejected';
    }

    return data[authConfig.approvalColumn] === true ? 'approved' : 'pending';
  } catch (error) {
    console.error(error);
    return 'pending';
  }
}

function setupAuthControls() {
  if (authControlsBound) return;

  const primaryBtn = document.getElementById('authPrimaryBtn');
  const secondaryBtn = document.getElementById('authSecondaryBtn');

  if (!primaryBtn || !secondaryBtn) return;

  primaryBtn.addEventListener('click', handlePrimaryAuthAction);
  secondaryBtn.addEventListener('click', handleSignOutAction);
  authControlsBound = true;
}

async function handlePrimaryAuthAction() {
  if (authState.status === 'error') {
    await initAuth();
    refreshVisibleMoves();
    return;
  }

  if (authState.status !== 'signed-out') return;

  if (!supabaseClient) {
    authState.status = 'error';
    authState.message = 'Auth client is unavailable. Check auth setup and reload.';
    refreshVisibleMoves();
    return;
  }

  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });

    if (error) throw error;
  } catch (error) {
    console.error(error);
    authState.status = 'error';
    authState.message = 'Google sign-in failed. Please try again.';
    refreshVisibleMoves();
  }
}

async function handleSignOutAction() {
  if (!supabaseClient || !authState.user) return;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error(error);
    authState.status = 'error';
    authState.message = 'Sign-out failed. Please try again.';
    refreshVisibleMoves();
  }
}

function refreshAuthUi() {
  const statusText = document.getElementById('authStatusText');
  const primaryBtn = document.getElementById('authPrimaryBtn');
  const secondaryBtn = document.getElementById('authSecondaryBtn');

  if (!statusText || !primaryBtn || !secondaryBtn) return;

  statusText.textContent = authState.message;

  primaryBtn.hidden = false;
  primaryBtn.disabled = false;
  secondaryBtn.hidden = true;
  secondaryBtn.disabled = false;

  if (authState.status === 'checking') {
    primaryBtn.textContent = 'Checking...';
    primaryBtn.disabled = true;
    return;
  }

  if (authState.status === 'not-configured') {
    primaryBtn.textContent = 'Auth disabled';
    primaryBtn.disabled = true;
    return;
  }

  if (authState.status === 'signed-out') {
    primaryBtn.textContent = 'Sign in with Google';
    return;
  }

  if (authState.status === 'error') {
    primaryBtn.textContent = 'Retry auth setup';
    return;
  }

  primaryBtn.hidden = true;
  secondaryBtn.hidden = false;
  secondaryBtn.textContent = 'Sign out';

  if (authState.status === 'pending') {
    secondaryBtn.classList.add('secondary');
    return;
  }
}

function refreshVisibleMoves() {
  hideHoverPreview();
  refreshAuthUi();

  if (typeof applyFiltersRef === 'function') {
    applyFiltersRef();
  }
}

async function fetchMovesData() {
  let lastError = null;

  for (const source of DATA_SOURCES) {
    try {
      const res = await fetch(source, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${source}`);

      const json = await res.json();
      if (!Array.isArray(json)) throw new Error(`${source} does not contain a move array`);
      return json;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to load move data from all sources.');
}

function normalizeMove(move) {
  const levelValue = asTrimmedString(move.level).toLowerCase();
  const level = LEVEL_LABELS[levelValue] ? levelValue : 'unknown';
  const detailUrl = sanitizeHttpUrl(move.detail_url);

  const firstVideoUrl = getFirstVideoUrl(move);
  const youtubeId = extractYoutubeId(firstVideoUrl);

  return {
    name: asTrimmedString(move.name) || 'Unnamed move',
    type: asTrimmedString(move.type) || 'Unknown type',
    level,
    youtube: youtubeId ? buildYoutubeWatchUrl(youtubeId) : '',
    youtubePreview: youtubeId ? buildYoutubePreviewUrl(youtubeId) : '',
    detailUrl
  };
}

function getFirstVideoUrl(move) {
  if (Array.isArray(move.youtube_urls)) {
    for (const url of move.youtube_urls) {
      const value = asTrimmedString(url);
      if (value) return value;
    }
  }

  return asTrimmedString(move.youtube);
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeHttpUrl(value) {
  const rawUrl = asTrimmedString(value);
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch (error) {
    return '';
  }

  return '';
}

function extractYoutubeId(urlValue) {
  const rawUrl = asTrimmedString(urlValue);
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return sanitizeYoutubeId(parsed.pathname.slice(1));
    }

    if (host.endsWith('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return sanitizeYoutubeId(parsed.pathname.split('/')[2]);
      }

      if (parsed.pathname === '/watch') {
        return sanitizeYoutubeId(parsed.searchParams.get('v') || '');
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        return sanitizeYoutubeId(parsed.pathname.split('/')[2]);
      }
    }
  } catch (error) {
    return '';
  }

  return '';
}

function sanitizeYoutubeId(value) {
  const candidate = asTrimmedString(value).split(/[?&#]/)[0];
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : '';
}

function buildYoutubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildYoutubePreviewUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1`;
}

function normalizeAuthConfig(rawConfig) {
  const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};

  return {
    enabled: source.enabled === true,
    supabaseUrl: asTrimmedString(source.supabaseUrl),
    supabaseAnonKey: asTrimmedString(source.supabaseAnonKey),
    profileTable: asTrimmedString(source.profileTable) || DEFAULT_AUTH_CONFIG.profileTable,
    userIdColumn: asTrimmedString(source.userIdColumn) || DEFAULT_AUTH_CONFIG.userIdColumn,
    approvalColumn: asTrimmedString(source.approvalColumn) || DEFAULT_AUTH_CONFIG.approvalColumn,
    rejectedColumn: asTrimmedString(source.rejectedColumn)
  };
}

function setupFilters(moves) {
  const typeFilter = document.getElementById('typeFilter');
  const searchInput = document.getElementById('searchInput');
  const levelFilter = document.getElementById('levelFilter');
  const sortFilter = document.getElementById('sortFilter');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');

  const uniqueTypes = Array.from(new Set(moves.map((move) => move.type))).sort((a, b) => a.localeCompare(b));
  for (const type of uniqueTypes) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeFilter.appendChild(option);
  }

  function applyFilters() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    const selectedLevel = levelFilter.value;
    const selectedSort = sortFilter.value;

    const filteredMoves = moves.filter((move) => {
      if (search && !move.name.toLowerCase().includes(search)) return false;
      if (selectedType && move.type !== selectedType) return false;
      if (selectedLevel && move.level !== selectedLevel) return false;
      return true;
    });

    const sortedMoves = sortMoves(filteredMoves, selectedSort);
    const visibleWithVideo = countMovesWithVideo(sortedMoves);
    const visibleAccessibleVideos = countAccessibleVideos(sortedMoves);

    renderMoves(sortedMoves);
    updateResultsBar(sortedMoves.length, moves.length, visibleWithVideo, visibleAccessibleVideos);
    updateHeaderStats(moves.length, sortedMoves.length, countMovesWithVideo(moves));
  }

  applyFiltersRef = applyFilters;

  searchInput.addEventListener('input', applyFilters);
  typeFilter.addEventListener('change', applyFilters);
  levelFilter.addEventListener('change', applyFilters);
  sortFilter.addEventListener('change', applyFilters);

  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    levelFilter.value = '';
    sortFilter.value = 'name-asc';
    applyFilters();
    searchInput.focus();
  });

  applyFilters();
}

function sortMoves(moves, selectedSort) {
  const sorted = [...moves];

  sorted.sort((a, b) => {
    if (selectedSort === 'name-desc') {
      return b.name.localeCompare(a.name);
    }

    if (selectedSort === 'level-asc') {
      const levelComparison = (LEVEL_SORT_ORDER[a.level] || LEVEL_SORT_ORDER.unknown) - (LEVEL_SORT_ORDER[b.level] || LEVEL_SORT_ORDER.unknown);
      if (levelComparison !== 0) return levelComparison;
      return a.name.localeCompare(b.name);
    }

    if (selectedSort === 'type-asc') {
      const typeComparison = a.type.localeCompare(b.type);
      if (typeComparison !== 0) return typeComparison;
      return a.name.localeCompare(b.name);
    }

    return a.name.localeCompare(b.name);
  });

  return sorted;
}

function renderMoves(moves) {
  const container = document.getElementById('movesContainer');
  const hasMemberVideoAccess = canAccessMemberVideos();

  hideHoverPreview();
  container.innerHTML = '';

  if (!moves.length) {
    container.innerHTML = '<p class="empty-state">No moves match your filters. Try resetting filters or broadening search.</p>';
    return;
  }

  for (const move of moves) {
    const card = document.createElement('article');
    card.className = 'move-card';

    const title = document.createElement('h2');
    title.textContent = move.name;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'move-meta';

    const typeChip = document.createElement('span');
    typeChip.className = 'move-chip type';
    typeChip.textContent = move.type;
    meta.appendChild(typeChip);

    const levelChip = document.createElement('span');
    levelChip.className = 'move-chip level-' + (move.level || 'unknown');
    levelChip.textContent = LEVEL_LABELS[move.level] || LEVEL_LABELS.unknown;
    meta.appendChild(levelChip);

    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'move-actions';

    if (move.youtube) {
      if (hasMemberVideoAccess) {
        const link = document.createElement('a');
        link.href = move.youtube;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'move-link';
        link.textContent = 'Open video';
        attachHoverPreview(link, move.youtubePreview);
        actions.appendChild(link);
      } else {
        const locked = document.createElement('span');
        locked.className = 'move-link locked';
        locked.textContent = 'Members only video';
        actions.appendChild(locked);
      }

      if (move.detailUrl) {
        const sourceLink = document.createElement('a');
        sourceLink.href = move.detailUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceLink.className = 'move-link source-link';
        sourceLink.textContent = 'Original move page';
        actions.appendChild(sourceLink);
      }
    } else if (move.detailUrl) {
      const sourceOnlyLink = document.createElement('a');
      sourceOnlyLink.href = move.detailUrl;
      sourceOnlyLink.target = '_blank';
      sourceOnlyLink.rel = 'noopener noreferrer';
      sourceOnlyLink.className = 'move-link source-link';
      sourceOnlyLink.textContent = 'Open move page';
      actions.appendChild(sourceOnlyLink);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'move-link muted';
      placeholder.textContent = 'No video yet';
      actions.appendChild(placeholder);
    }

    card.appendChild(actions);
    container.appendChild(card);
  }
}

function countMovesWithVideo(moves) {
  return moves.filter((move) => Boolean(move.youtube)).length;
}

function countAccessibleVideos(moves) {
  return canAccessMemberVideos() ? countMovesWithVideo(moves) : 0;
}

function canAccessMemberVideos() {
  return authState.approved === true;
}

function attachHoverPreview(link, previewUrl) {
  if (!canUseHoverPreview || !previewUrl) return;

  link.addEventListener('mouseenter', () => {
    showHoverPreview(link, previewUrl);
  });

  link.addEventListener('focus', () => {
    showHoverPreview(link, previewUrl);
  });

  link.addEventListener('mouseleave', scheduleHideHoverPreview);
  link.addEventListener('blur', scheduleHideHoverPreview);
  link.addEventListener('click', hideHoverPreview);
}

function ensureHoverPreviewRoot() {
  if (hoverPreviewRoot) return;

  hoverPreviewRoot = document.createElement('aside');
  hoverPreviewRoot.className = 'hover-video-preview';
  hoverPreviewRoot.innerHTML = [
    '<iframe loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Video preview"></iframe>',
    '<p>Hover preview (muted)</p>'
  ].join('');

  hoverPreviewFrame = hoverPreviewRoot.querySelector('iframe');
  document.body.appendChild(hoverPreviewRoot);

  hoverPreviewRoot.addEventListener('mouseenter', () => {
    clearTimeout(hoverPreviewHideTimer);
  });

  hoverPreviewRoot.addEventListener('mouseleave', scheduleHideHoverPreview);
}

function showHoverPreview(anchor, previewUrl) {
  ensureHoverPreviewRoot();
  clearTimeout(hoverPreviewHideTimer);

  if (!hoverPreviewRoot || !hoverPreviewFrame) return;

  if (hoverPreviewFrame.src !== previewUrl) {
    hoverPreviewFrame.src = previewUrl;
  }

  positionHoverPreview(anchor);
  hoverPreviewRoot.classList.add('visible');
}

function positionHoverPreview(anchor) {
  if (!hoverPreviewRoot) return;

  const rect = anchor.getBoundingClientRect();
  const previewWidth = hoverPreviewRoot.offsetWidth || 320;
  const previewHeight = hoverPreviewRoot.offsetHeight || 220;

  const maxLeft = window.innerWidth - previewWidth - 8;
  const maxTop = window.innerHeight - previewHeight - 8;

  let left = rect.left;
  let top = rect.bottom + 10;

  if (left > maxLeft) left = maxLeft;
  if (left < 8) left = 8;

  if (top > maxTop) {
    top = rect.top - previewHeight - 10;
  }

  if (top < 8) top = 8;

  hoverPreviewRoot.style.left = `${left}px`;
  hoverPreviewRoot.style.top = `${top}px`;
}

function scheduleHideHoverPreview() {
  clearTimeout(hoverPreviewHideTimer);
  hoverPreviewHideTimer = setTimeout(() => {
    hideHoverPreview();
  }, 120);
}

function hideHoverPreview() {
  if (!hoverPreviewRoot || !hoverPreviewFrame) return;

  hoverPreviewRoot.classList.remove('visible');
  hoverPreviewFrame.src = '';
}

function updateResultsBar(visibleCount, totalCount, visibleWithVideoCount, visibleAccessibleVideos) {
  const resultsInfo = document.getElementById('resultsInfo');

  if (authState.status === 'approved') {
    resultsInfo.textContent = `Showing ${visibleCount} of ${totalCount} moves. ${visibleAccessibleVideos} video links unlocked.`;
    return;
  }

  if (authState.status === 'not-configured') {
    resultsInfo.textContent = `Showing ${visibleCount} of ${totalCount} moves. ${visibleWithVideoCount} include member videos (auth disabled).`;
    return;
  }

  resultsInfo.textContent = `Showing ${visibleCount} of ${totalCount} moves. ${visibleWithVideoCount} include member videos that require sign-in and approval.`;
}

function updateHeaderStats(totalCount, visibleCount, withVideoCount) {
  document.getElementById('statTotal').textContent = String(totalCount);
  document.getElementById('statVisible').textContent = String(visibleCount);
  document.getElementById('statWithVideo').textContent = String(withVideoCount);
}

document.addEventListener('DOMContentLoaded', loadMoves);
