import type { BranchOption } from '../logic/config/evolution';

/**
 * 进化分支选择面板（表现层）。弹出元素/形态卡片，玩家点选后回调。
 * 期间游戏应暂停（cinematic）。详见 specs/components/EvolutionChoicePanel.spec.md。
 */
export class EvolutionChoicePanel {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;

  constructor(uiRoot: HTMLElement) {
    this.root = uiRoot;
  }

  get isOpen(): boolean {
    return this.el !== null;
  }

  /** 打开面板；选择后 resolve 选项 id */
  open(options: BranchOption[]): Promise<string> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:absolute; inset:0; z-index:38; display:flex; flex-direction:column;
        justify-content:center; align-items:center; gap:18px;
        background:radial-gradient(ellipse at center, rgba(20,24,40,0.55), rgba(8,10,18,0.82));
        font-family:'Segoe UI',Arial,sans-serif;
      `;
      const title = document.createElement('div');
      title.textContent = '选择进化方向';
      title.style.cssText = 'font-size:26px;font-weight:800;color:#ffe14d;text-shadow:0 2px 8px rgba(0,0,0,0.6);';
      overlay.appendChild(title);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:90%;';
      overlay.appendChild(row);

      for (const opt of options) {
        const card = document.createElement('button');
        const hex = opt.body.toString(16).padStart(6, '0');
        card.style.cssText = `
          width:140px; padding:16px 12px; border:2px solid #${hex}; border-radius:14px; cursor:pointer;
          background:rgba(255,255,255,0.06); color:#fff; display:flex; flex-direction:column;
          align-items:center; gap:8px; pointer-events:auto; transition:transform .1s;
        `;
        card.onmouseenter = () => (card.style.transform = 'translateY(-4px)');
        card.onmouseleave = () => (card.style.transform = '');
        card.innerHTML = `
          <div style="width:54px;height:54px;border-radius:50%;background:#${hex};box-shadow:0 0 18px #${hex};"></div>
          <div style="font-size:16px;font-weight:700;">${opt.name}</div>
          <div style="font-size:12px;color:#bcd;">${opt.element}系</div>
          <div style="font-size:11px;color:#9ab;">速度×${opt.speedMul.toFixed(2)} · 范围×${opt.reachMul.toFixed(2)}</div>
        `;
        card.addEventListener('click', () => {
          this.close();
          resolve(opt.id);
        });
        row.appendChild(card);
      }

      this.root.appendChild(overlay);
      this.el = overlay;
    });
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }
}
