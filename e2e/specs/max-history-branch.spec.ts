import { expect, test } from '@playwright/test';

test('maxHistory keeps a sliding window and clears redo history on branch', async ({
  page,
}) => {
  await page.goto('/');

  for (let i = 0; i < 5; i++) {
    await page.getByTestId('max-step').click();
  }

  await expect(page.getByTestId('max-count')).toHaveText('5');
  await expect(page.getByTestId('max-position')).toHaveText('3');
  await expect(page.getByTestId('max-history')).toHaveText('2,3,4,5');

  await page.getByTestId('max-back').click();
  await page.getByTestId('max-back').click();
  await expect(page.getByTestId('max-count')).toHaveText('3');
  await expect(page.getByTestId('max-can-forward')).toHaveText('true');

  await page.getByTestId('max-branch').click();
  await expect(page.getByTestId('max-count')).toHaveText('30');
  await expect(page.getByTestId('max-can-forward')).toHaveText('false');
  await expect(page.getByTestId('max-history')).toHaveText('2,3,30');

  await page.getByTestId('max-reset').click();
  await expect(page.getByTestId('max-count')).toHaveText('0');
  await expect(page.getByTestId('max-position')).toHaveText('0');
  await expect(page.getByTestId('max-history')).toHaveText('0');
});
