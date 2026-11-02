import { TrustAnchor, hash, toHex,trustPolicyId } from '@open-charging-cloud/wwcp-poi';
import type { POIPublicKey } from '@open-charging-cloud/wwcp-poi';
import type { StoredTrustAnchorData } from './trustAnchorData';
import type { LoadedStationProof } from './stationProofData';
import { stationEVSEId, stationProofURL } from './poiURLs';

export const trustDatabaseName = "ChargyTrustManagement";
const anchorsStore = "trustAnchors";
const deletedKeysStore = "deletedBundledKeys";
const stationProofsStore = "poiStationProofs";

/** Original cached evidence and provenance; no persisted authorization verdict. */
export interface StoredStationProof {
    readonly effectiveAnchorQRCode?:string;
    readonly origin?: 'embedded';
    readonly id: string;
    readonly anchorPolicyId: string;
    readonly anchorQRCode: string;
    readonly evseId: string;
    readonly sourceURL: string;
    readonly downloadedAt: string;
    readonly checkedAt: string;
    readonly text: string;
}

export function stationProofStorageId(policyId: string, evseId: string, text: string): string {
    const documentHash = toHex(hash('sha256', new TextEncoder().encode(text)));
    return toHex(hash('sha256', new TextEncoder().encode(JSON.stringify({ policyId, evseId, documentHash }))));
}

function proofPolicyRange(policyId: string): IDBKeyRange {
    return IDBKeyRange.bound([policyId, ''], [policyId, '\uffff', '\uffff']);
}

function deletePolicyProofs(transaction: IDBTransaction, policyId: string): void {
    const request = transaction.objectStore(stationProofsStore).index('byPolicyTime').openCursor(proofPolicyRange(policyId));
    request.onsuccess = (): void => { const cursor = request.result; if (cursor !== null) { cursor.delete(); cursor.continue(); } };
}

export interface StoredTrustAnchor {
    /** Explicitly accepted original delegation evidence, reverified under current local roots on each operation. */
    readonly transitions?:readonly {readonly text:string;readonly acceptedAt:string}[];
    readonly id: string;
    readonly qrCode: string;
    readonly sourceText: string;
    readonly importedAt: string;
    /** Explicit local decisions, scoped to this exact anchor policy, never global roots. */
    readonly trustedKeys?: readonly ManuallyTrustedKey[];
    readonly downloadedData?: StoredTrustAnchorData;
}

export interface ManuallyTrustedKey {
    readonly id: string;
    readonly acceptedAt: string;
}

/** Names/descriptions do not create duplicates between compact and URL forms. */
export function trustAnchorStorageId(anchor: TrustAnchor): string {
    return trustPolicyId(anchor);
}

function object(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid trust management record");
    return value as Record<string, unknown>;
}

