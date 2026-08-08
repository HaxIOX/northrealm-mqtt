import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('mqtt_theme'));
  await page.goto('/');
});

test('switches monochrome theme and closes the filter drawer from outside', async ({ page }) => {
  await expect(page.locator('#root > div')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '打开主题筛选' }).click();
  const drawer = page.getByRole('dialog', { name: '主题筛选' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/已断开|未连接|连接中|已连接|重连中|连接错误|手动停止/)).toBeVisible();

  await page.getByRole('button', { name: '切换到浅色主题' }).click();
  await expect(page.locator('#root > div')).not.toHaveClass(/dark/);
  await page.mouse.click(375, 420);
  await expect(page.getByRole('heading', { name: '主题筛选' })).toBeHidden();

  await page.getByRole('button', { name: '打开主题筛选' }).click();
  await page.mouse.move(220, 420);
  await page.mouse.down();
  await page.mouse.move(80, 420, { steps: 6 });
  await page.mouse.up();
  await expect(drawer).toBeHidden();
});

test('keeps the mobile action trigger attached to the edge and expands actions', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '展开快捷操作' });
  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box.x + box.width)).toBeGreaterThanOrEqual(389);

  await trigger.click();
  await expect(page.getByRole('button', { name: '连接配置' })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送消息' })).toBeVisible();
});

test('places receive-only Text and Hex controls in connection configuration', async ({ page }) => {
  await page.getByRole('button', { name: '展开快捷操作' }).click();
  await page.getByRole('button', { name: '连接配置' }).click();
  const modeGroup = page.getByRole('group', { name: '接收消息显示格式' });
  await expect(modeGroup).toBeVisible();
  await modeGroup.getByRole('button', { name: 'HEX' }).click();
  await expect(modeGroup.getByRole('button', { name: 'HEX' })).toHaveAttribute('aria-pressed', 'true');
});
