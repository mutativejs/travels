import { expect, test } from '@playwright/test';

test('React immutable counter supports undo, redo, and reset', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('react-count')).toHaveText('0');

  await page.getByTestId('react-add').click();
  await page.getByTestId('react-add').click();
  await expect(page.getByTestId('react-count')).toHaveText('2');
  await expect(page.getByTestId('react-history')).toHaveText('count:1,count:2');

  await page.getByTestId('react-back').click();
  await expect(page.getByTestId('react-count')).toHaveText('1');

  await page.getByTestId('react-forward').click();
  await expect(page.getByTestId('react-count')).toHaveText('2');

  await page.getByTestId('react-reset').click();
  await expect(page.getByTestId('react-count')).toHaveText('0');
  await expect(page.getByTestId('react-history')).toHaveText('');
});

test('React manual archive batches multiple form edits into one undo step', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('react-form-state')).toHaveText('-|-|-');
  await expect(page.getByTestId('react-form-can-archive')).toHaveText('false');

  await page.getByTestId('react-form-first').click();
  await page.getByTestId('react-form-last').click();
  await page.getByTestId('react-form-email').click();
  await expect(page.getByTestId('react-form-state')).toHaveText(
    'John|Doe|john@example.com'
  );
  await expect(page.getByTestId('react-form-can-archive')).toHaveText('true');

  await page.getByTestId('react-form-archive').click();
  await expect(page.getByTestId('react-form-can-archive')).toHaveText('false');

  await page.getByTestId('react-form-back').click();
  await expect(page.getByTestId('react-form-state')).toHaveText('-|-|-');

  await page.getByTestId('react-form-forward').click();
  await expect(page.getByTestId('react-form-state')).toHaveText(
    'John|Doe|john@example.com'
  );
});
