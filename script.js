const editor = document.getElementById('editor');
const suggestionBar = document.getElementById('suggestion-bar');
const toggleBtn = document.getElementById('toggle-btn');
const cheatSheetToggle = document.getElementById('cheat-sheet-toggle');
const cheatSheet = document.getElementById('cheat-sheet');
const lineNumbers = document.getElementById('line-numbers');
const editorMirror = document.getElementById('editor-mirror');

let currentWord = '';
let wordStartIndex = 0;
let suggestions = [];
let activeIndex = 0;
let transliterationEnabled = true;
let acceptedSuggestionRange = null;
let requestId = 0;

function updateToggleButton() {
  toggleBtn.textContent = transliterationEnabled ? 'Transliteration: ON' : 'Transliteration: OFF';
  toggleBtn.classList.toggle('bg-blue-600', transliterationEnabled);
  toggleBtn.classList.toggle('hover:bg-blue-700', transliterationEnabled);
  toggleBtn.classList.toggle('bg-slate-500', !transliterationEnabled);
  toggleBtn.classList.toggle('hover:bg-slate-600', !transliterationEnabled);
}

function updateLineNumbers() {
  const styles = window.getComputedStyle(editor);
  editorMirror.style.fontFamily = styles.fontFamily;
  editorMirror.style.fontSize = styles.fontSize;
  editorMirror.style.lineHeight = styles.lineHeight;
  editorMirror.style.width = `${editor.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)}px`;

  const lines = editor.value.split('\n');
  lineNumbers.innerHTML = '';

  lines.forEach((line, index) => {
    editorMirror.textContent = line || ' ';
    const row = document.createElement('div');
    row.textContent = index + 1;
    row.style.height = `${editorMirror.offsetHeight}px`;
    lineNumbers.appendChild(row);
  });

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
    loader.className = 'flex items-center gap-2 text-sm text-slate-500';
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
    button.className = `suggestion-item rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm ${index === 0 ? 'active ring-2 ring-blue-500' : ''}`;
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

window.addEventListener('resize', updateLineNumbers);
window.addEventListener('load', updateLineNumbers);

updateToggleButton();
clearSuggestionBar();
updateLineNumbers();
