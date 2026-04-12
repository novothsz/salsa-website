
async function loadMoves() {
  const container = document.getElementById('movesContainer');
  try {
    const res = await fetch('salsa_moves.json');
    if (!res.ok) throw new Error('Failed to load JSON');
    const moves = await res.json();
    setupFilters(moves);
    renderMoves(moves);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p>Failed to load moves.</p>';
  }
}

function setupFilters(moves) {
  const typeFilter = document.getElementById('typeFilter');
  const searchInput = document.getElementById('searchInput');
  const levelFilter = document.getElementById('levelFilter');

  const uniqueTypes = Array.from(new Set(moves.map(m => m.type))).sort();
  for (const t of uniqueTypes) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  }

  function applyFilters() {
    const search = searchInput.value.toLowerCase();
    const typeVal = typeFilter.value;
    const levelVal = levelFilter.value;

    const filtered = moves.filter(m => {
      if (search && !m.name.toLowerCase().includes(search)) return false;
      if (typeVal && m.type !== typeVal) return false;
      if (levelVal && m.level !== levelVal) return false;
      return true;
    });

    renderMoves(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  typeFilter.addEventListener('change', applyFilters);
  levelFilter.addEventListener('change', applyFilters);
}

function renderMoves(moves) {
  const container = document.getElementById('movesContainer');
  container.innerHTML = '';

  if (!moves.length) {
    container.innerHTML = '<p>No moves match your filters.</p>';
    return;
  }

  for (const m of moves) {
    const card = document.createElement('article');
    card.className = 'move-card';

    const title = document.createElement('h2');
    title.textContent = m.name;
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'move-meta';

    const typeChip = document.createElement('span');
    typeChip.className = 'move-chip type';
    typeChip.textContent = m.type;
    meta.appendChild(typeChip);

    const levelChip = document.createElement('span');
    levelChip.className = 'move-chip level-' + (m.level || 'unknown');
    levelChip.textContent = m.level || 'unknown';
    meta.appendChild(levelChip);

    card.appendChild(meta);

    if (m.youtube) {
      const link = document.createElement('a');
      link.href = m.youtube;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'move-link';
      link.textContent = 'Open video on YouTube (dummy link)';
      card.appendChild(link);
    } else {
      const span = document.createElement('span');
      span.className = 'move-link';
      span.textContent = 'No video link yet.';
      card.appendChild(span);
    }

    container.appendChild(card);
  }
}

document.addEventListener('DOMContentLoaded', loadMoves);
