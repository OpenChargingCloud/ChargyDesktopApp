import { afterEach, describe, expect, test, vi } from 'vitest';
import { poiFetch } from '../src/ts/poiFetch';

afterEach(() => vi.unstubAllGlobals());

describe('Desktop POI transport', () => {
    test('uses the bounded main-process request for the exact source URL', async () => {
        const fetchLiveLink = vi.fn().mockResolvedValue({
            ok: true, status: 200, data: new TextEncoder().encode('{"proof":true}').buffer
        });
        vi.stubGlobal('window', { chargyElectron: { fetchLiveLink, cancelLiveLink: vi.fn() } });

        const response = await poiFetch('https://poi.example/EVSEs/E1/proof');
        expect(await response.json()).toEqual({ proof: true });
        expect(fetchLiveLink).toHaveBeenCalledWith(
            'https://poi.example/EVSEs/E1/proof', 8 * 1024 * 1024,
            'https://poi.example/EVSEs/E1/proof', undefined, expect.any(String)
        );
    });

    test('cancels a pending request when the caller aborts', async () => {
        let complete!: (value: unknown) => void;
        const fetchLiveLink = vi.fn().mockImplementation(async () => new Promise(resolve => { complete = resolve; }));
        const cancelLiveLink = vi.fn();
        vi.stubGlobal('window', { chargyElectron: { fetchLiveLink, cancelLiveLink } });
        const controller = new AbortController();
        const pending = poiFetch('https://poi.example/keyStatement', { signal: controller.signal });
        controller.abort();
        expect(cancelLiveLink).toHaveBeenCalledWith(fetchLiveLink.mock.calls[0]?.[4]);
        complete({ ok: false, status: 0 });
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });
});
