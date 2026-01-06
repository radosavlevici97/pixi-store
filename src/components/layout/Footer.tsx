export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/50 py-8 mt-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xl">🎮</span>
            <span className="font-semibold text-white">PixiJS Store</span>
            <span className="text-sm">- Premium Visual Components</span>
          </div>
          <div className="text-slate-500 text-sm">
            Built with PixiJS v8, React, and TypeScript
          </div>
        </div>
      </div>
    </footer>
  );
}
