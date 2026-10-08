import re
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

def test_launch_ux_and_ergonomics():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("[1] Testing Splash Screen Cinematic Route Reveal (3200ms)...")
        # Load page and immediately check splash elements
        t_start = time.time()
        page.goto("http://localhost:3000/")

        # Check splash elements exist
        splash = page.locator("#splash-screen")
        assert splash.is_visible(), "Splash screen should be visible immediately on load"
        
        route_line = page.locator("#splash-route-line")
        assert route_line.count() == 1, "Splash neon route line should exist in DOM"

        ripple = page.locator("#splash-ripple")
        assert ripple.count() == 1, "Splash center ripple effect should exist in DOM"

        brand_logo = page.locator("#splash-brand-logo")
        assert brand_logo.count() == 1, "Splash single nrdsor logo should exist in DOM"
        assert "splash-logo-reveal" in brand_logo.get_attribute("class"), "Brand logo should have reveal class"

        slide_bag = page.locator("#splash-slide-bag")
        assert slide_bag.count() == 1, "Splash sliding shopping bag should exist in DOM"

        # Check no horizontal overflow during splash animation
        overflow_x = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert not overflow_x, f"Splash animation should not cause horizontal scrollbar overflow: {overflow_x}"

        # Wait for splash screen to smoothly dismiss (~3.2s)
        splash.wait_for(state="detached", timeout=6000)
        t_elapsed = time.time() - t_start
        print(f"  Splash dismissed in {t_elapsed:.2f}s (target ~3.2s)")
        assert t_elapsed >= 2.5, f"Splash should stay for cinematic duration >= 2.5s, got {t_elapsed}s"

        print("[2] Verifying 100% Brand Logos Coverage & Store-Text Styles...")
        # Check BrandLogos dictionary in JS
        logo_stats = page.evaluate("""() => {
            const keys = Object.keys(window.BrandLogos || {});
            const requestedBrands = ['hotic', 'divarese', 'sochic', 'wcollection', 'kemaltanca', 'cacharel', 'suwen', 'marksandspencer'];
            const found = requestedBrands.filter(b => !!window.BrandLogos[b]);
            return {
                totalKeys: keys.length,
                requestedFound: found,
                missingRequested: requestedBrands.filter(b => !window.BrandLogos[b])
            };
        }""")
        print(f"  Total BrandLogos keys: {logo_stats['totalKeys']}")
        print(f"  Requested brands found: {logo_stats['requestedFound']}")
        assert len(logo_stats['missingRequested']) == 0, f"Missing requested brands: {logo_stats['missingRequested']}"
        assert logo_stats['totalKeys'] >= 100, "Should have rich logo library"

        # Check CSS rule for .store-text.no-logo
        css_check = page.evaluate("""() => {
            const testEl = document.createElement('span');
            testEl.className = 'store-text no-logo';
            document.body.appendChild(testEl);
            const style = window.getComputedStyle(testEl);
            const fs = style.fontSize;
            const color = style.fill || style.color;
            testEl.remove();
            return { fontSize: fs, color: color };
        }""")
        print(f"  .store-text.no-logo computed styles: {css_check}")
        assert css_check['fontSize'] == '9px', f"Expected font-size 9px, got {css_check['fontSize']}"

        print("[3] Testing Destination Reached (Hedefe Varış) Loop & Cleanup...")
        # Select Start (e.g. Zara) and Target (e.g. Sephora or Mavi)
        route_setup = page.evaluate("""() => {
            const all = window.getAllStores();
            const zStore = all.find(s => s.name.toLowerCase().includes('zara'));
            const targetStore = all.find(s => s.name.toLowerCase().includes('sephora') || s.name.toLowerCase().includes('mavi'));
            
            window.setStartLocation(zStore);
            window.setTargetLocation(targetStore);
            return {
                start: zStore ? zStore.name : null,
                target: targetStore ? targetStore.name : null
            };
        }""")
        print(f"  Configured Route: {route_setup['start']} -> {route_setup['target']}")
        page.wait_for_timeout(700)

        # Check route rendered
        has_route = page.evaluate("() => !!(window.cartSimulator && window.cartSimulator.activeRoute) && document.body.classList.contains('has-active-route')")
        assert has_route, "Active route should be calculated and has-active-route class set"

        # Trigger simulation finish (destination reached)
        page.evaluate("() => { window.cartSimulator.finish(); }")
        
        # Toast should appear
        toast = page.locator("#toast-container > div")
        assert toast.is_visible(timeout=3000), "Destination reached toast should appear"
        toast_text = toast.text_content()
        print(f"  Toast notification: '{toast_text}'")
        assert "Hedefe ulaştınız" in toast_text, "Toast should confirm destination reached"

        # Let the 1s fade-out complete
        page.wait_for_timeout(1200)

        # Verify:
        # A) Route line is cleared
        route_cleared = page.evaluate("() => !window.mallMap.routeLayer || window.mallMap.routeLayer.children.length === 0")
        assert route_cleared, "SVG route line should be cleared after 1s fade-out"

        # B) Shopping bag avatar is hidden
        bag_hidden = page.evaluate("() => !window.cartSimulator.cartEl || window.cartSimulator.cartEl.classList.contains('hidden')")
        assert bag_hidden, "Shopping bag avatar should be hidden after destination reached"

        # C) Start input updated to the reached store
        start_input_val = page.locator("#input-start-loc").input_value()
        print(f"  New Start Input Value: '{start_input_val}'")
        assert start_input_val == route_setup['target'], f"Start input should now be '{route_setup['target']}', got '{start_input_val}'"

        # D) Target input is cleared
        target_input_val = page.locator("#input-target-loc").input_value()
        print(f"  New Target Input Value: '{target_input_val}'")
        assert target_input_val == "", f"Target input should be empty, got '{target_input_val}'"

        # E) Focus slot should be 'target'
        active_focus = page.evaluate("() => window.activeFocusSlot")
        assert active_focus == "target", f"Active focus slot should be 'target', got '{active_focus}'"

        browser.close()

        print("[4] Testing Mobile Ergonomics (Two-Thumb Controls Layout)...")
        # Launch mobile viewport (iPhone 12/13/14: 390 x 844)
        mobile_browser = p.chromium.launch(headless=True)
        mobile_context = mobile_browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        m_page = mobile_context.new_page()

        m_page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        m_page.goto("http://localhost:3000/")
        # Wait for splash screen to dismiss
        m_page.locator("#splash-screen").wait_for(state="detached", timeout=6000)

        # Inspect positions of .zoom-bar, #btn-compass, and .floors-pill-bar
        controls_layout = m_page.evaluate("""() => {
            const zoom = document.querySelector('.zoom-bar').getBoundingClientRect();
            const compass = document.querySelector('#btn-compass').getBoundingClientRect();
            const floors = document.querySelector('.floors-pill-bar').getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            return {
                zoom: { left: zoom.left, right: zoom.right, top: zoom.top, bottom: zoom.bottom, width: zoom.width, height: zoom.height },
                compass: { left: compass.left, right: compass.right, top: compass.top, bottom: compass.bottom },
                floors: { left: floors.left, right: floors.right, top: floors.top, bottom: floors.bottom, width: floors.width },
                winW: winW,
                winH: winH
            };
        }""")
        print(f"  Mobile Viewport: {controls_layout['winW']}x{controls_layout['winH']}")
        print(f"  Zoom Bar Rect: {controls_layout['zoom']}")
        print(f"  Compass Rect: {controls_layout['compass']}")
        print(f"  Floors Bar Rect: {controls_layout['floors']}")

        # Verification A: Zoom (+/-) and Compass are on the LEFT (< 60px from left)
        assert controls_layout['zoom']['left'] < 30, f"Zoom bar should be anchored on the left side, got left={controls_layout['zoom']['left']}"
        assert controls_layout['compass']['left'] < 30, f"Compass should be anchored on the left side, got left={controls_layout['compass']['left']}"

        # Verification B: Floor selector is on the RIGHT (> winW - 60px)
        assert controls_layout['floors']['right'] > controls_layout['winW'] - 30, f"Floor bar should be on the right edge, got right={controls_layout['floors']['right']}"

        # Verification C: Zero horizontal overlap between Left and Right controls
        assert controls_layout['zoom']['right'] < controls_layout['floors']['left'], "Left zoom controls must not overlap floor switcher"

        # Verification D: Ergonomics - Zoom and Compass are vertically stacked in bottom-left
        assert controls_layout['zoom']['bottom'] > controls_layout['winH'] - 130, f"Zoom bar should be in the lower portion of screen, bottom={controls_layout['zoom']['bottom']}"

        # Verification E: Two-thumb interaction - Test tapping floor selector on the right and zoom on the left
        floor_1_btn = m_page.locator("button.floor-pill[data-floor='1']")
        floor_1_btn.click()
        m_page.wait_for_timeout(500)
        curr_floor = m_page.evaluate("() => window.mallMap.currentFloor")
        assert str(curr_floor) == "1", f"Floor should switch to '1', got {curr_floor}"

        zoom_in_btn = m_page.locator("#zoom-in-btn")
        zoom_in_btn.click()
        m_page.wait_for_timeout(300)

        mobile_browser.close()

    print("[5] Checking for Console Errors...")
    print(f"  Total Console Errors: {len(console_errors)}")
    if console_errors:
        print("  Errors:", console_errors)
    assert len(console_errors) == 0, f"Found {len(console_errors)} console errors: {console_errors}"

    print("ALL LAUNCH UX AND ERGONOMIC TESTS PASSED WITH 0 CONSOLE ERRORS!")

if __name__ == "__main__":
    test_launch_ux_and_ergonomics()
