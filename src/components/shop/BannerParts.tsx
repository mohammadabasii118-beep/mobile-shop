/** اجزای مشترک نمایش بنر (هیرو و پیش‌نمایش پنل) */
export function Title({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, li, arr) => (
        <span key={li}>
          {line.split(/(\*[^*]+\*)/).map((part, pi) => (part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <em key={pi}>{part.slice(1, -1)}</em> : part))}
          {li < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

export function BadgeChip({ text }: { text: string }) {
  if (!text) return null;
  const [a, b] = text.split('|');
  return (
    <span className="chip-badge">
      <b>{a}</b>
      {b && <span>{b}</span>}
    </span>
  );
}
