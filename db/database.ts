import * as SQLite from 'expo-sqlite';
import { documentDirectory, makeDirectoryAsync, getInfoAsync, copyAsync } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

const DB_NAME = 'books.db';

export interface Book {
    book_id: number;
    title: string;
    author: string;
    cover_url: string;
}

export interface Chapter {
    chapter_id: number;
    book_id: number;
    chapter_number: number;
    title: string;
    body_text: string;
}

export interface Author {
    author: string;
    book_count: number;
}

/**
 * Checks if the database already exists in the app's internal storage.
 * Returns true if it exists, false otherwise.
 */
export async function checkDatabaseExists(): Promise<boolean> {
    if (!documentDirectory) return false;
    const dbPath = `${documentDirectory}SQLite/${DB_NAME}`;
    const info = await getInfoAsync(dbPath);
    return info.exists;
}

/**
 * Allows the user to select a books.db file from their device and copies it to internal storage.
 */
export async function importDatabase() {
    if (!documentDirectory) throw new Error("Document directory not available");

    const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Ideally 'application/x-sqlite3' but many systems don't label it correctly
        copyToCacheDirectory: true
    });

    if (result.canceled) return false;

    const selectedFile = result.assets[0];
    const dbDir = `${documentDirectory}SQLite/`;
    const dbPath = `${dbDir}${DB_NAME}`;

    // Close existing connection before swapping files
    await closeDatabaseConnection();

    await makeDirectoryAsync(dbDir, { intermediates: true });
    await copyAsync({
        from: selectedFile.uri,
        to: dbPath
    });

    return true;
}

export async function initDatabase() {
    // This is now called after pick to ensure DB is there
    const exists = await checkDatabaseExists();
    if (!exists) {
        throw new Error("DATABASE_MISSING");
    }
}

let _dbInstance: SQLite.SQLiteDatabase | null = null;

export async function closeDatabaseConnection() {
    if (_dbInstance) {
        await _dbInstance.closeAsync();
        _dbInstance = null;
    }
}

async function getDb() {
    if (_dbInstance) return _dbInstance;
    _dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    return _dbInstance;
}

export async function getAllBooks(params: {
    page?: number;
    limit?: number;
    search?: string;
    title?: string;
    author?: string;
    random?: boolean;
    ids?: number[];
}) {
    const db = await getDb();
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let conditions = [];
    let queryParams: any[] = [];

    if (params.search) {
        conditions.push("(title LIKE ? OR author LIKE ?)");
        queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }
    if (params.title) {
        conditions.push("title LIKE ?");
        queryParams.push(`%${params.title}%`);
    }
    if (params.author) {
        conditions.push("author LIKE ?");
        queryParams.push(`%${params.author}%`);
    }
    if (params.ids && params.ids.length > 0) {
        const placeholders = params.ids.map(() => "?").join(",");
        conditions.push(`book_id IN (${placeholders})`);
        queryParams.push(...params.ids);
    }

    let whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM books${whereClause}`;
    const countResult: any = await db.getFirstAsync(countSql, queryParams);
    const total = countResult?.total || 0;

    // Fetch data
    let dataSql = `SELECT book_id, title, author, cover_image FROM books${whereClause}`;
    if (params.random) {
        dataSql += " ORDER BY RANDOM()";
    }
    dataSql += " LIMIT ? OFFSET ?";

    const rows = await db.getAllAsync(dataSql, [...queryParams, limit, offset]);

    const books: Book[] = rows.map((row: any) => {
        let coverUrl = `https://picsum.photos/seed/${row.book_id}/400/600`;
        if (row.cover_image) {
            if (row.cover_image.startsWith('http') || row.cover_image.startsWith('data:')) {
                coverUrl = row.cover_image;
            } else {
                coverUrl = `data:image/jpeg;base64,${row.cover_image}`;
            }
        }
        return {
            book_id: row.book_id,
            title: row.title,
            author: row.author,
            cover_url: coverUrl
        };
    });

    return {
        data: books,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
}

export async function getChaptersByBookId(bookId: number) {
    const db = await getDb();
    const sql = "SELECT chapter_id, book_id, chapter_number, chapter_title, body_text FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC";
    const rows = await db.getAllAsync(sql, [bookId]);

    return rows.map((row: any) => ({
        chapter_id: row.chapter_id,
        book_id: row.book_id,
        chapter_number: row.chapter_number,
        body_text: row.body_text,
        title: row.chapter_title || `Chapter ${row.chapter_number}`
    })) as Chapter[];
}

export async function getAllAuthors() {
    const db = await getDb();
    const sql = "SELECT author, COUNT(*) as book_count FROM books GROUP BY author ORDER BY book_count DESC";
    const rows = await db.getAllAsync(sql, []);
    return rows as Author[];
}