function readAnchor(value: unknown): StoredTrustAnchor {
    const record = object(value);
    if (typeof record["id"] !== "string" || typeof record["qrCode"] !== "string" ||
        typeof record["sourceText"] !== "string" || typeof record["importedAt"] !== "string" ||
        !Number.isFinite(Date.parse(record["importedAt"])))
        throw new Error("Invalid stored trust anchor");
    const anchor = TrustAnchor.parse(record["qrCode"]);
    if (trustAnchorStorageId(anchor) !== record["id"])
        throw new Error("Stored trust anchor identity does not match its content");
    const trustedKeys: ManuallyTrustedKey[] = [];
    if (record["trustedKeys"] !== undefined) {
        if (!Array.isArray(record["trustedKeys"]))
            throw new Error("Invalid manual key trust");
        for (const entry of record["trustedKeys"]) {
            const key = object(entry);
            if (typeof key["id"] !== "string" || !anchor.keys.includes(key["id"]) ||
                typeof key["acceptedAt"] !== "string" || !Number.isFinite(Date.parse(key["acceptedAt"])) ||
                trustedKeys.some(existing => existing.id === key["id"]))
                throw new Error("Invalid manual key trust");
            trustedKeys.push({ id: key["id"], acceptedAt: key["acceptedAt"] });
        }
    }
    let downloadedData: StoredTrustAnchorData | undefined;
    if (record["downloadedData"] !== undefined) {
        const data = object(record["downloadedData"]);
        if (typeof data["sourceURL"] !== "string" || typeof data["text"] !== "string" ||
            typeof data["downloadedAt"] !== "string" || !Number.isFinite(Date.parse(data["downloadedAt"])))
            throw new Error("Invalid downloaded trust anchor data");
        if (data['origin'] !== undefined && data['origin'] !== 'embedded')
            throw new Error('Invalid KeyStatement origin');
        downloadedData = { sourceURL: data["sourceURL"], text: data["text"], downloadedAt: data["downloadedAt"],
            ...(data['origin'] === 'embedded' ? { origin: 'embedded' as const } : {}) };
    }
    const transitions=record['transitions'];
    if(transitions!==undefined&&(!Array.isArray(transitions)||transitions.length>32||new TextEncoder().encode(JSON.stringify(transitions)).length>8*1024*1024||transitions.some(value=>{
        const item=object(value);return typeof item['text']!=='string'||typeof item['acceptedAt']!=='string'||!Number.isFinite(Date.parse(item['acceptedAt']));
    })))throw new Error('Invalid stored trust transitions');
    return { id: record["id"], qrCode: record["qrCode"], sourceText: record["sourceText"], importedAt: record["importedAt"], trustedKeys,
             ...(transitions===undefined?{}:{transitions:transitions as {text:string;acceptedAt:string}[]}),
             ...(downloadedData === undefined ? {} : { downloadedData }) };
}

function readStationProof(value: unknown): StoredStationProof {
    const raw = object(value);
    const fields = ['id', 'anchorPolicyId', 'anchorQRCode', 'evseId', 'sourceURL', 'downloadedAt', 'checkedAt', 'text'] as const;
    for (const field of fields)
        if (typeof raw[field] !== 'string')
            throw new Error('Invalid saved station proof');
    const record = raw as unknown as StoredStationProof;
    if (raw['origin'] !== undefined && raw['origin'] !== 'embedded')
        throw new Error('Invalid station proof origin');
    const anchor = TrustAnchor.parse(record.anchorQRCode);
    const effective=record.effectiveAnchorQRCode===undefined?anchor:TrustAnchor.parse(record.effectiveAnchorQRCode);
    if (trustAnchorStorageId(anchor) !== record.anchorPolicyId || stationEVSEId(record.evseId) !== record.evseId ||
        (record.origin === undefined ? !effective.urls.some(base => stationProofURL(base, record.evseId) === record.sourceURL)
            : !record.sourceURL.startsWith('input:')) ||
        !Number.isFinite(Date.parse(record.downloadedAt)) || !Number.isFinite(Date.parse(record.checkedAt)) ||
        stationProofStorageId(record.anchorPolicyId, record.evseId, record.text) !== record.id)
        throw new Error('Saved station proof provenance does not match its content');
    return record;
}

/** Version 2 adds a proof cache, retaining the version-1 anchors and local decisions. */
export class TrustStore {
    /** Compare the complete reviewed policy and exclusions in the same transaction; concurrent decisions cannot be overwritten. */
    public async appendTrustTransition(expected:StoredTrustAnchor,expectedDeleted:ReadonlySet<string>,text:string,acceptedAt:string,
        validate:(record:StoredTrustAnchor,deleted:ReadonlySet<string>)=>void):Promise<void>{
        const db=await this.open();await new Promise<void>((resolve,reject)=>{
            const tx=db.transaction([anchorsStore,deletedKeysStore],'readwrite'),store=tx.objectStore(anchorsStore),request=store.get(expected.id),excluded=tx.objectStore(deletedKeysStore).getAll();
            let failure:unknown;let remaining=2;
            const ready=():void=>{if(--remaining>0)return;try{
                const record=readAnchor(request.result),deleted=readDeletedKeys(excluded.result as unknown[]);
                if(JSON.stringify(record)!==JSON.stringify(readAnchor(expected))||JSON.stringify([...deleted].sort())!==JSON.stringify([...expectedDeleted].sort()))throw new Error('Local policy or trust changed after transition review');
                validate(record,deleted);const transitions=[...record.transitions??[],{text,acceptedAt}];
                if(transitions.length>32||new TextEncoder().encode(JSON.stringify(transitions)).length>8*1024*1024)throw new Error('Trust-transition storage capacity reached');
                store.put({...record,transitions});
            }catch(error){failure=error;tx.abort();}};
            request.onsuccess=ready;excluded.onsuccess=ready;tx.oncomplete=():void=> { resolve(); };tx.onabort=():void=> { reject(failure instanceof Error?failure:tx.error??new Error('Could not store trust transition')); };
        });
    }
    private connection: Promise<IDBDatabase> | null = null;

