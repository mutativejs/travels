import { expect, type Page, test } from '@playwright/test';

type AdapterName = 'dexie' | 'idb' | 'localforage' | 'localspace';

const adapters: AdapterName[] = ['dexie', 'idb', 'localforage', 'localspace'];

const byTestId = (name: AdapterName, suffix: string) =>
  `${name}-adapter-${suffix}`;

const gotoCleanAdapter = async (page: Page, name: AdapterName) => {
  await page.goto('/');
  await expect(page.getByTestId(byTestId(name, 'status'))).toHaveText('ready');

  await page.getByTestId(byTestId(name, 'clear')).click();
  await expect(page.getByTestId(byTestId(name, 'status'))).toHaveText('cleared');
  await expect(page.getByTestId(byTestId(name, 'rows'))).toHaveText('0');

  await page.reload();
  await expect(page.getByTestId(byTestId(name, 'state'))).toHaveText(
    'Untitled|'
  );
  await expect(page.getByTestId(byTestId(name, 'position'))).toHaveText('0');
};

const editAndSave = async (
  page: Page,
  name: AdapterName,
  saveButton = 'flush'
) => {
  await page.getByTestId(byTestId(name, 'add-block')).click();
  await page.getByTestId(byTestId(name, 'publish')).click();
  await expect(page.getByTestId(byTestId(name, 'state'))).toHaveText(
    'Published|Block 1'
  );

  await page.getByTestId(byTestId(name, saveButton)).click();
};

for (const adapter of adapters) {
  test(`${adapter} adapter saves, reloads, and restores undo/redo history`, async ({
    page,
  }) => {
    await gotoCleanAdapter(page, adapter);

    await editAndSave(page, adapter);
    await expect(page.getByTestId(byTestId(adapter, 'status'))).toHaveText(
      'saved'
    );
    await expect(page.getByTestId(byTestId(adapter, 'rows'))).toHaveText('1');

    await page.reload();
    await expect(page.getByTestId(byTestId(adapter, 'state'))).toHaveText(
      'Published|Block 1'
    );
    await expect(page.getByTestId(byTestId(adapter, 'position'))).toHaveText('2');

    await page.getByTestId(byTestId(adapter, 'back')).click();
    await expect(page.getByTestId(byTestId(adapter, 'state'))).toHaveText(
      'Untitled|Block 1'
    );

    await page.getByTestId(byTestId(adapter, 'back')).click();
    await expect(page.getByTestId(byTestId(adapter, 'state'))).toHaveText(
      'Untitled|'
    );

    await page.getByTestId(byTestId(adapter, 'forward')).click();
    await expect(page.getByTestId(byTestId(adapter, 'state'))).toHaveText(
      'Untitled|Block 1'
    );
  });

  test(`${adapter} adapter rejects unreplayable stored history`, async ({
    page,
  }) => {
    await gotoCleanAdapter(page, adapter);

    await page.getByTestId(byTestId(adapter, 'seed-corrupt')).click();
    await expect(page.getByTestId(byTestId(adapter, 'status'))).toHaveText(
      'corrupt-seeded'
    );

    await page.reload();
    await expect(page.getByTestId(byTestId(adapter, 'status'))).toHaveText(
      'fallback:INVALID_HISTORY'
    );
    await expect(page.getByTestId(byTestId(adapter, 'state'))).toHaveText(
      'Untitled|'
    );
    await expect(page.getByTestId(byTestId(adapter, 'position'))).toHaveText(
      '0'
    );
  });
}

test('Dexie adapter saves the snapshot and related audit row in one transaction', async ({
  page,
}) => {
  await gotoCleanAdapter(page, 'dexie');

  await editAndSave(page, 'dexie', 'transaction');
  await expect(page.getByTestId('dexie-adapter-status')).toHaveText(
    'transaction-saved'
  );
  await expect(page.getByTestId('dexie-adapter-rows')).toHaveText('1');
  await expect(page.getByTestId('dexie-adapter-audit')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('dexie-adapter-state')).toHaveText(
    'Published|Block 1'
  );
  await expect(page.getByTestId('dexie-adapter-audit')).toHaveText('1');
});

test('idb adapter prunes old snapshot rows through its updatedAt index', async ({
  page,
}) => {
  await gotoCleanAdapter(page, 'idb');

  await editAndSave(page, 'idb');
  await expect(page.getByTestId('idb-adapter-rows')).toHaveText('1');

  await page.getByTestId('idb-adapter-seed-old').click();
  await expect(page.getByTestId('idb-adapter-status')).toHaveText('old-seeded');
  await expect(page.getByTestId('idb-adapter-rows')).toHaveText('2');

  await page.getByTestId('idb-adapter-prune-old').click();
  await expect(page.getByTestId('idb-adapter-status')).toHaveText('old-pruned');
  await expect(page.getByTestId('idb-adapter-rows')).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId('idb-adapter-state')).toHaveText(
    'Published|Block 1'
  );
});

test('localspace adapter persists snapshot metadata through runTransaction', async ({
  page,
}) => {
  await gotoCleanAdapter(page, 'localspace');

  await editAndSave(page, 'localspace', 'transaction');
  await expect(page.getByTestId('localspace-adapter-status')).toHaveText(
    'transaction-saved'
  );
  await expect(page.getByTestId('localspace-adapter-metadata')).toHaveText(
    'updated'
  );

  await page.reload();
  await expect(page.getByTestId('localspace-adapter-state')).toHaveText(
    'Published|Block 1'
  );
  await expect(page.getByTestId('localspace-adapter-metadata')).toHaveText(
    'updated'
  );
});
