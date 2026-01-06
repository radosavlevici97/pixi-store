import type { ComponentMetadata, ViewMode } from '../../types';

interface ContentCardProps {
  content: ComponentMetadata;
  onSelect: () => void;
  onLike: () => void;
  onBookmark: () => void;
  isLiked: boolean;
  isBookmarked: boolean;
  viewMode: ViewMode;
}

const complexityColors = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-orange-500/20 text-orange-400',
  expert: 'bg-red-500/20 text-red-400',
};

export function ContentCard({
  content,
  onSelect,
  onLike,
  onBookmark,
  isLiked,
  isBookmarked,
  viewMode,
}: ContentCardProps) {
  if (viewMode === 'list') {
    return (
      <div
        onClick={onSelect}
        className="group flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-cyan-500/50 hover:bg-slate-800/50 cursor-pointer transition-all"
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${content.color}20` }}
        >
          {content.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{content.name}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${complexityColors[content.complexity]}`}>
              {content.complexity}
            </span>
          </div>
          <p className="text-sm text-slate-400 truncate">{content.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className={`p-2 rounded-lg transition-colors ${
              isLiked ? 'text-pink-500 bg-pink-500/20' : 'text-slate-400 hover:text-pink-500 hover:bg-slate-700'
            }`}
          >
            {isLiked ? '❤️' : '🤍'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className={`p-2 rounded-lg transition-colors ${
              isBookmarked
                ? 'text-yellow-500 bg-yellow-500/20'
                : 'text-slate-400 hover:text-yellow-500 hover:bg-slate-700'
            }`}
          >
            {isBookmarked ? '⭐' : '☆'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className="group relative bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-cyan-500/50 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-cyan-500/10"
    >
      {/* Preview Area */}
      <div
        className="h-48 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${content.color}20, transparent)`,
        }}
      >
        {/* Large Icon */}
        <div className="absolute inset-0 flex items-center justify-center text-8xl opacity-30 group-hover:opacity-50 transition-opacity">
          {content.icon}
        </div>

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 bg-slate-900/80 backdrop-blur rounded-lg text-xs text-slate-300 capitalize">
            {content.category}
          </span>
        </div>

        {/* Complexity Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 rounded-lg text-xs ${complexityColors[content.complexity]}`}>
            {content.complexity}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className={`p-2 rounded-lg backdrop-blur transition-colors ${
              isLiked ? 'bg-pink-500/30 text-pink-400' : 'bg-slate-900/80 text-slate-400 hover:text-pink-400'
            }`}
          >
            {isLiked ? '❤️' : '🤍'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className={`p-2 rounded-lg backdrop-blur transition-colors ${
              isBookmarked ? 'bg-yellow-500/30 text-yellow-400' : 'bg-slate-900/80 text-slate-400 hover:text-yellow-400'
            }`}
          >
            {isBookmarked ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors">
          {content.name}
        </h3>
        <p className="text-sm text-slate-400 line-clamp-2 mb-3">{content.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {content.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
              {tag}
            </span>
          ))}
          {content.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-slate-500">+{content.tags.length - 3}</span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
          <span>{content.lines} lines</span>
          <span>{content.components.length} components</span>
        </div>
      </div>
    </div>
  );
}
