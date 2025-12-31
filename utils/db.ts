
import { SongInfo } from '../types';

// Basit bir IndexedDB sarmalayıcısı
const DB_NAME = 'ParticleMusicDB';
const STORE_IMAGES = 'SongImages';
const STORE_LYRICS = 'SongLyrics';
const STORE_INFO = 'SongInfo';
const STORE_FACE = 'UserFaceData'; // YENİ: Yüz Verisi Deposu
const DB_VERSION = 4; // Versiyon yükseltildi (FaceData eklendi)

export const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Görsel Deposu
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                db.createObjectStore(STORE_IMAGES); 
            }

            // Sözler Deposu
            if (!db.objectStoreNames.contains(STORE_LYRICS)) {
                db.createObjectStore(STORE_LYRICS);
            }

            // Bilgi Deposu
            if (!db.objectStoreNames.contains(STORE_INFO)) {
                db.createObjectStore(STORE_INFO);
            }

            // Yüz Verisi Deposu (YENİ)
            if (!db.objectStoreNames.contains(STORE_FACE)) {
                db.createObjectStore(STORE_FACE);
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

export const saveSongImages = async (songTitle: string, images: string[]) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        store.put(images, songTitle);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(undefined);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Görsel kaydedilemedi:", e);
    }
};

export const getSongImages = async (songTitle: string): Promise<string[] | undefined> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const request = store.get(songTitle);

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        });
    } catch (e) {
        console.error("Görsel çekilemedi:", e);
        return undefined;
    }
};

export const saveSongLyrics = async (songTitle: string, lyricsData: any[]) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_LYRICS, 'readwrite');
        const store = tx.objectStore(STORE_LYRICS);
        store.put(lyricsData, songTitle);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(undefined);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Sözler kaydedilemedi:", e);
    }
};

export const getSongLyrics = async (songTitle: string): Promise<any[] | undefined> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_LYRICS, 'readonly');
        const store = tx.objectStore(STORE_LYRICS);
        const request = store.get(songTitle);

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        });
    } catch (e) {
        console.error("Sözler çekilemedi:", e);
        return undefined;
    }
};

// --- INFO İŞLEMLERİ ---

export const saveSongInfo = async (songTitle: string, info: SongInfo) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_INFO, 'readwrite');
        const store = tx.objectStore(STORE_INFO);
        store.put(info, songTitle);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(undefined);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Bilgi kaydedilemedi:", e);
    }
};

export const getSongInfo = async (songTitle: string): Promise<SongInfo | undefined> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_INFO, 'readonly');
        const store = tx.objectStore(STORE_INFO);
        const request = store.get(songTitle);

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        });
    } catch (e) {
        console.error("Bilgi çekilemedi:", e);
        return undefined;
    }
};

// --- YÜZ VERİSİ İŞLEMLERİ (YENİ) ---

// Float32Array verisini kaydet
export const saveFaceDescriptor = async (descriptor: Float32Array) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FACE, 'readwrite');
        const store = tx.objectStore(STORE_FACE);
        // Tek kullanıcı varsayıyoruz, anahtar 'currentUser'
        store.put(descriptor, 'currentUser');
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Yüz verisi kaydedilemedi:", e);
        throw e;
    }
};

// Yüz verisini getir
export const getFaceDescriptor = async (): Promise<Float32Array | undefined> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_FACE, 'readonly');
        const store = tx.objectStore(STORE_FACE);
        const request = store.get('currentUser');

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        });
    } catch (e) {
        console.error("Yüz verisi çekilemedi:", e);
        return undefined;
    }
};
