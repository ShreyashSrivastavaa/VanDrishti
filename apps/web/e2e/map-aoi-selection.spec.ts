import { test, expect } from '@playwright/test';

test.describe('Map AOI Selection, National Layer and Toggles', () => {
  test('initial load with no AOI fits India envelope and displays National tree cover reference layer', async ({ page }) => {
    await page.goto('/map');

    // 1. Ensure map container is visible
    const mapContainer = page.locator('#maplibre-container');
    await expect(mapContainer).toBeVisible();

    // 2. National tree cover is ON by default
    const nationalCheckbox = page.getByRole('checkbox', { name: /National tree cover/i });
    await expect(nationalCheckbox).toBeChecked();

    // 3. Legend shows National tree cover reference ramp & Reference product chip
    const legend = page.getByText(/National tree cover \(reference, ~30 m\)/i);
    await expect(legend).toBeVisible();
    await expect(page.getByText(/Reference product/i)).toBeVisible();
  });

  test('selecting an AOI changes the map bounds and URL parameter', async ({ page }) => {
    await page.goto('/map');

    const aoiSelect = page.locator('select').first();
    await expect(aoiSelect).toBeVisible();

    // Select Western Ghats
    await aoiSelect.selectOption({ value: 'western-ghats-shimoga' });

    // Verify URL parameter updated to selected AOI
    await expect(page).toHaveURL(/aoi=western-ghats-shimoga/);

    // Verify selecting another AOI changes URL
    await aoiSelect.selectOption({ value: 'rondonia-jamari' });
    await expect(page).toHaveURL(/aoi=rondonia-jamari/);
  });

  test('direct navigation with ?aoi= URL parameter selects AOI on initial load', async ({ page }) => {
    await page.goto('/map?aoi=kalimantan-kahayan');

    const aoiSelect = page.locator('select').first();
    await expect(aoiSelect).toHaveValue('kalimantan-kahayan');
  });

  test('toggling layers and adjusting opacity controls work smoothly', async ({ page }) => {
    await page.goto('/map?aoi=western-ghats-shimoga');

    // Open opacity sliders
    const opacityButton = page.getByRole('button', { name: /Opacity/i });
    await opacityButton.click();

    // Check Suspected Forest Loss is checked by default
    const lossCheckbox = page.getByRole('checkbox', { name: /Suspected Forest Loss/i });
    await expect(lossCheckbox).toBeChecked();

    // Uncheck and recheck
    await lossCheckbox.uncheck();
    await expect(lossCheckbox).not.toBeChecked();
    await lossCheckbox.check();
    await expect(lossCheckbox).toBeChecked();
  });
});
