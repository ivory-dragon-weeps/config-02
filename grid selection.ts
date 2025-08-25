import { fromEvent, EMPTY, of, operators } from "npm:rxjs;
const { switchMap, scan, takeUntil, filter, tap, startWith, map } = rxjs;

// --- A. STYLES & CONFIGURATION ---

const CSS = `
  .resonant-grid-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99999999;
    pointer-events: none;
    border: 2px dashed rgba(255, 50, 50, 0.7);
    box-sizing: border-box;
  }
  .resonant-grid-label {
    position: absolute;
    background-color: rgba(255, 235, 59, 0.95);
    color: black;
    font-family: monospace;
    font-size: 14px;
    font-weight: bold;
    padding: 2px 5px;
    border-radius: 3px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.5);
    z-index: 100000000;
    pointer-events: none;
  }
  .resonant-grid-hover {
    outline: 3px solid rgba(50, 150, 255, 0.85) !important;
    outline-offset: 2px;
  }
`;

const ACTIVATION_SHORTCUT = (e: KeyboardEvent) => e.ctrlKey && e.code === 'KeyG'; //:2
const SELECTION_KEYS = 'asdfqwerjkluiopm'.split(''); //:3

// --- B. CORE STATE & TYPES ---

interface SelectionState { //:4
  scope: HTMLElement;
  targets: Map<string, HTMLElement>;
  hud: HTMLElement;
  hoveredElement: HTMLElement | null;
}

// --- C. PURE HELPER FUNCTIONS (WSA-Literate) ---

const isVisible = (el: HTMLElement): boolean => { //:5
  const rect = el.getBoundingClientRect();
  if (rect.width < 15 || rect.height < 15) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
};

const getSelectableChildren = (parent: HTMLElement): HTMLElement[] => { //:6
  const children = Array.from(parent.children) as HTMLElement[];
  const uniqueVisibleChildren = new Set<HTMLElement>();

  // Prioritize accessibility roles and semantic containers
  const roles = 'main, region, navigation, complementary, banner, contentinfo, form, section, article, aside, header, footer';
  const semanticTags = 'DIV, MAIN, SECTION, ARTICLE, NAV, ASIDE, HEADER, FOOTER, FORM';

  // Find all potentially interesting elements within the scope
  const candidates = Array.from(parent.querySelectorAll(roles + ', ' + semanticTags));
  candidates.unshift(...children);

  for (const el of candidates) {
    if (isVisible(el)) {
        // Avoid adding an element if its visible parent is already in the set
        let current = el.parentElement;
        let isRedundant = false;
        while(current && current !== parent) {
            if(uniqueVisibleChildren.has(current)) {
                isRedundant = true;
                break;
            }
            current = current.parentElement;
        }
        if(!isRedundant) uniqueVisibleChildren.add(el);
    }
  }
  return Array.from(uniqueVisibleChildren);
};

// --- D. SIDE-EFFECTFUL ACTIONS (DOM Interaction) ---

const dispatchHover = (element: HTMLElement | null, prevElement: HTMLElement | null): void => { //:7
  prevElement?.classList.remove('resonant-grid-hover');
  prevElement?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, composed: true }));

  element?.classList.add('resonant-grid-hover');
  element?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }));
};

const performClick = (el: HTMLElement) => el.click(); //:8
const performFocus = (el: HTMLElement) => el.focus({ preventScroll: true }); //:9

const renderHUD = (scope: HTMLElement, targets: Map<string, HTMLElement>): HTMLElement => { //:10
  const overlay = document.createElement('div');
  overlay.className = 'resonant-grid-overlay';
  const scopeRect = scope.getBoundingClientRect();
  overlay.style.left = `${scopeRect.left}px`;
  overlay.style.top = `${scopeRect.top}px`;
  overlay.style.width = `${scopeRect.width}px`;
  overlay.style.height = `${scopeRect.height}px`;

  targets.forEach((el, key) => {
    const rect = el.getBoundingClientRect();
    const label = document.createElement('span');
    label.className = 'resonant-grid-label';
    label.textContent = key;
    label.style.left = `${rect.left}px`;
    label.style.top = `${rect.top}px`;
    overlay.appendChild(label);
  });

  document.body.appendChild(overlay);
  return overlay;
};

// --- E. RXJS CORE LOGIC ---

function sessionReducer(state: SelectionState, event: KeyboardEvent): SelectionState { //:11
  const { scope, targets, hoveredElement } = state;
  state.hud.remove();
  dispatchHover(null, hoveredElement);

  // --- Action handlers
  if (event.key === '.' && hoveredElement) {
    performClick(hoveredElement);
    return null; // End session
  }
  if (event.code === 'Space' && hoveredElement) {
    performFocus(hoveredElement);
    return null; // End session
  }
  if (event.key === 'Backspace') {
    const newScope = scope.parentElement || document.body;
    return createInitialState(newScope);
  }

  // --- Navigation handler
  const newHovered = targets.get(event.key);
  if (newHovered && SELECTION_KEYS.includes(event.key)) {
     // Drill down into the new element
     return createInitialState(newHovered);
  }

  // No valid action, redraw current state
  return createInitialState(scope);
}

const createInitialState = (scope: HTMLElement): SelectionState => { //:12
    const children = getSelectableChildren(scope);
    const targets = new Map(children.slice(0, SELECTION_KEYS.length).map((el, i) => [SELECTION_KEYS[i], el]));
    const hud = renderHUD(scope, targets);
    return { scope, targets, hud, hoveredElement: scope };
};

const main = () => { //:13
  GM_addStyle(CSS);
  const keydown$ = fromEvent<KeyboardEvent>(document, 'keydown');

  const activation$ = keydown$.pipe(filter(ACTIVATION_SHORTCUT));
  const escape$ = keydown$.pipe(filter(e => e.key === 'Escape'));

  activation$.pipe(
    tap(e => e.preventDefault()),
    switchMap(() => {
      const initialState = createInitialState(document.body);
      dispatchHover(initialState.scope, null);

      return keydown$.pipe(
        tap(e => { e.preventDefault(); e.stopPropagation(); }),
        scan(sessionReducer, initialState),
        takeUntil(escape$.pipe(tap(e => e.preventDefault()))),
        takeUntil(filter(state => !state)), // End stream if reducer returns null
        tap({
          complete: () => {
            document.querySelectorAll('.resonant-grid-overlay').forEach(e => e.remove());
            document.querySelectorAll('.resonant-grid-hover').forEach(e => e.classList.remove('resonant-grid-hover'));
          }
        })
      );
    })
  ).subscribe();
};

main(); //:14
