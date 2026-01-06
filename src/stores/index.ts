import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComponentCategory, SortOption, ThemeMode, ViewMode } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// USER PREFERENCES STORE
// ═══════════════════════════════════════════════════════════════════════════

interface UserState {
  theme: ThemeMode;
  viewMode: ViewMode;
  likedItems: string[];
  bookmarkedItems: string[];

  setTheme: (theme: ThemeMode) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleLike: (id: string) => void;
  toggleBookmark: (id: string) => void;
  isLiked: (id: string) => boolean;
  isBookmarked: (id: string) => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      viewMode: 'grid',
      likedItems: [],
      bookmarkedItems: [],

      setTheme: (theme) => set({ theme }),
      setViewMode: (mode) => set({ viewMode: mode }),

      toggleLike: (id) =>
        set((state) => ({
          likedItems: state.likedItems.includes(id)
            ? state.likedItems.filter((i) => i !== id)
            : [...state.likedItems, id],
        })),

      toggleBookmark: (id) =>
        set((state) => ({
          bookmarkedItems: state.bookmarkedItems.includes(id)
            ? state.bookmarkedItems.filter((i) => i !== id)
            : [...state.bookmarkedItems, id],
        })),

      isLiked: (id) => get().likedItems.includes(id),
      isBookmarked: (id) => get().bookmarkedItems.includes(id),
    }),
    {
      name: 'pixijs-store-user',
      partialize: (state) => ({
        theme: state.theme,
        viewMode: state.viewMode,
        likedItems: state.likedItems,
        bookmarkedItems: state.bookmarkedItems,
      }),
    }
  )
);

// ═══════════════════════════════════════════════════════════════════════════
// FILTER STATE STORE
// ═══════════════════════════════════════════════════════════════════════════

interface FilterState {
  search: string;
  category: ComponentCategory | 'all';
  sortBy: SortOption;
  showBookmarksOnly: boolean;
}

interface FilterStoreState extends FilterState {
  setSearch: (search: string) => void;
  setCategory: (category: ComponentCategory | 'all') => void;
  setSortBy: (sortBy: SortOption) => void;
  setShowBookmarksOnly: (show: boolean) => void;
  reset: () => void;
}

const initialFilterState: FilterState = {
  search: '',
  category: 'all',
  sortBy: 'popular',
  showBookmarksOnly: false,
};

export const useFilterStore = create<FilterStoreState>()((set) => ({
  ...initialFilterState,

  setSearch: (search) => set({ search }),
  setCategory: (category) => set({ category }),
  setSortBy: (sortBy) => set({ sortBy }),
  setShowBookmarksOnly: (show) => set({ showBookmarksOnly: show }),
  reset: () => set(initialFilterState),
}));

// ═══════════════════════════════════════════════════════════════════════════
// UI STATE STORE
// ═══════════════════════════════════════════════════════════════════════════

interface UIState {
  selectedContentId: string | null;
  isFiltersOpen: boolean;
  isFullscreen: boolean;
  activeTab: 'demo' | 'code';

  setSelectedContent: (id: string | null) => void;
  setFiltersOpen: (open: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setActiveTab: (tab: 'demo' | 'code') => void;
}

export const useUIStore = create<UIState>()((set) => ({
  selectedContentId: null,
  isFiltersOpen: false,
  isFullscreen: false,
  activeTab: 'demo',

  setSelectedContent: (id) => set({ selectedContentId: id, activeTab: 'demo' }),
  setFiltersOpen: (open) => set({ isFiltersOpen: open }),
  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
