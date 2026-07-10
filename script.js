const editor = document.getElementById('editor');
const suggestionBar = document.getElementById('suggestion-bar');
const toggleBtn = document.getElementById('toggle-btn');
const cheatSheetToggle = document.getElementById('cheat-sheet-toggle');
const cheatSheet = document.getElementById('cheat-sheet');
const lineNumbers = document.getElementById('line-numbers');
const draftsSidebar = document.getElementById('drafts-sidebar');
const draftsToggle = document.getElementById('drafts-toggle');
const draftsList = document.getElementById('drafts-list');
const newDraftBtn = document.getElementById('new-draft-btn');

const DRAFTS_KEY = 'arabic-editor-drafts';

let currentWord = '';
let wordStartIndex = 0;
let suggestions = [];
let activeIndex = 0;
let transliterationEnabled = true;
let acceptedSuggestionRange = null;
let requestId = 0;
let drafts = loadDrafts();
let currentDraftId = null;
let saveTimer = null;

function loadDrafts() {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFTS_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function persistDrafts() {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function saveCurrentDraft() {
  clearTimeout(saveTimer);
  const text = editor.value;

  if (!text.trim()) {
    if (currentDraftId) {
      drafts = drafts.filter((draft) => draft.id !== currentDraftId);
      currentDraftId = null;
      persistDrafts();
      renderDraftsList();
    }
    return;
  }

  if (!currentDraftId) {
    currentDraftId = Date.now().toString();
    drafts.unshift({ id: currentDraftId, text, updatedAt: Date.now() });
  } else {
    const draft = drafts.find((item) => item.id === currentDraftId);
    if (draft.text === text) return;
    draft.text = text;
    draft.updatedAt = Date.now();
    drafts = [draft, ...drafts.filter((item) => item.id !== currentDraftId)];
  }

  persistDrafts();
  renderDraftsList();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentDraft, 400);
}

function renderDraftsList() {
  draftsList.innerHTML = '';

  if (drafts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'rounded-sm bg-blue-50 px-3 py-2 text-slate-500';
    empty.textContent = 'لا توجد مسودات بعد';
    draftsList.appendChild(empty);
    return;
  }

  drafts.forEach((draft) => {
    const item = document.createElement('li');
    const isActive = draft.id === currentDraftId;
    item.className = `flex items-center gap-2 rounded-sm border px-3 py-2 transition ${isActive ? 'border-blue-500 bg-blue-50' : 'border-blue-100 bg-white hover:bg-blue-50'}`;

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'min-w-0 flex-1 text-right';
    const preview = document.createElement('span');
    preview.className = 'block truncate font-medium text-slate-700';
    preview.textContent = draft.text.trim().slice(0, 40);
    const time = document.createElement('span');
    time.className = 'mt-0.5 block text-xs text-slate-400';
    time.textContent = new Date(draft.updatedAt).toLocaleString('ar', { dateStyle: 'short', timeStyle: 'short' });
    openBtn.appendChild(preview);
    openBtn.appendChild(time);
    openBtn.addEventListener('click', () => openDraft(draft.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600';
    deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>';
    deleteBtn.setAttribute('aria-label', 'حذف المسودة');
    deleteBtn.addEventListener('click', () => deleteDraft(draft.id));

    item.appendChild(openBtn);
    item.appendChild(deleteBtn);
    draftsList.appendChild(item);
  });
}

function resetEditorState() {
  requestId += 1;
  acceptedSuggestionRange = null;
  clearSuggestionBar();
  updateLineNumbers();
}

function openDraft(id) {
  saveCurrentDraft();
  const draft = drafts.find((item) => item.id === id);
  if (!draft) return;

  currentDraftId = id;
  editor.value = draft.text;
  resetEditorState();
  renderDraftsList();
  editor.focus();
}

function deleteDraft(id) {
  if (!window.confirm('هل تريد حذف هذه المسودة؟')) return;

  drafts = drafts.filter((draft) => draft.id !== id);
  persistDrafts();

  if (id === currentDraftId) {
    currentDraftId = null;
    editor.value = '';
    resetEditorState();
  }

  renderDraftsList();
}

function newDraft() {
  saveCurrentDraft();
  currentDraftId = null;
  editor.value = '';
  resetEditorState();
  renderDraftsList();
  editor.focus();
}

function updateToggleButton() {
  toggleBtn.title = transliterationEnabled ? 'الترجمة الصوتية تعمل (Ctrl+M)' : 'الترجمة الصوتية متوقفة (Ctrl+M)';
  toggleBtn.classList.toggle('bg-blue-600', transliterationEnabled);
  toggleBtn.classList.toggle('hover:bg-blue-700', transliterationEnabled);
  toggleBtn.classList.toggle('bg-slate-400', !transliterationEnabled);
  toggleBtn.classList.toggle('hover:bg-slate-500', !transliterationEnabled);
}

function updateLineNumbers() {
  const lineCount = editor.value.split('\n').length;
  lineNumbers.innerHTML = '';

  for (let i = 1; i <= lineCount; i += 1) {
    const row = document.createElement('div');
    row.textContent = i;
    lineNumbers.appendChild(row);
  }

  lineNumbers.scrollTop = editor.scrollTop;
}

function getCurrentWordInfo() {
  if (!transliterationEnabled) return null;

  const cursorIndex = editor.selectionStart;
  const textUpToCursor = editor.value.slice(0, cursorIndex);
  const lastWordMatch = textUpToCursor.match(/[a-zA-Z0-9]+$/);

  if (!lastWordMatch) return null;

  return {
    word: lastWordMatch[0],
    start: cursorIndex - lastWordMatch[0].length,
  };
}

function setLoadingState(loading) {
  if (loading) {
    suggestionBar.innerHTML = '';
    const loader = document.createElement('div');
    loader.className = 'flex items-center text-sm text-slate-500';
    loader.innerHTML = '<span class="loading-spinner"></span><span>Loading suggestions...</span>';
    suggestionBar.appendChild(loader);
    return;
  }

  if (suggestions.length === 0) {
    clearSuggestionBar();
  }
}

function clearSuggestionBar() {
  suggestionBar.innerHTML = '';
  suggestions = [];
  activeIndex = 0;
}

function renderSuggestionBar(list) {
  suggestionBar.innerHTML = '';
  activeIndex = 0;

  list.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `suggestion-item shrink-0 whitespace-nowrap rounded-sm border px-2 py-1 text-sm font-medium shadow-sm ${index === 0 ? 'active border-blue-600 bg-blue-600 text-white' : 'border-blue-100 bg-white text-slate-700 hover:border-blue-300'}`;
    button.textContent = item;
    button.addEventListener('click', () => selectSuggestion(index));
    suggestionBar.appendChild(button);
  });
}

function fetchTransliteration(word) {
  if (!transliterationEnabled || !word) {
    clearSuggestionBar();
    return;
  }

  const url = `https://inputtools.google.com/request?text=${word}&itc=ar-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;

  const id = ++requestId;
  setLoadingState(true);

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      if (id !== requestId) return;

      if (data[0] === 'SUCCESS' && data[1][0][1].length > 0) {
        suggestions = [...data[1][0][1], word];
        renderSuggestionBar(suggestions);
      } else {
        clearSuggestionBar();
      }
    })
    .catch((error) => {
      if (id !== requestId) return;
      console.error('Transliteration error:', error);
      clearSuggestionBar();
    })
    .finally(() => {
      if (id === requestId) setLoadingState(false);
    });
}

function selectSuggestion(index) {
  const selectedText = suggestions[index];
  if (!selectedText) return;

  const before = editor.value.slice(0, wordStartIndex);
  const after = editor.value.slice(wordStartIndex + currentWord.length);
  const newValue = `${before}${selectedText} ${after}`;
  editor.value = newValue;

  const insertedLength = selectedText.length + 1;
  const newCursor = wordStartIndex + insertedLength;
  editor.focus();
  editor.setSelectionRange(newCursor, newCursor);

  acceptedSuggestionRange = {
    start: wordStartIndex,
    end: wordStartIndex + insertedLength,
    length: insertedLength,
    originalWord: currentWord,
  };

  clearSuggestionBar();
  updateLineNumbers();
  scheduleSave();
}

function deleteAcceptedSuggestion() {
  if (!acceptedSuggestionRange) return;

  const restoredText = `${acceptedSuggestionRange.originalWord} `;
  const before = editor.value.slice(0, acceptedSuggestionRange.start);
  const after = editor.value.slice(acceptedSuggestionRange.start + acceptedSuggestionRange.length);
  editor.value = `${before}${restoredText}${after}`;

  const newCursor = acceptedSuggestionRange.start + restoredText.length;
  editor.focus();
  editor.setSelectionRange(newCursor, newCursor);
  acceptedSuggestionRange = null;
  clearSuggestionBar();
  updateLineNumbers();
  scheduleSave();
}

function toggleTransliteration() {
  transliterationEnabled = !transliterationEnabled;
  updateToggleButton();

  if (!transliterationEnabled) {
    clearSuggestionBar();
    acceptedSuggestionRange = null;
    return;
  }

  const wordInfo = getCurrentWordInfo();
  if (wordInfo) {
    currentWord = wordInfo.word;
    wordStartIndex = wordInfo.start;
    fetchTransliteration(currentWord);
  }
}

editor.addEventListener('input', () => {
  updateLineNumbers();
  scheduleSave();

  if (!transliterationEnabled) {
    clearSuggestionBar();
    return;
  }

  const wordInfo = getCurrentWordInfo();
  if (wordInfo) {
    currentWord = wordInfo.word;
    wordStartIndex = wordInfo.start;
    fetchTransliteration(currentWord);
  } else {
    clearSuggestionBar();
  }
});

editor.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    toggleTransliteration();
    return;
  }

  if (!transliterationEnabled) return;

  if (event.key === 'Enter' && suggestions.length > 0 && !event.shiftKey) {
    event.preventDefault();
    selectSuggestion(activeIndex);
    return;
  }

  if (event.key === ' ' && suggestions.length > 0) {
    event.preventDefault();
    selectSuggestion(activeIndex);
    return;
  }

  if (event.key === 'Escape' && suggestions.length > 0) {
    event.preventDefault();
    clearSuggestionBar();
    return;
  }

  if (event.key === 'Backspace' && acceptedSuggestionRange) {
    const cursorIndex = editor.selectionStart;
    const rangeEnd = acceptedSuggestionRange.end;
    if (cursorIndex <= rangeEnd && cursorIndex >= acceptedSuggestionRange.start) {
      event.preventDefault();
      deleteAcceptedSuggestion();
      return;
    }
  }

  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    acceptedSuggestionRange = null;
  }
});

toggleBtn.addEventListener('click', toggleTransliteration);

cheatSheetToggle.addEventListener('click', () => {
  cheatSheet.classList.toggle('hidden');
});

editor.addEventListener('scroll', () => {
  lineNumbers.scrollTop = editor.scrollTop;
});

draftsToggle.addEventListener('click', () => {
  draftsSidebar.classList.toggle('hidden');
});

newDraftBtn.addEventListener('click', newDraft);

window.addEventListener('beforeunload', saveCurrentDraft);

updateToggleButton();
clearSuggestionBar();
updateLineNumbers();
renderDraftsList();
