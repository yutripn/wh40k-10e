const API_BASE = 'https://tcgtracking.com/tcgapi/v1';
const POKEMON_CATEGORY = 3;
const collectionKey = 'pokemon-scanner-collection-v1';
const lockedSetsKey = 'pokemon-scanner-locked-sets-v1';

const state = {
  sets: [],
  stream: null,
  setCache: new Map(),
  priceCache: new Map(),
  lockedSetIds: new Set(),
};

const el = {
  setSearch: document.getElementById('setSearch'),
  setSelect: document.getElementById('setSelect'),
  addLockBtn: document.getElementById('addLockBtn'),
  lockedSetList: document.getElementById('lockedSetList'),
  cardNumber: document.getElementById('cardNumber'),
  nameFilter: document.getElementById('nameFilter'),
  findCardBtn: document.getElementById('findCardBtn'),
  status: document.getElementById('status'),
  result: document.getElementById('result'),
  collectionList: document.getElementById('collectionList'),
  clearCollectionBtn: document.getElementById('clearCollectionBtn'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),
  scanBtn: document.getElementById('scanBtn'),
  video: document.getElementById('video'),
  preview: document.getElementById('preview'),
  snapshot: document.getElementById('snapshot'),
};

function setStatus(message) {
  el.status.textContent = message;
}

function readJsonStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readCollection() {
  return readJsonStorage(collectionKey, []);
}

function writeCollection(list) {
  writeJsonStorage(collectionKey, list);
}

function loadLockedSets() {
  const ids = readJsonStorage(lockedSetsKey, []);
  state.lockedSetIds = new Set(ids.map(String));
}

