import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    ActivityIndicator,
    Modal,
    FlatList,
    BackHandler,
    StatusBar
} from 'react-native';
import { ChevronLeft, Menu, Settings, Bookmark, ChevronRight } from 'lucide-react-native';
import { Book, Chapter } from '../db/database';

export interface ReaderSettings {
    theme: 'light' | 'sepia' | 'dark' | 'navy';
    fontSize: number;
    fontFamily: 'siliguri' | 'noto' | 'tiro';
    lineHeight: number;
}

interface ReaderProps {
    book: Book;
    chapters: Chapter[];
    currentChapterIndex: number;
    onNavigate: (index: number) => void;
    onClose: () => void;
    isLoading?: boolean;
    settings: ReaderSettings;
    onSettingsChange: (settings: ReaderSettings) => void;
    isBookmarked: boolean;
    onToggleBookmark: () => void;
}

const { width } = Dimensions.get('window');

export const Reader: React.FC<ReaderProps> = ({
    book,
    chapters,
    currentChapterIndex,
    onNavigate,
    onClose,
    isLoading,
    settings,
    onSettingsChange,
    isBookmarked,
    onToggleBookmark
}) => {
    const [isTocOpen, setIsTocOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [currentChapterIndex]);

    useEffect(() => {
        const backAction = () => {
            onClose();
            return true;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [onClose]);

    const chapter = chapters[currentChapterIndex];
    const hasPrev = currentChapterIndex > 0;
    const hasNext = currentChapterIndex < chapters.length - 1;

    const themeStyles = {
        light: { bg: '#ffffff', text: '#111827', border: 'rgba(0,0,0,0.05)', header: 'rgba(255,255,255,0.8)' },
        sepia: { bg: '#f4ecd8', text: '#5b4636', border: 'rgba(91,70,54,0.1)', header: 'rgba(244,236,216,0.8)' },
        dark: { bg: '#111827', text: '#e5e7eb', border: 'rgba(255,255,255,0.1)', header: 'rgba(17,24,39,0.8)' },
        navy: { bg: '#0f111a', text: '#c5c6c7', border: 'rgba(197,198,199,0.1)', header: 'rgba(15,17,26,0.8)' }
    };

    const currentTheme = themeStyles[settings.theme];

    if (isLoading) {
        return (
            <View style={[styles.center, { backgroundColor: currentTheme.bg }]}>
                <ActivityIndicator size="large" color={currentTheme.text} />
                <Text style={[styles.loadingText, { color: currentTheme.text }]}>Loading Chapter...</Text>
            </View>
        );
    }

    if (!chapter) {
        return (
            <View style={[styles.center, { backgroundColor: currentTheme.bg, padding: 20 }]}>
                <Text style={[styles.noContentTitle, { color: currentTheme.text }]}>No Content Available</Text>
                <Text style={[styles.noContentText, { color: currentTheme.text }]}>We couldn't find any chapters for "{book.title}".</Text>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.bg }]}>
            <StatusBar hidden={true} />
            {/* Header */}
            <View style={[styles.header, { backgroundColor: currentTheme.header, borderBottomColor: currentTheme.border }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                        <ChevronLeft size={24} color={currentTheme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerBookTitle, { color: currentTheme.text }]} numberOfLines={1}>{book.title}</Text>
                        <Text style={[styles.headerChapterTitle, { color: currentTheme.text, opacity: 0.6 }]} numberOfLines={1}>
                            Chapter {chapter.chapter_number}: {chapter.title}
                        </Text>
                    </View>
                </View>

                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => setIsTocOpen(true)} style={styles.iconButton}>
                        <Menu size={24} color={currentTheme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onToggleBookmark} style={[styles.iconButton, isBookmarked && styles.activeBookmark]}>
                        <Bookmark size={24} color={isBookmarked ? '#fff' : currentTheme.text} fill={isBookmarked ? '#fff' : 'none'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconButton}>
                        <Settings size={24} color={currentTheme.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scrollContent}
            >
                <View>
                    <Text style={[
                        styles.chapterTitle,
                        { color: currentTheme.text, fontSize: 32 }
                    ]}>
                        {chapter.title || `Chapter ${chapter.chapter_number}`}
                    </Text>

                    <Text style={[
                        styles.bodyText,
                        {
                            color: currentTheme.text,
                            fontSize: settings.fontSize,
                            lineHeight: settings.fontSize * settings.lineHeight
                        }
                    ]}>
                        {chapter.body_text}
                    </Text>
                </View>

                {/* Navigation */}
                <View style={[styles.navContainer, { borderTopColor: currentTheme.border }]}>
                    <TouchableOpacity
                        disabled={!hasPrev}
                        onPress={() => onNavigate(currentChapterIndex - 1)}
                        style={[styles.navButton, !hasPrev && styles.navButtonDisabled, { backgroundColor: settings.theme === 'light' ? '#000' : '#fff' }]}
                    >
                        <ChevronLeft size={20} color={settings.theme === 'light' ? '#fff' : '#000'} />
                        <Text style={[styles.navButtonText, { color: settings.theme === 'light' ? '#fff' : '#000' }]}>Prev</Text>
                    </TouchableOpacity>

                    <View style={styles.progressContainer}>
                        <Text style={[styles.progressLabel, { color: currentTheme.text, opacity: 0.3 }]}>PROGRESS</Text>
                        <Text style={[styles.progressNumber, { color: currentTheme.text }]}>
                            {currentChapterIndex + 1} / {chapters.length}
                        </Text>
                    </View>

                    <TouchableOpacity
                        disabled={!hasNext}
                        onPress={() => onNavigate(currentChapterIndex + 1)}
                        style={[styles.navButton, !hasNext && styles.navButtonDisabled, { backgroundColor: settings.theme === 'light' ? '#000' : '#fff' }]}
                    >
                        <Text style={[styles.navButtonText, { color: settings.theme === 'light' ? '#fff' : '#000' }]}>Next</Text>
                        <ChevronRight size={20} color={settings.theme === 'light' ? '#fff' : '#000'} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* TOC Modal */}
            <Modal visible={isTocOpen} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: currentTheme.bg }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: currentTheme.border }]}>
                            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>CHAPTERS</Text>
                            <TouchableOpacity onPress={() => setIsTocOpen(false)}>
                                <Text style={{ color: currentTheme.text, opacity: 0.4 }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={chapters}
                            keyExtractor={(item) => item.chapter_id.toString()}
                            renderItem={({ item, index }) => (
                                <TouchableOpacity
                                    onPress={() => { onNavigate(index); setIsTocOpen(false); }}
                                    style={[
                                        styles.tocItem,
                                        index === currentChapterIndex && [styles.tocItemActive, { backgroundColor: settings.theme === 'light' ? '#000' : 'rgba(255,255,255,0.1)' }]
                                    ]}
                                >
                                    <Text style={[
                                        styles.tocText,
                                        { color: index === currentChapterIndex ? '#fff' : currentTheme.text }
                                    ]}>
                                        {item.chapter_number}. {item.title}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal visible={isSettingsOpen} animationType="fade" transparent={true}>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsSettingsOpen(false)}
                >
                    <View style={[styles.settingsPanel, { backgroundColor: currentTheme.bg, borderTopColor: currentTheme.border }]}>
                        <Text style={[styles.modalTitle, { color: currentTheme.text, marginBottom: 16 }]}>APPEARANCE</Text>

                        <Text style={[styles.label, { color: currentTheme.text }]}>THEME</Text>
                        <View style={styles.themeRow}>
                            {(['light', 'sepia', 'dark', 'navy'] as const).map(t => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => onSettingsChange({ ...settings, theme: t })}
                                    style={[
                                        styles.themeButton,
                                        { backgroundColor: themeStyles[t].bg, borderColor: settings.theme === t ? '#3b82f6' : 'rgba(0,0,0,0.1)' },
                                        settings.theme === t && styles.themeButtonActive
                                    ]}
                                />
                            ))}
                        </View>

                        <Text style={[styles.label, { color: currentTheme.text, marginTop: 16 }]}>FONT SIZE</Text>
                        <View style={styles.fontSizeRow}>
                            <TouchableOpacity
                                onPress={() => onSettingsChange({ ...settings, fontSize: settings.fontSize - 2 })}
                                style={[styles.sizeButton, { backgroundColor: currentTheme.border }]}
                            >
                                <Text style={{ color: currentTheme.text, fontSize: 18 }}>-</Text>
                            </TouchableOpacity>
                            <Text style={[styles.fontSizeText, { color: currentTheme.text }]}>{settings.fontSize}</Text>
                            <TouchableOpacity
                                onPress={() => onSettingsChange({ ...settings, fontSize: settings.fontSize + 2 })}
                                style={[styles.sizeButton, { backgroundColor: currentTheme.border }]}
                            >
                                <Text style={{ color: currentTheme.text, fontSize: 18 }}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
    },
    noContentTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    noContentText: {
        fontSize: 16,
        opacity: 0.6,
        textAlign: 'center',
        marginBottom: 24,
    },
    backButton: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: '#000',
        borderRadius: 12,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    header: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerTitleContainer: {
        marginLeft: 8,
        flex: 1,
    },
    headerBookTitle: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'System',
    },
    headerChapterTitle: {
        fontSize: 10,
        fontFamily: 'System',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        padding: 8,
        borderRadius: 12,
    },
    activeBookmark: {
        backgroundColor: '#3b82f6',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 60,
    },
    chapterTitle: {
        fontWeight: '700',
        marginBottom: 24,
        fontFamily: 'System',
    },
    bodyText: {
        fontWeight: '400',
        fontFamily: 'System',
    },
    navContainer: {
        marginTop: 40,
        paddingTop: 24,
        borderTopWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        gap: 8,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontWeight: '700',
    },
    progressContainer: {
        alignItems: 'center',
    },
    progressLabel: {
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1,
    },
    progressNumber: {
        fontSize: 12,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '70%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottomWidth: 1,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    tocItem: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    tocItemActive: {
    },
    tocText: {
        fontSize: 14,
        fontWeight: '600',
    },
    settingsPanel: {
        padding: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: 1,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    themeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    themeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
    },
    themeButtonActive: {
    },
    fontSizeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    sizeButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fontSizeText: {
        fontSize: 18,
        fontWeight: '700',
    }
});