    private async open(): Promise<IDBDatabase> {
        if (this.connection !== null)
            return this.connection;
        const opening = new Promise<IDBDatabase>((resolve, reject) => {
            let blocked = false;
            const request = indexedDB.open(trustDatabaseName, 2);
            request.onupgradeneeded = (): void => {
                const database = request.result;
                if (!database.objectStoreNames.contains(anchorsStore))
                    database.createObjectStore(anchorsStore, { keyPath: "id" });
                if (!database.objectStoreNames.contains(deletedKeysStore))
                    database.createObjectStore(deletedKeysStore, { keyPath: "id" });
                if (!database.objectStoreNames.contains(stationProofsStore)) {
                    const proofs = database.createObjectStore(stationProofsStore, { keyPath: 'id' });
                    proofs.createIndex('byPolicyTime', ['anchorPolicyId', 'downloadedAt', 'id']);
                }
            };
            request.onerror = (): void => { reject(request.error ?? new Error("Could not open trust management storage")); };
            request.onblocked = (): void => { blocked = true; reject(new Error("Trust management storage is blocked by another tab")); };
            request.onsuccess = (): void => {
                const database = request.result;
                if (blocked) { database.close(); return; }
                database.onversionchange = (): void => { database.close(); this.connection = null; };
                database.onclose = (): void => { this.connection = null; };
                resolve(database);
            };
        });
        this.connection = opening.catch((error: unknown) => { this.connection = null; throw error; });
        return this.connection;
    }

    private async transaction<T>(name: string | readonly string[], mode: IDBTransactionMode,
                                  run: (store: IDBObjectStore, result: (value: T) => void) => void,
                                  signal?: AbortSignal): Promise<T> {
        const database = await this.open();
        signal?.throwIfAborted();
        return new Promise<T>((resolve, reject) => {
            const names = typeof name === 'string' ? [name] : [...name];
            const transaction = database.transaction(names, mode);
            const abort = (): void => { try { transaction.abort(); } catch { /* Already committed. */ } };
            signal?.addEventListener("abort", abort, { once: true });
            let result: { value: T } | null = null;
            transaction.oncomplete = (): void => {
                signal?.removeEventListener("abort", abort);
                if (result === null)
                    reject(new Error("Trust management operation returned no result"));
                else
                    resolve(result.value);
            };
            transaction.onabort = (): void => {
                signal?.removeEventListener("abort", abort);
                reject(transaction.error ?? new Error("Trust management operation was aborted"));
            };
            transaction.onerror = (): void => { reject(transaction.error ?? new Error("Trust management operation failed")); };
            try {
                run(transaction.objectStore(names[0] ?? anchorsStore), value => { result = { value }; });
            }
            catch (error) {
                transaction.abort();
                reject(error instanceof Error ? error : new Error("Trust management operation failed"));
            }
        });
    }

