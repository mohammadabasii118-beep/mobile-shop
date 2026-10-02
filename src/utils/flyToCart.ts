/** افکت پرواز محصول به سمت آیکون سبد خرید */
export function flyToCart(from: HTMLElement | null) {
  const target = document.getElementById('cart-icon');
  if (!from || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed', zIndex: '200', width: '22px', height: '22px', borderRadius: '50%', pointerEvents: 'none',
    left: `${a.left + a.width / 2 - 11}px`, top: `${a.top + a.height / 2 - 11}px`,
    background: 'linear-gradient(135deg,#8B5CF6,#EC4899)', boxShadow: '0 0 24px #8B5CF6',
  });
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = dot.animate(
    [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 80}px) scale(1.2)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.2 }],
    { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' },
  );
  anim.onfinish = () => dot.remove();
}
