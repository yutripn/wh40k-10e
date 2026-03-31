const API_BASE = 'https://tcgtracking.com/tcgapi/v1';
const POKEMON_CATEGORY = 3;

const state = {
  sets: [],
  selectedCard: null,
  stream: null,
};

const el = {
  setSearch: document.getElementById('setSearch'),
  loadSetsBtn: document.getElementById('loadSetsBtn'),
  setSelect: document.getElementById('setSelect'),
  cardNumber: document.getElementById('cardNumber'),
  nameFilter: document.getElementById('nameFilter'),
  findCardBtn: document.getElementById('findCardBtn'),
  status: document.getElementById('status'),
  result: document.getElementById('result'),
  saveBtn: document.getElementById('saveBtn'),
  collectionList: document.getElementById('collectionList'),
  clearCollectionBtn: document.getElementById('clearCollectionBtn'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),
  snapBtn: document.getElementById('snapBtn'),
  video: document.getElementById('video'),
  preview: document.getElementById('preview'),
  snapshot: document.getElementById('snapshot'),
};

const collectionKey = 'pokemon-scanner-collection-v1';

function setStatus(message) {
  el.status.textContent = message;
}

function readCollection() {
  try {
    return JSON.parse(localStorage.getItem(collectionKey) ?? '[]');
  } catch {
    return [];
  }
}

function writeCollection(list) {
  localStorage.setItem(collectionKey, JSON.stringify(list));
}

function renderCollection() {
  const list = readCollection();
  el.collectionList.innerHTML = '';

  if (list.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No cards saved yet.';
    el.collectionList.appendChild(li);
    return;
  }

  list.forEach((item, idx) => {
    const li = document.createElement('li');
    li.textContent = `${item.name} [${item.setName}] #${item.number} — $${item.market ?? 'n/a'}`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.marginLeft = '0.5rem';
    removeBtn.addEventListener('click', () => {
      const current = readCollection();
      current.splice(idx, 1);
      writeCollection(current);
      renderCollection();
    });
    li.appendChild(removeBtn);
    el.collectionList.appendChild(li);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return response.json();
}

function populateSetSelect(sets) {
  el.setSelect.innerHTML = '';
  sets.forEach((set) => {
    const option = document.createElement('option');
    option.value = set.id;
    option.textContent = `${set.name} (${set.abbr ?? 'N/A'})`;
    el.setSelect.appendChild(option);
  });
}

async function loadSets() {
  setStatus('Loading Pokemon sets...');
  const data = await fetchJson(`${API_BASE}/${POKEMON_CATEGORY}/sets`);
  state.sets = data.sets ?? [];

  const query = el.setSearch.value.trim().toLowerCase();
  const filtered = query
    ? state.sets.filter((set) => set.name.toLowerCase().includes(query) || (set.abbr ?? '').toLowerCase().includes(query))
    : state.sets;

  populateSetSelect(filtered.slice(0, 250));
  setStatus(`Loaded ${filtered.length} matching set(s).`);
}

function pickMarketPrice(priceNode) {
  if (!priceNode?.tcg) return null;
  const firstSubtype = Object.values(priceNode.tcg)[0];
  return firstSubtype?.market ?? null;
}

async function findCard() {
  state.selectedCard = null;
  el.saveBtn.disabled = true;
  el.result.innerHTML = '';

  const setId = el.setSelect.value;
  const numberInput = el.cardNumber.value.trim();
  const nameInput = el.nameFilter.value.trim().toLowerCase();

  if (!setId) {
    setStatus('Select a set first.');
    return;
  }

  setStatus('Fetching products + pricing...');

  const [productsData, pricingData] = await Promise.all([
    fetchJson(`${API_BASE}/${POKEMON_CATEGORY}/sets/${setId}`),
    fetchJson(`${API_BASE}/${POKEMON_CATEGORY}/sets/${setId}/pricing`),
  ]);

  const products = productsData.products ?? [];
  const pricing = pricingData.prices ?? {};

  const matches = products.filter((product) => {
    const numberMatch = numberInput ? String(product.number ?? '').toLowerCase() === numberInput.toLowerCase() : true;
    const nameMatch = nameInput ? product.name.toLowerCase().includes(nameInput) : true;
    return numberMatch && nameMatch;
  });

  if (matches.length === 0) {
    setStatus('No matches found. Try card number or partial card name.');
    return;
  }

  const card = matches[0];
  const priceNode = pricing[String(card.id)];
  const market = pickMarketPrice(priceNode);

  state.selectedCard = {
    productId: card.id,
    name: card.name,
    setName: card.set_name,
    number: card.number,
    imageUrl: card.image_url,
    market,
    fullPricing: priceNode?.tcg ?? {},
  };

  renderSelectedCard();
  el.saveBtn.disabled = false;
  setStatus(`Found ${matches.length} match(es). Showing first match.`);
}

function renderSelectedCard() {
  const card = state.selectedCard;
  if (!card) return;

  const pricingRows = Object.entries(card.fullPricing)
    .map(([variant, values]) => `<li>${variant}: market $${values.market ?? 'n/a'} | low $${values.low ?? 'n/a'}</li>`)
    .join('');

  el.result.innerHTML = `
    <img src="${card.imageUrl}" alt="${card.name}" />
    <h3>${card.name}</h3>
    <p>Set: ${card.setName}</p>
    <p>Collector #: ${card.number ?? 'N/A'}</p>
    <p>Quick market: $${card.market ?? 'n/a'}</p>
    <details>
      <summary>All subtype prices</summary>
      <ul>${pricingRows || '<li>No pricing found.</li>'}</ul>
    </details>
  `;
}

function saveCurrentCard() {
  if (!state.selectedCard) return;
  const list = readCollection();
  list.unshift(state.selectedCard);
  writeCollection(list);
  renderCollection();
  setStatus('Saved card to local collection.');
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera API unavailable in this browser.');
    return;
  }
  state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  el.video.srcObject = state.stream;
  setStatus('Camera started.');
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  el.video.srcObject = null;
  setStatus('Camera stopped.');
}

function takeSnapshot() {
  if (!state.stream) {
    setStatus('Start camera first.');
    return;
  }
  const canvas = el.snapshot;
  const video = el.video;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  el.preview.src = canvas.toDataURL('image/jpeg', 0.8);
  setStatus('Captured reference image (local only).');
}

el.loadSetsBtn.addEventListener('click', () => loadSets().catch((error) => setStatus(error.message)));
el.findCardBtn.addEventListener('click', () => findCard().catch((error) => setStatus(error.message)));
el.saveBtn.addEventListener('click', saveCurrentCard);
el.clearCollectionBtn.addEventListener('click', () => {
  writeCollection([]);
  renderCollection();
  setStatus('Collection cleared.');
});
el.startCameraBtn.addEventListener('click', () => startCamera().catch((error) => setStatus(error.message)));
el.stopCameraBtn.addEventListener('click', stopCamera);
el.snapBtn.addEventListener('click', takeSnapshot);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Do nothing; app still works without offline cache.
    });
  });
}

renderCollection();
loadSets().catch((error) => setStatus(error.message));
