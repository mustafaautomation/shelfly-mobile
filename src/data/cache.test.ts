import { withReadCache } from '@/data/cache';
import { createMockRepository } from '@/data/mockRepository';
import { createMemoryPersistence } from '@/data/persistence';
import { ShelflyError } from '@/domain/errors';

describe('read cache', () => {
  it('serves the last saved copy offline and refuses writes', async () => {
    const persistence = createMemoryPersistence();
    let online = true;
    const marks: boolean[] = [];
    const repo = withReadCache(createMockRepository({ persistence }), persistence, { mark: (stale) => marks.push(stale) }, () => online);
    await repo.signInAsDemo('usr_nw_staff');
    const fresh = await repo.getDashboard();

    online = false;
    const cached = await repo.getDashboard();
    expect(cached.workspace.name).toBe(fresh.workspace.name);
    expect(marks.at(-1)).toBe(true);
    await expect(repo.listAlerts()).rejects.toMatchObject({ code: 'offline' });
    await expect(
      repo.applyStock({ type: 'receive', productId: 'prd_mug', locationId: 'loc_pick', qty: 1, reason: 'x' }),
    ).rejects.toBeInstanceOf(ShelflyError);
  });

  it('keeps each workspace in its own cache slot', async () => {
    const persistence = createMemoryPersistence();
    let online = true;
    const repo = withReadCache(createMockRepository({ persistence }), persistence, { mark() {} }, () => online);
    await repo.signInAsDemo('usr_admin');
    await repo.switchWorkspace('tnt_northwind');
    await repo.getDashboard();
    await repo.switchWorkspace('tnt_harbor');
    online = false;
    await expect(repo.getDashboard()).rejects.toMatchObject({ code: 'offline' });
  });

  it('drops the cache after a write so the next read is live', async () => {
    const persistence = createMemoryPersistence();
    const repo = withReadCache(createMockRepository({ persistence }), persistence, { mark() {} });
    await repo.signInAsDemo('usr_nw_staff');
    expect((await repo.getItem('prd_mug')).onHand).toBe(18);
    await repo.applyStock({ type: 'receive', productId: 'prd_mug', locationId: 'loc_pick', qty: 2, reason: 'Kiln run' });
    expect((await repo.getItem('prd_mug')).onHand).toBe(20);
  });
});
