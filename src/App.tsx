import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';

import { COMPONENT_METADATA } from './registry';
import { ContentCard } from './components/content/ContentCard';
import { ContentModal } from './components/content/ContentModal';
import { Header } from './components/layout/Header';
import { useUIStore, useUserStore } from './stores';

export default function App() {
  const { selectedContentId, setSelectedContent } = useUIStore();
  const { viewMode, likedItems, bookmarkedItems, toggleLike, toggleBookmark } = useUserStore();

  const selectedContent = useMemo(
    () => COMPONENT_METADATA.find((c) => c.id === selectedContentId) ?? null,
    [selectedContentId]
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <Header />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Results Info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">
              Showing <span className="text-white font-medium">{COMPONENT_METADATA.length}</span> components
            </p>
          </div>

          {/* Content Grid */}
          <motion.div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'
                : 'flex flex-col gap-3'
            }
            layout
          >
            <AnimatePresence mode="popLayout">
              {COMPONENT_METADATA.map((content, index) => (
                <motion.div
                  key={content.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <ContentCard
                    content={content}
                    onSelect={() => setSelectedContent(content.id)}
                    onLike={() => toggleLike(content.id)}
                    onBookmark={() => toggleBookmark(content.id)}
                    isLiked={likedItems.includes(content.id)}
                    isBookmarked={bookmarkedItems.includes(content.id)}
                    viewMode={viewMode}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>

      {/* Content Modal */}
      <AnimatePresence>
        {selectedContent && (
          <ContentModal
            content={selectedContent}
            onClose={() => setSelectedContent(null)}
            onLike={() => toggleLike(selectedContent.id)}
            onBookmark={() => toggleBookmark(selectedContent.id)}
            isLiked={likedItems.includes(selectedContent.id)}
            isBookmarked={bookmarkedItems.includes(selectedContent.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
