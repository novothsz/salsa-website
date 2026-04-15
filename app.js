
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

async function loadMoves() {
  const container = document.getElementById('movesContainer');
  try {
    const res = await fetch('salsa_moves.json');
    if (!res.ok) throw new Error('Failed to load JSON');

    const rawMoves = await res.json();
    const moves = rawMoves.map(normalizeMove);

    updateHeaderStats(moves.length, moves.length, countMovesWithVideo(moves));
    setupFilters(moves);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="empty-state">Failed to load moves.</p>';
    updateResultsBar(0, 0, 0);
    updateHeaderStats(0, 0, 0);
  }
}

function normalizeMove(move) {
  return {
    name: typeof move.name === 'string' && move.name.trim() ? move.name.trim() : 'Unnamed move',
    type: typeof move.type === 'string' && move.type.trim() ? move.type.trim() : 'Unknown type',
    level: typeof move.level === 'string' && move.level.trim() ? move.level.trim().toLowerCase() : 'unknown',
    youtube: typeof move.youtube === 'string' ? move.youtube.trim() : ''
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

    renderMoves(sortedMoves);
    updateResultsBar(sortedMoves.length, moves.length, visibleWithVideo);
    updateHeaderStats(moves.length, sortedMoves.length, countMovesWithVideo(moves));
  }

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
      const link = document.createElement('a');
      link.href = move.youtube;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'move-link';
      link.textContent = 'Open video';
      actions.appendChild(link);
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

function updateResultsBar(visibleCount, totalCount, visibleWithVideoCount) {
  const resultsInfo = document.getElementById('resultsInfo');
  resultsInfo.textContent = `Showing ${visibleCount} of ${totalCount} moves. ${visibleWithVideoCount} visible with video.`;
}

function updateHeaderStats(totalCount, visibleCount, withVideoCount) {
  document.getElementById('statTotal').textContent = String(totalCount);
  document.getElementById('statVisible').textContent = String(visibleCount);
  document.getElementById('statWithVideo').textContent = String(withVideoCount);
}

document.addEventListener('DOMContentLoaded', loadMoves);
