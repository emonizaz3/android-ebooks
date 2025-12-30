import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Heart, Play } from 'lucide-react-native';
import { Book } from '../db/database';

interface BookCardProps {
    book: Book;
    onSelect: (book: Book) => void;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 columns with padding (estimated)

export const BookCard: React.FC<BookCardProps> = ({
    book,
    onSelect,
    isFavorite,
    onToggleFavorite
}) => {
    return (
        <TouchableOpacity
            onPress={() => onSelect(book)}
            style={styles.card}
        >
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: book.cover_url }}
                    style={styles.image}
                    resizeMode="cover"
                />

                {book.cover_url?.includes('picsum.photos') && (
                    <View style={styles.overlay}>
                        <Text style={styles.overlayTitle} numberOfLines={4}>
                            {book.title}
                        </Text>
                    </View>
                )}

                <View style={styles.actions}>
                    <TouchableOpacity
                        onPress={(e) => {
                            // In React Native, TouchableOpacity doesn't have stopPropagation in onPress
                            // But nested Touchables usually handle it correctly if handled right.
                            onToggleFavorite?.();
                        }}
                        style={[styles.actionButton, isFavorite && styles.favoriteActive]}
                    >
                        <Heart size={16} color={isFavorite ? '#fff' : '#000'} fill={isFavorite ? '#fff' : 'none'} />
                    </TouchableOpacity>
                </View>

                <View style={styles.playButton}>
                    <Play size={16} color="#000" fill="#000" />
                </View>
            </View>

            <View style={styles.details}>
                <Text style={styles.title} numberOfLines={2}>
                    {book.title}
                </Text>
                <Text style={styles.author} numberOfLines={1}>
                    {book.author}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: cardWidth,
        marginBottom: 16,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 2 / 3,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    overlayTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        fontFamily: 'System', // Will update later with custom font
    },
    actions: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    favoriteActive: {
        backgroundColor: '#ef4444',
    },
    playButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    details: {
        marginTop: 8,
        gap: 4,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#000',
    },
    author: {
        fontSize: 10,
        fontWeight: '500',
        color: 'rgba(0,0,0,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
