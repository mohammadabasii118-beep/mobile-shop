export default function LiveProjectButton({ label = 'Live Project' }: { label?: string }) {
  return (
    <button
      className="rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA] font-medium uppercase tracking-widest px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base bg-transparent hover:bg-[#D7E2EA]/10 transition-colors duration-200 cursor-pointer whitespace-nowrap"
      style={{ fontFamily: 'inherit' }}
    >
      {label}
    </button>
  );
}
