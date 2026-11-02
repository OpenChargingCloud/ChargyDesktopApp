import { hash, toHex } from '@open-charging-cloud/wwcp-poi';

export const sessionEvidenceDatabaseName = 'ChargySessionEvidence';
export interface StoredSessionEvidence {
    readonly id: string;
    readonly anchorPolicyId: string;
    readonly evseId: string;
    readonly sessionId: string;
    readonly document: string;
    /** Audit information only. Import/reopen never applies it as current trust. */
    readonly policySnapshot: string;
    readonly savedAt: string;
}
export function sessionEvidenceId(record: Omit<StoredSessionEvidence, 'id' | 'savedAt'>): string {
    return toHex(hash('sha256', new TextEncoder().encode(JSON.stringify({ anchorPolicyId: record.anchorPolicyId,
        evseId: record.evseId, sessionId: record.sessionId, document: record.document, policySnapshot: record.policySnapshot }))));
}
export function readStoredSessionEvidence(value: unknown): StoredSessionEvidence {
    if (value === null || typeof value !== 'object') throw new Error('Invalid archived evidence');
    const raw = value as Record<string, unknown>;
    for (const key of ['id', 'anchorPolicyId', 'evseId', 'sessionId', 'document', 'policySnapshot', 'savedAt'])
        if (typeof raw[key] !== 'string') throw new Error('Invalid archived evidence field');
    const record = raw as unknown as StoredSessionEvidence;
    if (!Number.isFinite(Date.parse(record.savedAt)) || new TextEncoder().encode(record.document).length > 16 * 1024 * 1024 ||
        record.policySnapshot.length > 2 * 1024 * 1024 || sessionEvidenceId(record) !== record.id)
        throw new Error('Archived evidence content does not match its identity');
    return record;
}

/** Original session exports and immutable evidence, independent of the disposable station-proof cache. No green flags. */
export class SessionEvidenceStore {
    private connection: Promise<IDBDatabase> | null = null;
    private async open(): Promise<IDBDatabase> {
        this.connection ??= new Promise<IDBDatabase>((resolve,reject) => {
            let blocked = false;
            const request = indexedDB.open(sessionEvidenceDatabaseName,1);
            request.onupgradeneeded = (): void => { request.result.createObjectStore('sessions',{ keyPath:'id' }); };
            request.onerror = (): void => { reject(request.error ?? new Error('Evidence storage unavailable')); };
            request.onblocked = (): void => { blocked = true; reject(new Error('Evidence storage blocked')); };
            request.onsuccess = (): void => {
                const db = request.result;
                if (blocked) { db.close(); return; }
                db.onversionchange = (): void => { db.close(); this.connection = null; };
                db.onclose = (): void => { this.connection = null; };
                resolve(db);
            };
        }).catch((error: unknown) => { this.connection = null; throw error; });
        return this.connection;
    }
    private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>, signal?: AbortSignal): Promise<T> {
        const db = await this.open(); signal?.throwIfAborted();
        return new Promise<T>((resolve,reject) => {
            const tx = db.transaction('sessions',mode);
            const abort = (): void => { try { tx.abort(); } catch { /* Already finished. */ } };
            signal?.addEventListener('abort',abort,{once:true});
            let request: IDBRequest<T>;
            try { request = action(tx.objectStore('sessions')); }
            catch (error) { signal?.removeEventListener('abort',abort); tx.abort(); reject(error instanceof Error ? error : new Error('Evidence operation failed')); return; }
            const done = (): void => { signal?.removeEventListener('abort',abort); };
            tx.oncomplete = (): void => { done(); resolve(request.result); };
            tx.onabort = (): void => { done(); reject(tx.error ?? new Error('Evidence operation aborted')); };
            tx.onerror = (): void => { done(); reject(tx.error ?? new Error('Evidence operation failed')); };
        });
    }
    public async save(input: Omit<StoredSessionEvidence,'id'|'savedAt'>, signal?: AbortSignal): Promise<string> {
        const id = sessionEvidenceId(input);
        const record = readStoredSessionEvidence({ ...input,id,savedAt:new Date().toISOString() });
        await this.run('readwrite', store => store.put(record),signal); return id;
    }
    public async list(): Promise<readonly StoredSessionEvidence[]> {
        const values = await this.run<unknown[]>('readonly',store => store.getAll());
        return values.map(readStoredSessionEvidence).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
    }
    public async delete(id: string): Promise<void> { await this.run('readwrite',store => store.delete(id)); }
}
