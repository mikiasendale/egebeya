
const { test, devices } = require('@playwright/test');

// Mobile viewport simulating phone
const MOBILE_VIEWPORT = {
  width: 390,
  height: 844
};

test.describe('Egebeya UX Audit - Phase 2', () => {
  let browser, page;

  test.beforeAll(async () => {
    browser = await require('playwright').chromium.launch({
      headless: false,
      args: ['--window-position=-10000,-10000']
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('Flow 1: Instant Empire Onboarding', async () => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();
    
    console.log('\n=== FLOW 1: INSTANT EMPIRE ONBOARDING ===\n');

    // Step 1: Navigate to register
    await page.goto('http://localhost:3000/register');
    console.log('[Step 1] Navigated to /register');
    await page.screenshot({ path: 'flow1_01_register_page.png' });

    // Step 2: Fill out registration form with Ethiopian phone
    const phoneInput = page.locator('input[type="tel"], input[name="phone"], input[placeholder*="phone"]').first();
    await phoneInput.fill('+251911123456');
    console.log('[Step 2] Filled phone number: +251911123456');
    
    // Look for submit button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")').first();
    await submitBtn.click();
    console.log('[Step 2] Clicked submit button');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'flow1_02_after_register.png' });

    // Step 4: Check for onboarding wizard
    const onboardingHeader = await page.locator('text=Welcome, text=Onboarding, text=Install', { state: 'visible' }).first();
    if (await onboardingHeader.count() > 0) {
      console.log('[Step 4] OBSERVED: Onboarding wizard detected');
    } else {
      console.log('[Step 4] CHECK: No visible onboarding wizard');
    }
    await page.screenshot({ path: 'flow1_03_onboarding_status.png' });

    // Step 5: Complete minimum steps to publish
    const publishBtn = await page.locator('button:has-text("Publish"), button:has-text("Create Site"), button:has-text("Next")').first();
    if (await publishBtn.count() > 0) {
      await publishBtn.click();
      console.log('[Step 5] Clicked publish/continue button');
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'flow1_04_after_publish.png' });

    // Step 6: Check for Share to Telegram deep link
    const telegramLink = await page.locator('a[href*="t.me/share"], a[href*="telegram.me/share"]').first();
    if (await telegramLink.count() > 0) {
      const href = await telegramLink.getAttribute('href');
      console.log('[Step 6] OBSERVED: Telegram share link found:', href);
    } else {
      console.log('[Step 6] CHECK: No Telegram share link found');
    }

    // Check for loading states during submission
    const spinner = await page.locator('.spinner, .loading, .animate-spin').first();
    if (await spinner.count() > 0) {
      console.log('[Step 4 CHECK] Loading spinner observed');
    }

    await context.close();
  });

  test('Flow 2: Tactile Multi-Service Booking Cart', async () => {
    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();

    console.log('\n=== FLOW 2: MULTI-SERVICE BOOKING CART ===\n');

    // Navigate to a booking page
    await page.goto('http://localhost:3000/book');
    console.log('[Step 1] Navigated to booking page');
    await page.screenshot({ path: 'flow2_01_booking_page.png' });

    // Step 2: Check service selection UI
    const serviceCards = await page.locator('.service-card, .service-item, .card, [data-service]').first();
    if (await serviceCards.count() > 0) {
      console.log('[Step 2] OBSERVED: Service cards/chips detected (tactile UI)');
    }

    // Step 3: Click 2-3 services
    const serviceElements = await page.locator('.service-card, .service-item, .card, [data-service]').all();
    if (serviceElements.length >= 2) {
      console.log('[Step 3] Clicking multiple services...');
      await serviceElements[0].click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'flow2_02_service_1_selected.png' });
      if (serviceElements.length >= 2) {
        await serviceElements[1].click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'flow2_03_service_2_selected.png' });
      }
    }

    // Step 4: Check visual feedback on selection
    const selectedIndicator = await page.locator('.selected, .MuiSelect-root, [aria-selected="true"], .bg-selected').first();
    if (await selectedIndicator.count() > 0) {
      console.log('[Step 4] OBSERVED: Visual feedback on selection');
    } else {
      console.log('[Step 4] CHECK: No obvious selection indicator');
    }

    // Step 5: Check for sticky bottom bar with total price/duration
    const bottomBar = await page.locator('text=Total, text=Price, .total, .summary, .sticky-bottom, .fixed-bottom').first();
    if (await bottomBar.count() > 0) {
      console.log('[Step 5] OBSERVED: Bottom bar with totals detected');
    }

    // Step 6: Attempt to click Book Now with 0 services
    const bookBtn = await page.locator('button:has-text("Book Now"), button:has-text("Book"), .btn-book').first();
    if (await bookBtn.count() > 0) {
      // Check if disabled
      const isDisabled = await bookBtn.getAttribute('disabled');
      const hasDisabledClass = await bookBtn.getAttribute('class');
      if (isDisabled === 'true' || hasDisabledClass.includes('disabled') || hasDisabledClass.includes('disabled')) {
        console.log('[Step 6] OBSERVED: Book Now is disabled');
      } else {
        console.log('[Step 6] CHECK: Attempting to click Book Now...');
        try {
          await bookBtn.click();
          console.log('[Step 6] OBSERVED: Button was clickable despite no selection');
        } catch (e) {
          console.log('[Step 6] OBSERVATION: Button may have click handler');
        }
      }
    }

    await page.screenshot({ path: 'flow2_04_booking_summary.png' });
    await context.close();
  });

  test('Flow 3: Dashboard Navigation & CRM Win-Back', async () => {
    console.log('\n=== FLOW 3: DASHBOARD NAVIGATION & CRM ===\n');

    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();

    // Log in as tenant owner
    await page.goto('http://localhost:3000/login');
    console.log('[Step 1] Navigated to login');
    await page.screenshot({ path: 'flow3_01_login.png' });

    // Login
    const pass = await page.locator('input[type="password"], input[name="password"]').first();
    if (await pass.count() > 0) {
      await pass.fill('testpassword123');
    }

    const loginBtn = await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
    if (await loginBtn.count() > 0) {
      await loginBtn.click();
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'flow3_02_dashboard.png' });

    // Step 2: Check for bottom navigation bar
    const bottomNav = await page.locator('nav[role="navigation"], .bottom-nav, .mobile-nav, .nav-bottom, .fixed-bottom').first();
    if (await bottomNav.count() > 0) {
      console.log('[Step 2] OBSERVED: Bottom navigation bar found');
    } else {
      console.log('[Step 2] CHECK: No bottom navigation bar found');
    }

    // Step 3: Navigate to Home tab
    const homeTab = await page.locator('a[role="tab"], button[role="tab"], .nav-item:has-text("Home"), .bottom-nav a').first();
    if (await homeTab.count() > 0) {
      await homeTab.click();
      console.log('[Step 3] Clicked Home tab');
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'flow3_03_home_dashboard.png' });

    // Look for Win-Back widget
    const winBackWidget = await page.locator('text=Win-Back, text="Missing You", text="Inactive Customers", .win-back, .influencer, [data-winback]').first();
    if (await winBackWidget.count() > 0) {
      console.log('[Step 4] OBSERVED: Win-Back widget found');
    } else {
      console.log('[Step 4] CHECK: Win-Back widget not found');
    }

    // Step 5: Look for Send Win-Back button
    const winBackBtn = await page.locator('button:has-text("Send Win-Back"), button:has-text("Send"), [aria-label*="win"], .btn-send').first();
    if (await winBackBtn.count() > 0) {
      console.log('[Step 5] OBSERVED: Send Win-Back button found');
      await winBackBtn.screenshot({ path: 'flow3_05_winback_button.png' });
    }

    await context.close();
  });

  test('Flow 4: Inventory & Pulsing Alert', async () => {
    console.log('\n=== FLOW 4: INVENTORY & PULING ALERT ===\n');

    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();

    // Navigate to inventory page
    await page.goto('http://localhost:3000/inventory');
    console.log('[Step 1] Navigated to inventory');
    await page.screenshot({ path: 'flow4_01_inventory.png' });

    // Look for low stock indicators
    const lowStockBar = await page.locator('[data-low-stock], .low-stock, .warning, .alert-yellow, .bg-red').first();
    if (await lowStockBar.count() > 0) {
      console.log('[Step 2] OBSERVED: Low stock indicator found');
    } else {
      console.log('[Step 2] CHECK: Looking for low stock indicators...');
    }

    // Look for pulsing dot in bottom nav
    await page.goto('http://localhost:3000/dashboard');
    const pulsingDot = await page.locator('.animate-ping, .pulse, .pulse-dot, [class*="ping"], [class*="pulse"]').first();
    if (await pulsingDot.count() > 0) {
      console.log('[Step 4] OBSERVED: Pulsing animation found');
    }

    await page.screenshot({ path: 'flow4_02_inventory_check.png' });
    await context.close();
  });

  test('Flow 5: Velvet Rope Grace Period', async () => {
    console.log('\n=== FLOW 5: VELVET ROPE GRACE PERIOD ===\n');

    const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const page = await context.newPage();

    // This would require setting subscription status to 'grace'
    // For now, navigate and check for grace period indicators
    await page.goto('http://localhost:3000/dashboard');
    console.log('[Step 1] Navigated to dashboard');
    await page.screenshot({ path: 'flow5_01_dashboard.png' });

    // Look for AI Marketing Deck or Code Editor
    const proFeature = await page.locator('text=AI Marketing Deck, text="Code Editor", .feature-pro, .premium, [data-pro]').first();
    if (await proFeature.count() > 0) {
      console.log('[Step 3] Found Pro feature - checking for Velvet Rope...');

      // Look for overlay/backdrop
      const overlay = await page.locator('.backdrop, .overlay, .modal-backdrop, .grace-period, .faded').first();
      if (await overlay.count() > 0) {
        console.log('[Step 3] OBSERVED: Overlay/backdrop found');
      }

      // Look for Chapa/Renew button
      const renewBtn = await page.locator('button:has-text("Renew"), button:has-text("Chapa"), .btn-renew').first();
      if (await renewBtn.count() > 0) {
        console.log('[Step 4] OBSERVED: Renew via Chapa button found');
      }
    }

    await context.close();
  });

  test.afterAll(async () => {
    console.log('\n=== UX AUDIT COMPLETE ===\n');
  });
});
