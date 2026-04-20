export default function Header() {
  return (
    <header className="w-full bg-white border-b shadow-sm">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/assets/StickIT.png" alt="Stick-IT Logo" className="h-12 w-12 rounded-full bg-white p-1 shadow-md" />
          <span className="text-2xl md:text-3xl lg:text-4xl font-extrabold leading-none">Stick-IT</span>
        </div>
        
      </div>
    </header>
  );
}
