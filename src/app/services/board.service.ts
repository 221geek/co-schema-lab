import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, map, switchMap, shareReplay, catchError, of } from 'rxjs';
import type { User } from 'firebase/auth';

export interface PresenceUser {
  userId: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
  lastSeen: unknown;
  cursorX?: number;
  cursorY?: number;
}
import { authState } from '@angular/fire/auth';
import { filter, take } from 'rxjs/operators';
import { Board, BoardData } from '../models/board.model';

const BOARDS_COLLECTION = 'boards';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  private get boardsCollection() {
    return collection(this.firestore, BOARDS_COLLECTION);
  }

  private get currentUserId$() {
    return authState(this.auth).pipe(
      filter((u): u is NonNullable<typeof u> => !!u),
      take(1),
      map((u) => u.uid)
    );
  }

  getBoards(): Observable<Board[]> {
    return this.currentUserId$.pipe(
      switchMap((userId) => {
        const q = query(this.boardsCollection, where('users', 'array-contains', userId));
        return new Observable<Board[]>((sub) => {
          const unsub = onSnapshot(
            q,
            (snap) => {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Board & { id: string }));
              sub.next(list);
            },
            (err) => {
              console.error('getBoards Firestore error:', err);
              sub.next([]);
            }
          );
          return () => unsub();
        });
      }),
      map((boards) => {
        const list = boards as (Board & { id: string })[];
        return list.sort((a, b) => {
          const toDate = (v: unknown) =>
            v && typeof (v as { toDate?: () => Date }).toDate === 'function'
              ? (v as { toDate: () => Date }).toDate()
              : v instanceof Date ? v : new Date(0);
          return toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime();
        });
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getBoard(id: string): Observable<Board | null> {
    const docRef = doc(this.firestore, BOARDS_COLLECTION, id);
    return from(getDoc(docRef)).pipe(
      map((snap) => {
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Board;
      })
    );
  }

  /**
   * Abonnement temps réel aux modifications du board.
   * Retourne une fonction pour se désabonner.
   */
  subscribeToBoard(
    id: string,
    onData: (board: Board | null) => void,
    onError?: (err: Error) => void
  ): () => void {
    const docRef = doc(this.firestore, BOARDS_COLLECTION, id);
    return onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          onData(null);
          return;
        }
        onData({ id: snap.id, ...snap.data() } as Board);
      },
      (err) => {
        onError?.(err);
      }
    );
  }

  createBoard(name: string, data?: Partial<BoardData>): Observable<string> {
    return this.currentUserId$.pipe(
      switchMap((userId) => {
        const now = new Date();
        const board = {
          name: name || 'Nouveau board',
          users: [userId],
          tables: data?.tables ?? [{
            id: 'table-1',
            name: 'NewTable',
            x: 100,
            y: 100,
            icon: 'solar:widget-add-linear',
            fields: [{ id: 'f-1', name: 'id', type: 'string', isPrimary: true }]
          }],
          relationships: data?.relationships ?? [],
          enums: data?.enums ?? [],
          createdAt: now,
          updatedAt: now,
          createdBy: userId
        };
        return from(addDoc(this.boardsCollection, board)).pipe(
          map((ref) => ref.id)
        );
      })
    );
  }

  updateBoard(id: string, data: Partial<BoardData> & { name?: string; users?: string[] }): Observable<void> {
    return this.currentUserId$.pipe(
      switchMap(() => {
        const docRef = doc(this.firestore, BOARDS_COLLECTION, id);
        return from(updateDoc(docRef, { ...data, updatedAt: new Date() }));
      })
    );
  }

  addUserToBoard(boardId: string, userId: string): Observable<void> {
    return this.getBoard(boardId).pipe(
      switchMap((board) => {
        if (!board) throw new Error('Board not found');
        const users = [...(board.users || []), userId];
        const uniqueUsers = [...new Set(users)];
        return this.updateBoard(boardId, { users: uniqueUsers });
      })
    );
  }

  /** Permet à l'utilisateur connecté de rejoindre un board via un lien partagé. */
  joinBoard(boardId: string): Observable<void> {
    return this.currentUserId$.pipe(
      switchMap((userId) => {
        const docRef = doc(this.firestore, BOARDS_COLLECTION, boardId);
        return from(updateDoc(docRef, {
          users: arrayUnion(userId),
          updatedAt: serverTimestamp()
        }));
      })
    );
  }

  deleteBoard(id: string): Observable<void> {
    return this.currentUserId$.pipe(
      switchMap(() => {
        const docRef = doc(this.firestore, BOARDS_COLLECTION, id);
        return from(deleteDoc(docRef));
      })
    );
  }

  joinPresence(boardId: string, user: User): { leave: () => void; updateCursor: (x: number, y: number) => void } {
    const presenceRef = doc(this.firestore, BOARDS_COLLECTION, boardId, 'presence', user.uid);
    const data = {
      userId: user.uid,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      email: user.email ?? null,
      lastSeen: serverTimestamp()
    };
    setDoc(presenceRef, data).catch((err) => console.error('joinPresence error:', err));
    const heartbeat = setInterval(() => {
      updateDoc(presenceRef, { lastSeen: serverTimestamp() }).catch(() => {});
    }, 30000);

    let lastCursorUpdate = 0;
    const CURSOR_THROTTLE_MS = 100;
    const updateCursor = (x: number, y: number) => {
      const now = Date.now();
      if (now - lastCursorUpdate < CURSOR_THROTTLE_MS) return;
      lastCursorUpdate = now;
      updateDoc(presenceRef, { cursorX: x, cursorY: y, lastSeen: serverTimestamp() }).catch(() => {});
    };

    return {
      leave: () => {
        clearInterval(heartbeat);
        deleteDoc(presenceRef).catch(() => {});
      },
      updateCursor
    };
  }

  getConnectedUsers(boardId: string, callback: (users: PresenceUser[]) => void): () => void {
    const presenceCol = collection(this.firestore, BOARDS_COLLECTION, boardId, 'presence');
    const STALE_MS = 60000;
    const unsubscribe = onSnapshot(
      presenceCol,
      (snap) => {
        const now = Date.now();
        const users = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as PresenceUser & { id: string }))
          .filter((u) => {
            const lastSeen = u.lastSeen;
            let ts = 0;
            if (lastSeen) {
              if (typeof (lastSeen as { toMillis?: () => number }).toMillis === 'function') {
                ts = (lastSeen as { toMillis: () => number }).toMillis();
              } else if (lastSeen instanceof Date) {
                ts = lastSeen.getTime();
              } else if (typeof (lastSeen as { seconds?: number })?.seconds === 'number') {
                ts = (lastSeen as { seconds: number }).seconds * 1000;
              }
            }
            return ts === 0 || now - ts < STALE_MS;
          })
          .map(({ id, ...u }) => ({ ...u, userId: id }));
        callback(users);
      },
      (err) => console.error('Presence snapshot error:', err)
    );
    return unsubscribe;
  }
}
