import { useUserStore } from '../../stores';

export function Header() {
  const { viewMode, setViewMode } = useUserStore();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800 flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center text-xl">
              🎮
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">PixiJS Store</h1>
              <p className="text-xs text-slate-400">Premium Visual Components</p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm ${
                viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ☰
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
