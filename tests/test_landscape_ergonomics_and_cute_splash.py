import sys
import os
import time
import shutil
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_landscape_and_cute_splash():
    console_errors = []

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # TEST 1: SPLASH SCREEN (CUTE BAG ANIMATION & NO GLOW/NEON)
        # -------------------------------------------------------------
        print("\n--- 1. TESTING CUTE 2-LEGGED BAG SPLASH (NO NEON / GLOW) ---")
        context_splash = browser.new_context(viewport={"width": 390, "height": 844})
        page_splash = context_splash.new_page()
        page_splash.on("console", lambda msg: console_errors.append(f"Splash: {msg.text}") if msg.type == "error" else None)
        page_splash.on("pageerror", lambda exc: console_errors.append(f"Splash error: {str(exc)}"))

        start_time = time.time()
        page_splash.goto("http://localhost:3000")

        # Verify immediately visible elements
        splash = page_splash.locator("#splash-screen")
        assert splash.is_visible(), "Splash screen should be visible initially"

        # Verify NO neon/glow elements exist in DOM
        assert page_splash.locator("#splash-route-line").count() == 0, "No neon route line should exist in splash"
        assert page_splash.locator("#splash-ripple").count() == 0, "No glow ripple should exist in splash"
        assert page_splash.locator(".blur-3xl").count() == 0, "No ambient blur/halo should exist in splash"

        # Verify 2 legs exist on the shopping bag SVG
        leg_l = page_splash.locator(".splash-leg-left")
        leg_r = page_splash.locator(".splash-leg-right")
        assert leg_l.count() > 0, "Left leg should exist on cute shopping bag"
        assert leg_r.count() > 0, "Right leg should exist on cute shopping bag"

        # Verify question mark '?' and exclamation '!' badges exist
        badge_q = page_splash.locator("#splash-badge-question")
        badge_excl = page_splash.locator("#splash-badge-exclamation")
        assert badge_q.count() > 0 and badge_q.inner_text() == "?", "Question mark '?' badge should exist"
        assert badge_excl.count() > 0 and badge_excl.inner_text() == "!", "Exclamation mark '!' badge should exist"

        # Take screenshot during animation
        scr_splash = "screenshot_cute_splash_running_bag.png"
        page_splash.screenshot(path=scr_splash)
        print(f"Captured splash screenshot: {scr_splash}")
        if os.path.exists(scr_splash):
            shutil.copy(scr_splash, os.path.join(ARTIFACT_DIR, scr_splash))

        # Wait for splash screen to smoothly fade out (around ~3.0s - 3.4s)
        splash.wait_for(state="detached", timeout=6000)
        elapsed = time.time() - start_time
        print(f"Splash dismissed in {elapsed:.2f}s (target ~3.0s)")
        assert elapsed >= 2.8, f"Expected splash duration >= 2.8s, got {elapsed:.2f}s"
        context_splash.close()
        print("PASS: Cute shopping bag splash animation verified.")

        # -------------------------------------------------------------
        # TEST 2: PORTRAIT VIEWPORT & ERGONOMICS (max-width: 768px)
        # -------------------------------------------------------------
        print("\n--- 2. TESTING PORTRAIT ZOOM & COMPASS DOCKED POSITION ---")
        context_portrait = browser.new_context(viewport={"width": 390, "height": 844})
        page_portrait = context_portrait.new_page()
        page_portrait.on("console", lambda msg: console_errors.append(f"Portrait: {msg.text}") if msg.type == "error" else None)
        page_portrait.on("pageerror", lambda exc: console_errors.append(f"Portrait error: {str(exc)}"))

        page_portrait.goto("http://localhost:3000")
        page_portrait.wait_for_timeout(3400) # Wait for splash dismiss

        zoom_bar = page_portrait.locator(".zoom-bar")
        compass_btn = page_portrait.locator("#btn-compass")
        assert zoom_bar.is_visible()
        assert compass_btn.is_visible()

        zoom_box = zoom_bar.bounding_box()
        compass_box = compass_btn.bounding_box()

        # Check portrait specifications:
        # zoom-bar: bottom: 72px; left: 12px; z-index: 35
        # btn-compass: bottom: 165px; left: 12px; z-index: 35
        v_height = 844
        zoom_bottom = v_height - (zoom_box['y'] + zoom_box['height'])
        compass_bottom = v_height - (compass_box['y'] + compass_box['height'])
        print(f"Portrait Zoom bar bottom distance: {zoom_bottom:.1f}px (target 72px, left: {zoom_box['x']})")
        print(f"Portrait Compass bottom distance: {compass_bottom:.1f}px (target 165px, left: {compass_box['x']})")

        assert abs(zoom_box['x'] - 12) <= 4, f"Zoom bar left should be ~12px, got {zoom_box['x']}"
        assert abs(compass_box['x'] - 12) <= 4, f"Compass left should be ~12px, got {compass_box['x']}"
        assert abs(zoom_bottom - 72) <= 4, f"Zoom bar bottom should be ~72px, got {zoom_bottom}"
        assert abs(compass_bottom - 165) <= 5, f"Compass bottom should be ~165px, got {compass_bottom}"

        # Test clickability in portrait mode (no intercept errors)
        print("Testing clickability of Zoom In, Zoom Out, and Compass in portrait...")
        page_portrait.locator("#zoom-in-btn").click()
        page_portrait.wait_for_timeout(100)
        page_portrait.locator("#zoom-out-btn").click()
        page_portrait.wait_for_timeout(100)
        compass_btn.click()
        page_portrait.wait_for_timeout(100)
        print("PASS: Portrait buttons are clickable with zero errors.")

        scr_portrait = "screenshot_portrait_docked_zoom_compass.png"
        page_portrait.screenshot(path=scr_portrait)
        if os.path.exists(scr_portrait):
            shutil.copy(scr_portrait, os.path.join(ARTIFACT_DIR, scr_portrait))
        context_portrait.close()

        # -------------------------------------------------------------
        # TEST 3: LANDSCAPE VIEWPORT & CONTROLS (orientation: landscape, height: 390px)
        # -------------------------------------------------------------
        print("\n--- 3. TESTING LANDSCAPE VIEWPORT, ROW CONTROLS & COMPACT HEADER ---")
        context_landscape = browser.new_context(viewport={"width": 844, "height": 390})
        page_landscape = context_landscape.new_page()
        page_landscape.on("console", lambda msg: console_errors.append(f"Landscape: {msg.text}") if msg.type == "error" else None)
        page_landscape.on("pageerror", lambda exc: console_errors.append(f"Landscape error: {str(exc)}"))

        page_landscape.goto("http://localhost:3000")
        page_landscape.wait_for_timeout(3400) # Wait for splash dismiss

        # 1. Test #floor-header-card in landscape
        header_card = page_landscape.locator("#floor-header-card")
        assert header_card.is_visible()
        card_box = header_card.bounding_box()
        print(f"Landscape Floor Header Card: top={card_box['y']}px, height={card_box['height']}px")
        assert card_box['y'] <= 12, f"Header card top should be <= 12px, got {card_box['y']}"
        assert card_box['height'] <= 46, f"Header card height should be compact (<= 46px), got {card_box['height']}"

        # Check route corridor preference buttons inside card when route is planned
        page_landscape.evaluate("""() => {
            const all = window.getAllStores();
            const zStore = all.find(s => s.name.toLowerCase().includes('zara'));
            const targetStore = all.find(s => s.name.toLowerCase().includes('mavi'));
            window.setStartLocation(zStore);
            window.setTargetLocation(targetStore);
        }""")
        page_landscape.wait_for_timeout(600)

        # Check that long texts are hidden and only small icons are shown in landscape chips
        chip_wide_text = page_landscape.evaluate("""() => {
            const chip = document.getElementById('chip-path-wide');
            const textSpan = chip.querySelector('span:not(.text-sm)');
            return textSpan ? window.getComputedStyle(textSpan).display : 'none';
        }""")
        print(f"Landscape Chip long text display: {chip_wide_text}")
        assert chip_wide_text == 'none', "Long text in corridor chips should be hidden in landscape"

        # 2. Test Landscape Bottom-Left Row Controls (Compass + Zoom)
        ls_compass = page_landscape.locator("#btn-compass")
        ls_zoom = page_landscape.locator(".zoom-bar")
        assert ls_compass.is_visible()
        assert ls_zoom.is_visible()

        ls_compass_box = ls_compass.bounding_box()
        ls_zoom_box = ls_zoom.bounding_box()

        print(f"Landscape Compass: box={ls_compass_box}")
        print(f"Landscape Zoom Bar: box={ls_zoom_box}")

        # Assert compass size ~28px and bottom ~10px
        ls_h = 390
        compass_dist_bottom = ls_h - (ls_compass_box['y'] + ls_compass_box['height'])
        zoom_dist_bottom = ls_h - (ls_zoom_box['y'] + ls_zoom_box['height'])

        assert abs(ls_compass_box['width'] - 28) <= 4, f"Compass width should be ~28px, got {ls_compass_box['width']}"
        assert abs(ls_compass_box['height'] - 28) <= 4, f"Compass height should be ~28px, got {ls_compass_box['height']}"
        assert abs(ls_compass_box['x'] - 10) <= 4, f"Compass left should be ~10px, got {ls_compass_box['x']}"
        assert abs(compass_dist_bottom - 10) <= 5, f"Compass bottom distance should be ~10px, got {compass_dist_bottom}"

        # Assert zoom bar is in a horizontal row right next to compass
        assert ls_zoom_box['x'] >= ls_compass_box['x'] + ls_compass_box['width'], "Zoom bar should be placed horizontally to the right of compass"
        assert abs(zoom_dist_bottom - 10) <= 5, f"Zoom bar bottom distance should be ~10px, got {zoom_dist_bottom}"
        assert ls_zoom_box['width'] > ls_zoom_box['height'], "Zoom bar should be arranged horizontally (width > height)"

        # Check button size in zoom bar ~28px
        zoom_in_box = page_landscape.locator("#zoom-in-btn").bounding_box()
        assert abs(zoom_in_box['width'] - 28) <= 4, f"Zoom In button width should be ~28px, got {zoom_in_box['width']}"

        # Test clicking compass and zoom in landscape mode (no interception)
        print("Testing clickability of Zoom In, Zoom Out, and Compass in landscape...")
        page_landscape.locator("#zoom-in-btn").click()
        page_landscape.wait_for_timeout(100)
        page_landscape.locator("#zoom-out-btn").click()
        page_landscape.wait_for_timeout(100)
        ls_compass.click()
        page_landscape.wait_for_timeout(100)
        print("PASS: Landscape controls are clickable and responsive!")

        scr_landscape = "screenshot_landscape_horizontal_controls.png"
        page_landscape.screenshot(path=scr_landscape)
        if os.path.exists(scr_landscape):
            shutil.copy(scr_landscape, os.path.join(ARTIFACT_DIR, scr_landscape))

        context_landscape.close()
        browser.close()

    print(f"\nTotal Console errors: {len(console_errors)}")
    assert len(console_errors) == 0, f"Expected 0 console errors, got: {console_errors}"
    print("ALL LANDSCAPE VIEWPORT, ZOOM ERGONOMICS AND CUTE SPLASH TESTS PASSED!")

if __name__ == "__main__":
    test_landscape_and_cute_splash()
