import { expect, test } from '@playwright/test';

test('browser persistence restores serialized history after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('travels-e2e-browser-history');
  });
  await page.reload();

  await expect(page.getByTestId('persistence-state')).toHaveText('Draft|');
  await expect(page.getByTestId('persistence-position')).toHaveText('0');

  await page.getByTestId('persistence-add-block').click();
  await page.getByTestId('persistence-publish').click();
  await expect(page.getByTestId('persistence-state')).toHaveText(
    'Published|Block 1'
  );
  await expect(page.getByTestId('persistence-position')).toHaveText('2');

  await page.getByTestId('persistence-save').click();
  await expect(page.getByTestId('persistence-saved')).toHaveText('saved');

  await page.reload();
  await expect(page.getByTestId('persistence-state')).toHaveText(
    'Published|Block 1'
  );
  await expect(page.getByTestId('persistence-position')).toHaveText('2');

  await page.getByTestId('persistence-back').click();
  await expect(page.getByTestId('persistence-state')).toHaveText(
    'Draft|Block 1'
  );

  await page.getByTestId('persistence-back').click();
  await expect(page.getByTestId('persistence-state')).toHaveText('Draft|');

  await page.getByTestId('persistence-forward').click();
  await expect(page.getByTestId('persistence-state')).toHaveText(
    'Draft|Block 1'
  );
});

test('browser persistence falls back from unreplayable stored history', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'travels-e2e-browser-history',
      JSON.stringify({
        version: 1,
        state: { title: 'Draft', blocks: [] },
        patches: {
          patches: [
            [
              {
                op: 'replace',
                path: ['missing', 'value'],
                value: 'corrupted',
              },
            ],
          ],
          inversePatches: [
            [
              {
                op: 'replace',
                path: ['missing', 'value'],
                value: 'previous',
              },
            ],
          ],
        },
        position: 0,
      })
    );
  });

  await page.reload();
  await expect(page.getByTestId('persistence-saved')).toHaveText(
    'fallback:INVALID_HISTORY'
  );
  await expect(page.getByTestId('persistence-state')).toHaveText('Draft|');
  await expect(page.getByTestId('persistence-position')).toHaveText('0');
});