    public async listAnchors(): Promise<readonly StoredTrustAnchor[]> {
        const values = await this.transaction<unknown[]>(anchorsStore, "readonly", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => { result(request.result as unknown[]); };
        });
        return values.map(readAnchor).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    }

    public async hasAnchor(anchor: TrustAnchor): Promise<boolean> {
        return this.transaction(anchorsStore, "readonly", (store, result) => {
            const request = store.getKey(trustAnchorStorageId(anchor));
            request.onsuccess = (): void => { result(request.result !== undefined); };
        });
    }

    public async getAnchor(anchor: TrustAnchor): Promise<StoredTrustAnchor | undefined> {
        const value = await this.transaction<unknown>(anchorsStore, "readonly", (store, result) => {
            const request = store.get(trustAnchorStorageId(anchor));
            request.onsuccess = (): void => { result(request.result); };
        });
        return value === undefined ? undefined : readAnchor(value);
    }

    /** An authorization snapshot must not mix an anchor and exclusions read from different transactions. */
    public async trustSnapshot(anchorPolicyId: string): Promise<{
        readonly record: StoredTrustAnchor | undefined; readonly deleted: ReadonlySet<string>;
    }> {
        const { records, deleted } = await this.readTrustSnapshot(anchorPolicyId);
        return { record: records[0], deleted };
    }

    public async listTrustSnapshot(): Promise<{
        readonly records: readonly StoredTrustAnchor[]; readonly deleted: ReadonlySet<string>;
    }> {
        return this.readTrustSnapshot();
    }

    private async readTrustSnapshot(anchorPolicyId?: string): Promise<{
        readonly records: readonly StoredTrustAnchor[]; readonly deleted: ReadonlySet<string>;
    }> {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([anchorsStore, deletedKeysStore], 'readonly');
            const anchors = transaction.objectStore(anchorsStore);
            const request = anchorPolicyId === undefined ? anchors.getAll() : anchors.get(anchorPolicyId);
            const exclusions = transaction.objectStore(deletedKeysStore).getAll();
            transaction.onabort = (): void => { reject(transaction.error ?? new Error('Could not read POI trust decisions')); };
            transaction.onerror = (): void => { reject(transaction.error ?? new Error('Could not read POI trust decisions')); };
            transaction.oncomplete = (): void => {
                try {
                    const values = anchorPolicyId === undefined ? request.result as unknown[]
                        : request.result === undefined ? [] : [request.result as unknown];
                    const records = values.map(readAnchor).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
                    resolve({ records, deleted: readDeletedKeys(exclusions.result as unknown[]) });
                }
                catch (error) { reject(error instanceof Error ? error : new Error('Invalid POI trust snapshot')); }
            };
        });
    }

    /** A separate user action; import never calls this. Updating one key preserves concurrent decisions. */
    public async setKeyTrust(anchorId: string, keyId: string, trusted: boolean): Promise<void> {
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.get(anchorId);
            request.onsuccess = (): void => {
                try {
                    const record = readAnchor(request.result);
                    if (!TrustAnchor.parse(record.qrCode).keys.includes(keyId))
                        throw new Error("The key is not part of this trust anchor");
                    const keys = [...(record.trustedKeys ?? [])];
                    if (trusted && !keys.some(key => key.id === keyId))
                        keys.push({ id: keyId, acceptedAt: new Date().toISOString() });
                    store.put({ ...record, trustedKeys: trusted ? keys : keys.filter(key => key.id !== keyId) });
                    result(undefined);
                }
                catch {
                    store.transaction.abort();
                }
            };
        });
    }

    /** The unique-key check and insertion share one transaction, including across tabs. */
    public async importAnchor(anchor: TrustAnchor, sourceText: string, downloadedData?: StoredTrustAnchorData,
                               signal?: AbortSignal): Promise<"imported" | "exists"> {
        const record: StoredTrustAnchor = {
            id: trustAnchorStorageId(anchor), qrCode: anchor.toQRCode(), sourceText,
            importedAt: new Date().toISOString(), ...(downloadedData === undefined ? {} : { downloadedData })
        };
        return this.transaction(anchorsStore, "readwrite", (store, result) => {
            const request = store.get(record.id);
            request.onsuccess = (): void => {
                if (request.result !== undefined) {
                    if (downloadedData !== undefined && (readAnchor(request.result).transitions?.length??0)===0) {
                        try { store.put({ ...readAnchor(request.result), downloadedData }); }
                        catch { store.transaction.abort(); return; }
                    }
                    result("exists");
                }
                else {
                    store.add(record);
                    result("imported");
                }
            };
        }, signal);
    }

    public async deleteAnchor(id: string): Promise<void> {
        return this.transaction([anchorsStore, stationProofsStore], "readwrite", (store, result) => {
            store.delete(id); deletePolicyProofs(store.transaction, id); result(undefined);
        });
    }

    /** Delete only the selected identity's policies, never every operator claiming the same network ID. */
    public async deleteRoamingNetwork(anchorPolicyIds: readonly string[]): Promise<number> {
        const selected = new Set(anchorPolicyIds);
        return this.transaction([anchorsStore, stationProofsStore], "readwrite", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => {
                try {
                    const records = (request.result as unknown[]).map(readAnchor)
                        .filter(record => selected.has(record.id));
                    for (const record of records) {
                        store.delete(record.id);
                        deletePolicyProofs(store.transaction, record.id);
                    }
                    result(records.length);
                }
                catch {
                    store.transaction.abort();
                }
            };
        });
    }

    public async deletedBundledKeyIds(): Promise<ReadonlySet<string>> {
        const values = await this.transaction<unknown[]>(deletedKeysStore, "readonly", (store, result) => {
            const request = store.getAll();
            request.onsuccess = (): void => { result(request.result as unknown[]); };
        });
        return readDeletedKeys(values);
    }

    public async deleteBundledKey(id: string): Promise<void> {
        if (!/^[0-9a-f]{64}$/.test(id))
            throw new Error("Invalid public key ID");
        return this.transaction(deletedKeysStore, "readwrite", (store, result) => { store.put({ id }); result(undefined); });
    }

    public async restoreBundledKey(id: string): Promise<void> {
        return this.transaction(deletedKeysStore, "readwrite", (store, result) => { store.delete(id); result(undefined); });
    }

    public async saveStationProof(proof: LoadedStationProof, signal?: AbortSignal): Promise<'saved' | 'exists'> {
        const record = readStationProof({
            id: stationProofStorageId(proof.context.anchorPolicyId, proof.evseId, proof.document.text),
            anchorPolicyId: proof.context.anchorPolicyId, anchorQRCode: proof.context.evidence.bootstrapAnchorQRCode??proof.context.evidence.anchorQRCode,
            effectiveAnchorQRCode:proof.context.evidence.anchorQRCode,
            evseId: proof.evseId, ...proof.document, checkedAt: new Date(proof.context.evaluatedAt).toISOString()
        });
        return this.transaction([anchorsStore, stationProofsStore], 'readwrite', (anchors, result) => {
            const parent = anchors.get(record.anchorPolicyId);
            parent.onsuccess = (): void => {
                try {
                    if (readAnchor(parent.result).id !== record.anchorPolicyId)
                        throw new Error('The anchor was removed');
                    const proofs = anchors.transaction.objectStore(stationProofsStore);
                    const existing = proofs.get(record.id);
                    existing.onsuccess = (): void => {
                        try {
                            if (existing.result !== undefined) { readStationProof(existing.result); result('exists'); }
                            else { proofs.add(record); result('saved'); }
                        }
                        catch { anchors.transaction.abort(); }
                    };
                }
                catch { anchors.transaction.abort(); }
            };
        }, signal);
    }

    public async listStationProofs(policyId: string, limit: number = 10): Promise<readonly StoredStationProof[]> {
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new Error('Invalid saved proof limit');
        return this.transaction(stationProofsStore, 'readonly', (store, result) => {
            const records: StoredStationProof[] = [];
            const request = store.index('byPolicyTime').openCursor(proofPolicyRange(policyId), 'prev');
            request.onsuccess = (): void => {
                try {
                    const cursor = request.result;
                    if (cursor === null || records.length === limit) { result(records); return; }
                    records.push(readStationProof(cursor.value));
                    cursor.continue();
                }
                catch { store.transaction.abort(); }
            };
        });
    }

    public async deleteStationProof(id: string): Promise<void> {
        return this.transaction(stationProofsStore, 'readwrite', (store, result) => { store.delete(id); result(undefined); });
    }
}

function readDeletedKeys(values: readonly unknown[]): ReadonlySet<string> {
    return new Set(values.map(value => {
        const id = object(value)["id"];
        if (typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id))
            throw new Error("Invalid deleted public key record");
        return id;
    }));
}

export function activeBundledPublicKeys(keys: readonly POIPublicKey[], deleted: ReadonlySet<string>): readonly POIPublicKey[] {
    return keys.filter(key => !deleted.has(key.id));
}
