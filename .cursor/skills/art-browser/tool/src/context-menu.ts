export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

let menuEl: HTMLElement | null = null;
let currentActions: (() => void)[] = [];
let initialized = false;

function getMenu(): HTMLElement {
  if (!menuEl) {
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.style.display = 'none';
    document.body.appendChild(menuEl);
  }

  if (!initialized) {
    initialized = true;

    document.addEventListener('mousedown', (e) => {
      if (menuEl && menuEl.style.display !== 'none' && !menuEl.contains(e.target as Node)) {
        hideContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideContextMenu();
    });

    window.addEventListener('scroll', () => hideContextMenu(), true);

    menuEl.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.ctx-menu-item:not(.ctx-menu-disabled)') as HTMLElement | null;
      if (item) {
        const index = parseInt(item.dataset.index || '0', 10);
        currentActions[index]?.();
        hideContextMenu();
      }
    });

    menuEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return menuEl;
}

export function showContextMenu(x: number, y: number, items: ContextMenuItem[]) {
  const menu = getMenu();
  currentActions = items.map((i) => i.onClick);

  menu.innerHTML = items
    .map(
      (item, i) =>
        `<div class="ctx-menu-item${item.disabled ? ' ctx-menu-disabled' : ''}" data-index="${i}">
          ${item.icon ? `<span class="ctx-menu-icon">${item.icon}</span>` : ''}
          <span>${item.label}</span>
        </div>`,
    )
    .join('');

  menu.style.display = 'block';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${Math.max(0, x - rect.width)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(0, y - rect.height)}px`;
    }
  });
}

export function hideContextMenu() {
  if (menuEl) {
    menuEl.style.display = 'none';
  }
  currentActions = [];
}
