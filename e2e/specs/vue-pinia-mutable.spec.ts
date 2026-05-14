import { expect, test } from '@playwright/test';

test('Vue and Pinia keep mutable state reactive through history controls', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('pinia-reference-stable')).toHaveText('true');
  await expect(page.getByTestId('pinia-items')).toHaveText('');

  await page.getByTestId('pinia-add-walk').click();
  await page.getByTestId('pinia-add-cook').click();
  await expect(page.getByTestId('pinia-items')).toHaveText(
    'Walk:false,Cook:false'
  );

  await page.getByTestId('pinia-toggle-first').click();
  await expect(page.getByTestId('pinia-items')).toHaveText(
    'Walk:true,Cook:false'
  );

  await page.getByTestId('pinia-back').click();
  await expect(page.getByTestId('pinia-items')).toHaveText(
    'Walk:false,Cook:false'
  );

  await page.getByTestId('pinia-forward').click();
  await expect(page.getByTestId('pinia-items')).toHaveText(
    'Walk:true,Cook:false'
  );

  await page.getByTestId('pinia-reset').click();
  await expect(page.getByTestId('pinia-items')).toHaveText('');
  await expect(page.getByTestId('pinia-reference-stable')).toHaveText('true');
});
