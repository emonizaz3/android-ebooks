import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
  StatusBar,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, Home, Book as BookIcon, Heart, Bookmark as BookmarkIcon, ChevronLeft, Settings as SettingsIcon, RefreshCcw, FileInput, X } from 'lucide-react-native';
import { useFonts, HindSiliguri_400Regular, HindSiliguri_700Bold } from '@expo-google-fonts/hind-siliguri';
import { NotoSerifBengali_400Regular, NotoSerifBengali_700Bold } from '@expo-google-fonts/noto-serif-bengali';

import { checkDatabaseExists, importDatabase, getAllBooks, getChaptersByBookId, getAllAuthors, Book, Chapter, Author } from './db/database';
import { BookCard } from './components/BookCard';
import { Reader, ReaderSettings } from './components/Reader';

type ViewState = 'home' | 'authors' | 'author_detail' | 'all-books' | 'favorites' | 'bookmarks';
type LibrarySubView = 'books' | 'authors';

export default function App() {
  // Fonts
  let [fontsLoaded] = useFonts({
    HindSiliguri_400Regular,
    HindSiliguri_700Bold,
    NotoSerifBengali_400Regular,
    NotoSerifBengali_700Bold
  });

  const [dbReady, setDbReady] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [books, setBooks] = useState<Book[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('loading');
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Navigation & Filter State
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [librarySubView, setLibrarySubView] = useState<LibrarySubView>('books');
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);

  // Appearance & Global Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    theme: 'light',
    lineHeight: 1.6,
    fontFamily: 'siliguri'
  });

  // Favorites & Bookmarks State
  const [favorites, setFavorites] = useState<number[]>([]);
  const [bookmarks, setBookmarks] = useState<Record<number, number>>({});

  // Init
  useEffect(() => {
    async function init() {
      try {
        const exists = await checkDatabaseExists();
        if (!exists) {
          setDbMissing(true);
          setLoadingState('idle');
          return;
        }

        await runFullInit();
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  async function runFullInit() {
    setLoadingState('loading');
    // Load settings
    const savedSettings = await AsyncStorage.getItem('reader-settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    // Load favorites
    const savedFavs = await AsyncStorage.getItem('favorites');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    // Load bookmarks
    const savedMarks = await AsyncStorage.getItem('bookmarks');
    if (savedMarks) setBookmarks(JSON.parse(savedMarks));

    // Fetch Authors
    const authorList = await getAllAuthors();
    setAuthors(authorList);

    setDbReady(true);
    setDbMissing(false);
  }

  const handleImport = async () => {
    setImporting(true);
    try {
      const success = await importDatabase();
      if (success) {
        await runFullInit();
      }
    } catch (err) {
      console.error("Import failed:", err);
    } finally {
      setImporting(false);
    }
  };

  // Persist State
  useEffect(() => {
    if (dbReady) {
      AsyncStorage.setItem('favorites', JSON.stringify(favorites));
      AsyncStorage.setItem('bookmarks', JSON.stringify(bookmarks));
      AsyncStorage.setItem('reader-settings', JSON.stringify(settings));
    }
  }, [favorites, bookmarks, settings, dbReady]);

  // Reset page to 1 when search or view changes to avoid "disappearing books" bug
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, currentView, selectedAuthor, librarySubView]);

  // Fetch Books
  useEffect(() => {
    if (!dbReady) return;

    setLoadingState('loading');
    const timer = setTimeout(async () => {
      try {
        const filters: any = {};
        if (currentView === 'author_detail' && selectedAuthor) filters.author = selectedAuthor;
        if (currentView === 'home') filters.random = true;
        if (currentView === 'favorites') filters.ids = favorites;
        if (currentView === 'bookmarks') filters.ids = Object.keys(bookmarks).map(Number);

        if ((currentView === 'favorites' && favorites.length === 0) ||
          (currentView === 'bookmarks' && Object.keys(bookmarks).length === 0)) {
          setBooks([]);
          setTotalPages(1);
          setLoadingState('success');
          return;
        }

        const response = await getAllBooks({
          page: currentPage,
          limit: 20,
          search: searchTerm,
          ...filters
        });
        setBooks(response.data);
        setTotalPages(response.pagination.totalPages);
        setLoadingState('success');
      } catch (err) {
        console.error("Fetch books error:", err);
        // Attempt to re-init DB if it looks like a connection issue
        if (err instanceof Error && (err.message.includes('no such table') || err.message.includes('database is closed'))) {
          console.log("Attempting emergency re-init...");
          await runFullInit();
        }
        setLoadingState('error');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentPage, searchTerm, currentView, selectedAuthor, dbReady, favorites, bookmarks]);

  // Handle Book Select
  const handleBookSelect = async (book: Book) => {
    console.log("Selecting book:", book.title, "ID:", book.book_id);
    setSelectedBook(book);
    setLoadingChapters(true);
    try {
      const bookChapters = await getChaptersByBookId(book.book_id);
      console.log("Fetched chapters count:", bookChapters.length);
      setChapters(bookChapters);
      const savedChapter = bookmarks[book.book_id];
      setCurrentChapterIdx(savedChapter !== undefined ? savedChapter : 0);
    } catch (err) {
      console.error("Failed to fetch chapters:", err);
    } finally {
      setLoadingChapters(false);
    }
  };

  const toggleFavorite = (bookId: number) => {
    setFavorites(prev => prev.includes(bookId) ? prev.filter(id => id !== bookId) : [...prev, bookId]);
  };

  const toggleBookmark = (bookId: number, chapterIndex: number) => {
    setBookmarks(prev => {
      const next = { ...prev };
      if (next[bookId] === chapterIndex) {
        delete next[bookId];
      } else {
        next[bookId] = chapterIndex;
      }
      return next;
    });
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 10 }}>Loading assets...</Text>
      </View>
    );
  }

  if (dbMissing) {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>BanglaEbook</Text>
        <Text style={{ marginTop: 20, fontSize: 18, textAlign: 'center', paddingHorizontal: 40 }}>
          Database not found. Please select the books.db file to begin.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 30,
            backgroundColor: '#3b82f6',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 12
          }}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700' }}>Select Database File</Text>
          )}
        </TouchableOpacity>
        <Text style={{ marginTop: 20, color: '#9ca3af', fontSize: 12 }}>
          Note: This app requires books.db for content.
        </Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 10 }}>Setting up library...</Text>
      </View>
    );
  }

  if (selectedBook) {
    return (
      <Reader
        book={selectedBook}
        chapters={chapters}
        currentChapterIndex={currentChapterIdx}
        onNavigate={setCurrentChapterIdx}
        onClose={() => setSelectedBook(null)}
        isLoading={loadingChapters}
        settings={settings}
        onSettingsChange={setSettings}
        isBookmarked={bookmarks[selectedBook.book_id] === currentChapterIdx}
        onToggleBookmark={() => toggleBookmark(selectedBook.book_id, currentChapterIdx)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
      <View style={styles.appHeader}>
        <Text style={styles.logo}>BanglaEbook</Text>
        <View style={styles.searchBar}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search books..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 4 }}>
              <X size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => setIsGlobalSettingsOpen(true)} style={styles.iconButton}>
          <SettingsIcon size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainContent}>
        {currentView === 'home' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Authors</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.authorList}>
              {authors.filter(a => a.author !== 'Unknown').slice(0, 10).map((a, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { setSelectedAuthor(a.author); setCurrentView('author_detail'); }}
                  style={styles.authorItem}
                >
                  <View style={[styles.authorAvatar, { backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }]}>
                    <Image
                      source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(a.author.split(' ').slice(0, 2).join(' '))}&background=random&color=fff&size=200&bold=true&uppercase=false` }}
                      style={[styles.avatarImage, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
                    />
                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>
                      {a.author.trim().charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.authorName} numberOfLines={1}>{a.author}</Text>
                  <Text style={styles.authorSubText}>{a.book_count} Books</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended</Text>
            </View>
          </>
        )}

        {currentView === 'author_detail' && (
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => setCurrentView('home')} style={styles.backButton}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>{selectedAuthor}</Text>
          </View>
        )}

        {currentView === 'favorites' && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Favorites</Text>
          </View>
        )}

        {currentView === 'bookmarks' && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bookmarks</Text>
          </View>
        )}

        {currentView === 'all-books' && (
          <View style={styles.sectionHeader}>
            <View style={styles.headerWithToggle}>
              <Text style={styles.sectionTitle}>Library</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  onPress={() => setLibrarySubView('books')}
                  style={[styles.toggleButton, librarySubView === 'books' && styles.toggleButtonActive]}
                >
                  <Text style={[styles.toggleText, librarySubView === 'books' && styles.toggleTextActive]}>Books</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLibrarySubView('authors')}
                  style={[styles.toggleButton, librarySubView === 'authors' && styles.toggleButtonActive]}
                >
                  <Text style={[styles.toggleText, librarySubView === 'authors' && styles.toggleTextActive]}>Authors</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Book/Author Grid */}
        <View style={styles.bookGrid}>
          {currentView === 'all-books' && librarySubView === 'authors' ? (
            authors.filter(a => a.author !== 'Unknown' && (searchTerm === '' || a.author.toLowerCase().includes(searchTerm.toLowerCase()))).map((a, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setSelectedAuthor(a.author); setCurrentView('author_detail'); }}
                style={styles.authorGridItem}
              >
                <View style={[styles.authorGridAvatar, { backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }]}>
                  <Image
                    source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(a.author.split(' ').slice(0, 2).join(' '))}&background=random&color=fff&size=200&bold=true&uppercase=false` }}
                    style={[styles.avatarImage, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
                  />
                  <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>
                    {a.author.trim().charAt(0)}
                  </Text>
                </View>
                <Text style={styles.authorGridName} numberOfLines={2}>{a.author}</Text>
                <Text style={styles.authorGridSubText}>{a.book_count} Books</Text>
              </TouchableOpacity>
            ))
          ) : (
            books.map(book => (
              <BookCard
                key={book.book_id}
                book={book}
                onSelect={handleBookSelect}
                isFavorite={favorites.includes(book.book_id)}
                onToggleFavorite={() => toggleFavorite(book.book_id)}
              />
            ))
          )}
          {((currentView !== 'all-books' || librarySubView === 'books') && books.length === 0 && loadingState === 'success') && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No books found here.</Text>
              <TouchableOpacity onPress={runFullInit} style={styles.retryButton}>
                <RefreshCcw size={16} color="#3b82f6" />
                <Text style={styles.retryText}>Reload Library</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loadingState === 'error' && (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: '#ef4444' }]}>Error loading books.</Text>
            <TouchableOpacity onPress={runFullInit} style={styles.retryButton}>
              <RefreshCcw size={16} color="#3b82f6" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {loadingState === 'loading' && librarySubView === 'books' && <ActivityIndicator style={{ marginVertical: 20 }} />}

        {/* Pagination - Hide for authors list since it's not paginated in this implementation */}
        {totalPages > 1 && (currentView !== 'all-books' || librarySubView === 'books') && (
          <View style={styles.pagination}>
            <TouchableOpacity disabled={currentPage === 1} onPress={() => setCurrentPage(p => p - 1)}>
              <Text style={[styles.pageNav, currentPage === 1 && styles.disabled]}>←</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>{currentPage} / {totalPages}</Text>
            <TouchableOpacity disabled={currentPage === totalPages} onPress={() => setCurrentPage(p => p + 1)}>
              <Text style={[styles.pageNav, currentPage === totalPages && styles.disabled]}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={() => { setCurrentView('home'); setCurrentPage(1); }} style={styles.navItem}>
          <Home size={24} color={currentView === 'home' ? '#3b82f6' : '#9ca3af'} />
          <Text style={[styles.navText, currentView === 'home' && styles.navTextActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setCurrentView('all-books'); setLibrarySubView('books'); setCurrentPage(1); }} style={styles.navItem}>
          <BookIcon size={24} color={currentView === 'all-books' ? '#3b82f6' : '#9ca3af'} />
          <Text style={[styles.navText, currentView === 'all-books' && styles.navTextActive]}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setCurrentView('favorites'); setCurrentPage(1); }} style={styles.navItem}>
          <Heart size={24} color={currentView === 'favorites' ? '#3b82f6' : '#9ca3af'} />
          <Text style={[styles.navText, currentView === 'favorites' && styles.navTextActive]}>Favs</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setCurrentView('bookmarks'); setCurrentPage(1); }} style={styles.navItem}>
          <BookmarkIcon size={24} color={currentView === 'bookmarks' ? '#3b82f6' : '#9ca3af'} />
          <Text style={[styles.navText, currentView === 'bookmarks' && styles.navTextActive]}>Marks</Text>
        </TouchableOpacity>
      </View>
      {/* Global Settings Modal */}
      <Modal visible={isGlobalSettingsOpen} animationType="fade" transparent={true}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsGlobalSettingsOpen(false)}
        >
          <View style={[styles.settingsPanel, { backgroundColor: '#fff', borderTopColor: '#e5e7eb' }]}>
            <Text style={[styles.modalTitle, { color: '#000', marginBottom: 24 }]}>APP SETTINGS</Text>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsLabel}>DATABASE MANAGEMENT</Text>

              <TouchableOpacity
                style={styles.settingsOption}
                onPress={() => { handleImport(); setIsGlobalSettingsOpen(false); }}
              >
                <View style={styles.optionIconContainer}>
                  <FileInput size={20} color="#3b82f6" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Reselect Database</Text>
                  <Text style={styles.optionSubtitle}>Pick a different books.db file</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsOption}
                onPress={() => { runFullInit(); setIsGlobalSettingsOpen(false); }}
              >
                <View style={styles.optionIconContainer}>
                  <RefreshCcw size={20} color="#10b981" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Refresh Library</Text>
                  <Text style={styles.optionSubtitle}>Reload all books from current DB</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingsSection, { marginTop: 24 }]}>
              <Text style={styles.settingsLabel}>INFO</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>App Name</Text>
                <Text style={styles.infoValue}>BanglaEbook</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Version</Text>
                <Text style={styles.infoValue}>1.2.0</Text>
              </View>
            </View>

            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ fontSize: 12, color: '#9ca3af', fontWeight: '500' }}>Created by emonizaz</Text>
            </View>

            <TouchableOpacity
              style={styles.closeSettingsButton}
              onPress={() => setIsGlobalSettingsOpen(false)}
            >
              <Text style={styles.closeSettingsText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  appHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  logo: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  authorList: {
    paddingLeft: 16,
    marginBottom: 8,
  },
  authorItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 80,
  },
  authorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  authorName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  authorSubText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  bottomNav: {
    height: 60,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  navTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  backButton: {
    padding: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
    gap: 20,
  },
  pageNav: {
    fontSize: 24,
    fontWeight: '700',
  },
  pageInfo: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  settingsPanel: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
  },
  headerWithToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#000',
  },
  authorGridItem: {
    width: (Dimensions.get('window').width || Dimensions.get('window').width - 48) / 3,
    marginBottom: 24,
    alignItems: 'center',
  },
  authorGridAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 8,
  },
  authorGridName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  authorGridSubText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  settingsSection: {
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
    marginBottom: 12,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoKey: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  closeSettingsButton: {
    marginTop: 32,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeSettingsText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  retryButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  retryText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  },
});