function saveLockedSets() {
  writeJsonStorage(lockedSetsKey, [...state.lockedSetIds]);
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
    li.textContent = `${item.name} [${item.setName}] #${item.number} (${item.variant}) — $${item.market ?? 'n/a'}`;
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

function renderLockedSets() {
  el.lockedSetList.innerHTML = '';
  const ids = [...state.lockedSetIds];

  if (ids.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No set locks active. Scanner checks all sets.';
    el.lockedSetList.appendChild(li);
    return;
  }

  ids.forEach((id) => {
    const set = state.sets.find((x) => String(x.id) === id);
    const li = document.createElement('li');
    li.textContent = set ? `${set.name} (${set.abbr ?? 'N/A'})` : `Set #${id}`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Unlock';
    removeBtn.style.marginLeft = '0.5rem';
    removeBtn.addEventListener('click', () => {
      state.lockedSetIds.delete(id);
      saveLockedSets();
      renderLockedSets();
    });
    li.appendChild(removeBtn);
    el.lockedSetList.appendChild(li);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return response.json();
}

function populateSetSelect(list) {
  el.setSelect.innerHTML = '';
  list.forEach((set) => {
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
  filterSetOptions();
  renderLockedSets();
  setStatus(`Loaded ${state.sets.length} set(s).`);
}

function filterSetOptions() {
  const query = el.setSearch.value.trim().toLowerCase();
  const filtered = query
    ? state.sets.filter((set) => set.name.toLowerCase().includes(query) || (set.abbr ?? '').toLowerCase().includes(query))
    : state.sets;
  populateSetSelect(filtered.slice(0, 250));
}

async function getSetProducts(setId) {
  if (state.setCache.has(setId)) return state.setCache.get(setId);
  const data = await fetchJson(`${API_BASE}/${POKEMON_CATEGORY}/sets/${setId}`);
  const products = data.products ?? [];
  state.setCache.set(setId, products);
  return products;
}

async function getSetPricing(setId) {
  if (state.priceCache.has(setId)) return state.priceCache.get(setId);
  const data = await fetchJson(`${API_BASE}/${POKEMON_CATEGORY}/sets/${setId}/pricing`);
  const prices = data.prices ?? {};
  state.priceCache.set(setId, prices);
  return prices;
}

function getActiveSetIds() {
  return state.lockedSetIds.size > 0 ? [...state.lockedSetIds] : state.sets.map((set) => String(set.id));
}

function parseCollectorNumber(text) {
  const match = text.match(/\b(\d{1,3})\s*\/\s*\d{2,3}\b/) ?? text.match(/\b(\d{1,3})\b/);
  return match ? match[1] : '';
}

function parseLikelyName(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[A-Za-z][A-Za-z\s\-'.]{2,}$/.test(line));
  return lines[0] ?? '';
}

async function scanFromCamera() {
  if (!state.stream) {
    setStatus('Start camera first.');
    return;
  }
  if (!window.Tesseract) {
    setStatus('OCR library unavailable.');
    return;
  }

  const canvas = el.snapshot;
  const video = el.video;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  el.preview.src = canvas.toDataURL('image/jpeg', 0.85);

  setStatus('Running OCR scan...');
  const result = await window.Tesseract.recognize(canvas, 'eng');
  const scannedText = result?.data?.text ?? '';

  const detectedNumber = parseCollectorNumber(scannedText);
  const detectedName = parseLikelyName(scannedText);

  if (detectedNumber) el.cardNumber.value = detectedNumber;
  if (detectedName) el.nameFilter.value = detectedName;

  setStatus(`Scan complete.${detectedNumber ? ` Number: ${detectedNumber}.` : ''}${detectedName ? ` Name: ${detectedName}.` : ''}`);
}

function getVariants(priceNode) {
  const variants = Object.entries(priceNode?.tcg ?? {});
  if (variants.length === 0) return [['default', { market: null, low: null }]];
  return variants;
}

async function findMatches() {
  const numberInput = el.cardNumber.value.trim().toLowerCase();
  const nameInput = el.nameFilter.value.trim().toLowerCase();

  if (!numberInput && !nameInput) {
    setStatus('Scan a card (or manually fill number/name) first.');
    return;
  }

  const activeSetIds = getActiveSetIds();
  setStatus(`Searching ${activeSetIds.length} set(s)...`);
  el.result.innerHTML = '';

  const allMatches = [];

  for (const setId of activeSetIds) {
    const [products, pricing] = await Promise.all([getSetProducts(setId), getSetPricing(setId)]);

    products.forEach((product) => {
      const productNumber = String(product.number ?? '').toLowerCase();
      const numberMatch = numberInput ? productNumber === numberInput : true;
      const nameMatch = nameInput ? product.name.toLowerCase().includes(nameInput) : true;

      if (numberMatch && nameMatch) {
        const variants = getVariants(pricing[String(product.id)]);
        allMatches.push({
          id: product.id,
          name: product.name,
          number: product.number,
          imageUrl: product.image_url,
          setName: product.set_name,
          variants,
        });
      }
    });
  }

  if (allMatches.length === 0) {
    setStatus('No matches found. Try rescanning or loosening filters.');
    return;
  }

  renderMatches(allMatches);
  setStatus(`Found ${allMatches.length} possible match(es).`);
}

function saveCard(card, variantName, values) {
  const collection = readCollection();
  collection.unshift({
    name: card.name,
    number: card.number,
    setName: card.setName,
    imageUrl: card.imageUrl,
    variant: variantName,
    market: values.market ?? null,
    low: values.low ?? null,
  });
  writeCollection(collection);
  renderCollection();
  setStatus('Saved selected variant to collection.');
}

function renderMatches(matches) {
  el.result.innerHTML = '';

  matches.forEach((card) => {
    const wrap = document.createElement('article');
    wrap.className = 'match-card';

    const img = document.createElement('img');
    img.src = card.imageUrl;
    img.alt = card.name;

    const title = document.createElement('h3');
    title.textContent = `${card.name} [${card.setName}] #${card.number ?? 'N/A'}`;

    const variantLabel = document.createElement('label');
    variantLabel.textContent = 'Variant';

    const variantSelect = document.createElement('select');
    card.variants.forEach(([variant, values]) => {
      const option = document.createElement('option');
      option.value = variant;
      option.textContent = `${variant} (market $${values.market ?? 'n/a'})`;
      variantSelect.appendChild(option);
    });

    const variantDetails = document.createElement('p');
    const syncVariantText = () => {
      const selected = card.variants.find(([name]) => name === variantSelect.value) ?? card.variants[0];
      variantDetails.textContent = `Selected: ${selected[0]} | market $${selected[1].market ?? 'n/a'} | low $${selected[1].low ?? 'n/a'}`;
    };
    variantSelect.addEventListener('change', syncVariantText);
    syncVariantText();

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save This Variant';
    saveBtn.addEventListener('click', () => {
      const selected = card.variants.find(([name]) => name === variantSelect.value) ?? card.variants[0];
      saveCard(card, selected[0], selected[1]);
    });

    wrap.append(img, title, variantLabel, variantSelect, variantDetails, saveBtn);
    el.result.appendChild(wrap);
  });
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

function addSetLock() {
  const selectedId = el.setSelect.value;
  if (!selectedId) return;
  state.lockedSetIds.add(String(selectedId));
  saveLockedSets();
  renderLockedSets();
  setStatus('Set lock added.');
}

el.setSearch.addEventListener('input', filterSetOptions);
el.addLockBtn.addEventListener('click', addSetLock);
el.startCameraBtn.addEventListener('click', () => startCamera().catch((error) => setStatus(error.message)));
el.stopCameraBtn.addEventListener('click', stopCamera);
el.scanBtn.addEventListener('click', () => scanFromCamera().catch((error) => setStatus(error.message)));
el.findCardBtn.addEventListener('click', () => findMatches().catch((error) => setStatus(error.message)));
el.clearCollectionBtn.addEventListener('click', () => {
  writeCollection([]);
  renderCollection();
  setStatus('Collection cleared.');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // App still works without offline cache.
    });
  });
}

loadLockedSets();
renderCollection();
loadSets().catch((error) => setStatus(error.message));
