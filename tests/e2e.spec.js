const { test, expect } = require('@playwright/test');

test('user can add item to cart and checkout with payment', async ({ page }) => {
  await page.goto('/');

  // Wait for products to load
  await expect(page.locator('text=Add to cart').first()).toBeVisible();

  // Add first product to cart
  await page.locator('text=Add to cart').first().click();

  // Confirm cart shows 1 item
  await expect(page.locator('text=Cart: 1 items')).toBeVisible();

  // Click on cart to go to cart page
  await page.locator('text=Cart: 1 items').click();

  // Should see "Proceed to Checkout" button
  await expect(page.locator('text=Proceed to Checkout')).toBeVisible();

  // Click proceed to checkout
  await page.locator('text=Proceed to Checkout').click();

  // Should be on checkout page with form
  await expect(page.locator('text=Billing Information')).toBeVisible();

  // Fill in billing info
  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[name="email"]', 'john@example.com');
  await page.fill('textarea[name="address"]', '123 Main St, City, State 12345');

  // Fill in payment details
  await page.fill('input[name="cardNumber"]', '4111111111111111');
  await page.fill('input[name="expiry"]', '12/25');
  await page.fill('input[name="cvc"]', '123');

  // Click pay button
  await page.locator('button:has-text("Pay $")').click();

  // Wait for success message
  await expect(page.locator('text=Payment successful')).toBeVisible({ timeout: 5000 });
});

test('user can remove items from cart', async ({ page }) => {
  await page.goto('/');

  // Wait for products to load
  await expect(page.locator('text=Add to cart').first()).toBeVisible();

  // Add two items to cart
  const addButtons = page.locator('text=Add to cart');
  await addButtons.nth(0).click();
  await addButtons.nth(1).click();

  // Confirm cart shows 2 items
  await expect(page.locator('text=Cart: 2 items')).toBeVisible();

  // Click on cart to go to cart page
  await page.locator('text=Cart: 2 items').click();

  // Should see "Shopping Cart" heading
  await expect(page.locator('text=Shopping Cart')).toBeVisible();

  // Should see 2 items in cart
  await expect(page.locator('.cart-item-row')).toHaveCount(2);

  // Click remove button on first item
  await page.locator('button:has-text("Remove")').first().click();

  // Should now only see 1 item
  await expect(page.locator('.cart-item-row')).toHaveCount(1);

  // Go back to shop
  await page.locator('text=Continue Shopping').click();

  // Verify we're back on shop page with hero
  await expect(page.locator('text=Beautiful goods, thoughtfully made')).toBeVisible();
});
