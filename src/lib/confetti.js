/**
 * confetti קטן — 8 חלקיקים
 */
const COLORS = ['#744577', '#6b9b7a', '#e8dcef', '#c94c5c', '#f5c842'];

export function burstConfetti(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = COLORS[i % COLORS.length];
    const angle = (Math.PI * 2 * i) / count;
    const dist = 40 + Math.random() * 60;
    el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * dist}px, ${80 + Math.random() * 120}px) rotate(${360 + Math.random() * 360}deg)`,
          opacity: 0,
        },
      ],
      { duration: 700, easing: 'ease-out', fill: 'forwards' }
    );
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
}
