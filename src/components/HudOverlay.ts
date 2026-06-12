/**
 * 终局结算覆盖层（表现层）。展示 win/lose 标题/副标题 + CTA 跳商店按钮。
 * CTA 点击触发跳转回调（投放时替换为商店链接）。
 */
export class HudOverlay {
  private root: HTMLElement;
  private el: HTMLDivElement | null = null;
  /** 投放商店地址（占位） */
  storeUrl = 'https://example.com/app-store';
  /** CTA 点击回调（默认打开 storeUrl） */
  onCta?: () => void;
  /** "再来一次"回调 */
  onReplay?: () => void;

  constructor(uiRoot: HTMLElement) {
    this.root = uiRoot;
  }

  show(opts: { outcome: 'win' | 'lose'; title: string; subtitle: string; buttonLabel: string; level: number }): void {
    this.close();
    const win = opts.outcome === 'win';
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute; inset:0; z-index:45; display:flex; flex-direction:column;
      justify-content:center; align-items:center; gap:14px; text-align:center;
      background:radial-gradient(ellipse at center, ${win ? 'rgba(40,30,70,0.55)' : 'rgba(60,16,16,0.6)'}, rgba(6,8,14,0.9));
      font-family:'Segoe UI',Arial,sans-serif;
    `;

    const badge = document.createElement('div');
    badge.textContent = win ? '★ VICTORY ★' : '✖ DEFEAT ✖';
    badge.style.cssText = `font-size:18px;letter-spacing:4px;font-weight:700;color:${win ? '#ffe14d' : '#ff8b8b'};`;

    const title = document.createElement('div');
    title.textContent = opts.title;
    title.style.cssText = `font-size:40px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,0.6);`;

    const sub = document.createElement('div');
    sub.textContent = opts.subtitle;
    sub.style.cssText = 'font-size:16px;color:#cdd;';

    const stat = document.createElement('div');
    stat.textContent = `最终等级 Lv.${opts.level}`;
    stat.style.cssText = 'font-size:14px;color:#9ab;margin-bottom:6px;';

    const cta = document.createElement('button');
    cta.textContent = opts.buttonLabel + ' ▶';
    cta.style.cssText = `
      margin-top:6px; padding:16px 40px; border:none; border-radius:14px; cursor:pointer; pointer-events:auto;
      background:linear-gradient(90deg,#ffb13b,#ff6b3b); color:#1a0e00; font-size:22px; font-weight:900;
      box-shadow:0 8px 24px rgba(255,120,40,0.5); animation:ctaPulse 1.1s ease-in-out infinite;
    `;
    cta.addEventListener('click', () => {
      if (this.onCta) this.onCta();
      else window.open(this.storeUrl, '_blank');
    });

    const replay = document.createElement('button');
    replay.textContent = '↻ 再玩一次';
    replay.style.cssText = `
      margin-top:2px; padding:8px 22px; border:1px solid rgba(255,255,255,0.4); border-radius:10px; cursor:pointer;
      background:transparent; color:#dde; font-size:14px; pointer-events:auto;
    `;
    replay.addEventListener('click', () => this.onReplay?.());

    // CTA 脉冲动画
    const style = document.createElement('style');
    style.textContent = '@keyframes ctaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}';
    overlay.appendChild(style);
    overlay.append(badge, title, sub, stat, cta, replay);
    this.root.appendChild(overlay);
    this.el = overlay;
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }
}
