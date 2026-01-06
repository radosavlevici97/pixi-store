import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ComponentMetadata } from '../../types';
import { loadComponent, getComponentSource, getRelatedComponents } from '../../registry';
import { runDemo, type DemoInstance } from '../../utils/demoRunner';

interface ContentModalProps {
  content: ComponentMetadata;
  onClose: () => void;
  onLike: () => void;
  onBookmark: () => void;
  isLiked: boolean;
  isBookmarked: boolean;
}

export function ContentModal({
  content,
  onClose,
  onLike,
  onBookmark,
  isLiked,
  isBookmarked,
}: ContentModalProps) {
  const [activeTab, setActiveTab] = useState<'demo' | 'code'>('demo');
  const [sourceCode, setSourceCode] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const demoInstanceRef = useRef<DemoInstance | null>(null);

  const relatedComponents = getRelatedComponents(content.id);

  // Load source code
  useEffect(() => {
    getComponentSource(content.id).then(setSourceCode).catch(() => setSourceCode('// Failed to load source'));
  }, [content.id]);

  // Load and run component demo
  useEffect(() => {
    if (activeTab !== 'demo' || !canvasRef.current) return;

    const container = canvasRef.current;
    let mounted = true;

    // Cleanup previous demo instance
    if (demoInstanceRef.current) {
      demoInstanceRef.current.destroy();
      demoInstanceRef.current = null;
    }

    // Remove any previously appended canvases
    const existingCanvases = container.querySelectorAll('canvas');
    existingCanvases.forEach((canvas) => canvas.remove());

    setIsLoading(true);
    setError(null);

    const loadAndRun = async () => {
      try {
        const module = (await loadComponent(content.id)) as Record<string, unknown>;

        if (!mounted || !canvasRef.current) return;

        const instance = await runDemo(canvasRef.current, content, module);

        if (!mounted) {
          instance.destroy();
          return;
        }

        demoInstanceRef.current = instance;
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        setIsLoading(false);
        setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Demo load error:', err);
      }
    };

    loadAndRun();

    return () => {
      mounted = false;
      if (demoInstanceRef.current) {
        demoInstanceRef.current.destroy();
        demoInstanceRef.current = null;
      }
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach((canvas) => canvas.remove());
    };
  }, [content.id, content, activeTab]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTheaterMode) {
          setIsTheaterMode(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, isTheaterMode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`relative bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col ${
          isTheaterMode ? 'w-full h-full m-0' : 'w-full h-[95vh] max-w-7xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{content.icon}</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{content.name}</h2>
              <p className="text-xs text-slate-400 capitalize">{content.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setIsTheaterMode(!isTheaterMode)}
              className={`p-2 rounded-lg transition-colors ${
                isTheaterMode
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isTheaterMode ? 'Exit theater mode (Esc)' : 'Theater mode'}
            >
              {isTheaterMode ? '⊡' : '⊞'}
            </button>
            <button
              onClick={onLike}
              className={`p-2 rounded-lg transition-colors ${
                isLiked ? 'bg-pink-500/20 text-pink-400' : 'text-slate-400 hover:text-pink-400 hover:bg-slate-800'
              }`}
            >
              {isLiked ? '❤️' : '🤍'}
            </button>
            <button
              onClick={onBookmark}
              className={`p-2 rounded-lg transition-colors ${
                isBookmarked
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-800'
              }`}
            >
              {isBookmarked ? '⭐' : '☆'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Panel: Demo/Code - Takes priority, minimum 60% height on mobile */}
          <div className={`flex flex-col overflow-hidden min-h-[60%] md:min-h-0 ${isTheaterMode ? 'flex-1' : 'flex-1 md:flex-[2]'}`}>
            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900 z-10">
              <button
                onClick={() => setActiveTab('demo')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'demo'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Demo
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'code'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Code
              </button>
            </div>

            {/* Demo/Code Content */}
            <div className="flex-1 relative overflow-hidden">
              {activeTab === 'demo' ? (
                <div
                  ref={canvasRef}
                  className="absolute inset-0 bg-slate-950 flex items-center justify-center"
                >
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
                      <div className="text-center">
                        <div className="text-4xl animate-pulse mb-2">{content.icon}</div>
                        <p className="text-slate-400">Loading demo...</p>
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
                      <div className="text-center text-red-400">
                        <p className="text-xl mb-2">⚠️</p>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 overflow-auto p-4 bg-slate-900">
                  <pre className="bg-slate-950 rounded-xl p-4 text-sm text-slate-300 font-mono">
                    <code>{sourceCode}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Info (hidden in theater mode) */}
          {!isTheaterMode && (
            <div className="max-h-[40%] md:max-h-none md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-900/80 overflow-y-auto flex-shrink-0">
              <div className="p-4 space-y-4">
                {/* Description */}
                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{content.description}</p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <span className="text-slate-500 text-xs block mb-1">Lines</span>
                    <p className="text-white font-semibold">{content.lines}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <span className="text-slate-500 text-xs block mb-1">File</span>
                    <p className="text-cyan-400 font-medium truncate text-sm">{content.fileName}</p>
                  </div>
                </div>

                {/* Components */}
                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Components
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {content.components.map((comp) => (
                      <span
                        key={comp}
                        className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {content.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-slate-800/50 rounded text-xs text-slate-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Related Components */}
                {relatedComponents.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                      Related
                    </h3>
                    <div className="space-y-2">
                      {relatedComponents.map((related) => (
                        <div
                          key={related.id}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                        >
                          <span>{related.icon}</span>
                          <span className="text-white text-sm">{related.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
