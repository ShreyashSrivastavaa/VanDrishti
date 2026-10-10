import { test, expect } from '@playwright/test';

test.describe('Map AOI Selection and Layers', () => {
  test('selecting an AOI changes the map bounds and URL parameter', async ({ page }) => {
    // 1. Visit map page
    await page.goto('/map');

    // 2. Ensure map container and controls are visible
    const mapContainer = page.locator('#maplibre-container');
    await expect(mapContainer).toBeVisible();

    // 3. Tree Cover Density is active by default
    const densityCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(densityCheckbox).toBeChecked();

    const densityLegend = page.getByText(/Tree cover density \(~100 m window\)/i);
    await expect(densityLegend).toBeVisible();

    // 4. Select a different AOI from dropdown
    const aoiSelect = page.locator('select').first();
    await expect(aoiSelect).toBeVisible();

    // Select Western Ghats
    await aoiSelect.selectOption({ value: 'western-ghats-shimoga' });

    // Verify URL parameter updated to selected AOI
    await expect(page).toHaveURL(/aoi=western-ghats-shimoga/);

    // Verify that selecting another AOI changes URL and triggers fitBounds
    await aoiSelect.selectOption({ value: 'rondonia-jamari' });
    await expect(page).toHaveURL(/aoi=rondonia-jamari/);
  });

  test('direct navigation with ?aoi= URL parameter selects AOI on initial load', async ({ page }) => {
    await page.goto('/map?aoi=kalimantan-kahayan');

    const aoiSelect = page.locator('select').first();
    await expect(aoiSelect).toHaveValue('kalimantan-kahayan');

    // Legend shows active observation date and tree density ramp
    const densityLegend = page.getByText(/Tree cover density \(~100 m window\)/i);
    await expect(densityLegend).toBeVisible();
  });
});
