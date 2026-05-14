import { expect, test } from '@playwright/test';

test('MobX observable state stays reactive with mutable undo and redo', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('mobx-reference-stable')).toHaveText('true');
  await expect(page.getByTestId('mobx-items')).toHaveText('');

  await page.getByTestId('mobx-add-walk').click();
  await page.getByTestId('mobx-add-cook').click();
  await expect(page.getByTestId('mobx-items')).toHaveText(
    'Walk:false,Cook:false'
  );

  await page.getByTestId('mobx-toggle-first').click();
  await expect(page.getByTestId('mobx-items')).toHaveText(
    'Walk:true,Cook:false'
  );

  await page.getByTestId('mobx-back').click();
  await expect(page.getByTestId('mobx-items')).toHaveText(
    'Walk:false,Cook:false'
  );

  await page.getByTestId('mobx-forward').click();
  await expect(page.getByTestId('mobx-items')).toHaveText(
    'Walk:true,Cook:false'
  );

  await page.getByTestId('mobx-reset').click();
  await expect(page.getByTestId('mobx-items')).toHaveText('');
  await expect(page.getByTestId('mobx-reference-stable')).toHaveText('true');
});
