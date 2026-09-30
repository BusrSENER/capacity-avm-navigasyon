import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

def test_mobile_landscape():
    console_errors = []

    with sync_playwright() as p:
        # iPhone 12/13/14 Landscape viewport (844 x 390)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 844, "height": 390},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== 1. TEST: LOAD PAGE IN LANDSCAPE (844x390) ===")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1. VERIFY SIDEBAR IS COMPLETELY HIDDEN
        sidebar_visible = page.is_visible("#sidebar-panel")
        sidebar_display = page.evaluate("window.getComputedStyle(document.getElementById('sidebar-panel')).display")
        print(f"Sidebar visible: {sidebar_visible}, display: '{sidebar_display}'")
        assert sidebar_visible == False, f"Sidebar should be hidden in landscape mode, but is_visible={sidebar_visible}"
        assert sidebar_display == "none", f"Sidebar display should be 'none', got '{sidebar_display}'"

        # 2. VERIFY MAP CONTAINER IS FULL WIDTH (100vw = 844px)
        map_box = page.locator("#main-map-area").bounding_box()
        print(f"Map container bounding box: {map_box}")
        assert map_box is not None, "Map container not found"
        assert map_box["width"] >= 840, f"Map container should span full width (~844px), got {map_box['width']}"
        assert map_box["x"] == 0, f"Map container should start at x=0, got {map_box['x']}"

        # 3. VERIFY FLOATING VIEW TOGGLE IN LANDSCAPE
        toggle_visible = page.is_visible("#floating-view-toggle")
        print(f"Floating view toggle visible: {toggle_visible}")
        assert toggle_visible == True, "Floating view toggle button should be visible in landscape mode"

        # Test opening bottom sheet via floating toggle
        page.click("#floating-view-toggle")
        page.wait_for_timeout(400)
        sheet_expanded = page.evaluate("document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        sheet_visible = page.is_visible("#sidebar-panel")
        print(f"Bottom sheet after clicking toggle: expanded={sheet_expanded}, visible={sheet_visible}")
        assert sheet_expanded == True and sheet_visible == True, "Bottom sheet should expand and be visible"

        # Close bottom sheet via chevron toggle on handle bar
        page.click("#btn-sheet-toggle")
        page.wait_for_timeout(400)
        sidebar_hidden_again = page.is_visible("#sidebar-panel")
        print(f"Bottom sheet closed again: is_visible={sidebar_hidden_again}")
        assert sidebar_hidden_again == False, "Bottom sheet should be hidden after closing"

        # Capture initial landscape screen
        page.screenshot(path="screenshot_mobile_landscape_initial.png")
        print("Captured screenshot_mobile_landscape_initial.png")

        print("=== 2. TEST: STORE SELECTION & COMPACT HORIZONTAL PEEK CARD ===")
        # Select a store (e.g. Faik Sönmez or Cookshop)
        page.evaluate("""() => {
            const store = getAllStores().find(s => s.name.includes('Faik') || s.name.includes('Twist') || s.id === 'store_4_8');
            if (store) selectStore(store);
        }""")
        page.wait_for_timeout(600)

        # Check peek card visibility
        peek_visible = page.is_visible("#poi-peek-card")
        assert peek_visible == True, "#poi-peek-card should be visible after store selection"

        # Check peek card styling (flex-row, compact max-height <= 65px)
        peek_box = page.locator("#poi-peek-card").bounding_box()
        peek_flex_dir = page.evaluate("window.getComputedStyle(document.getElementById('poi-peek-card')).flexDirection")
        print(f"Peek card bounding box: {peek_box}, flex-direction: '{peek_flex_dir}'")
        assert peek_flex_dir == "row", f"Peek card should have flex-direction: row, got '{peek_flex_dir}'"
        assert peek_box["height"] <= 65, f"Peek card height should be compact (<= 65px), got {peek_box['height']}"
        assert peek_box["width"] >= 500, f"Peek card should stretch horizontally, got {peek_box['width']}"

        # Verify buttons inside peek card
        assert page.is_visible("#btn-peek-start") == True, "Start button inside peek card should be visible"
        assert page.is_visible("#btn-peek-target") == True, "Target button inside peek card should be visible"
        assert page.is_visible("#btn-peek-close") == True, "Close button inside peek card should be visible"

        page.screenshot(path="screenshot_mobile_landscape_peek.png")
        print("Captured screenshot_mobile_landscape_peek.png")

        print("=== 3. TEST: ROUTE NAVIGATION & COMPACT HUD IN LANDSCAPE ===")
        # Set start to Danışma and target to selected store
        page.evaluate("""() => {
            const start = mallData.entrances.find(e => e.id === 'ent_danisma');
            const target = getAllStores().find(s => s.id === 'store_4_8' || s.name.includes('Cookshop'));
            if (start && target) {
                setStartLocation(start);
                setTargetLocation(target);
            }
        }""")
        page.wait_for_timeout(1000)

        # Verify route active
        has_route = page.evaluate("mallMap.activeRoute !== null")
        assert has_route == True, "Route should be active"

        # Verify HUD bar is visible and compact (height <= 52px)
        hud_visible = page.is_visible("#nav-hud-bar")
        hud_box = page.locator("#nav-hud-bar").bounding_box()
        print(f"Nav HUD bar visible: {hud_visible}, bounding box: {hud_box}")
        assert hud_visible == True, "#nav-hud-bar should be visible"
        assert hud_box["height"] <= 52, f"HUD bar height should be compact (<= 52px), got {hud_box['height']}"

        # Verify Header Card is compact
        header_box = page.locator("#floor-header-card").bounding_box()
        print(f"Floor header card bounding box: {header_box}")
        assert header_box is not None, "Header card not found"

        page.screenshot(path="screenshot_mobile_landscape_route.png")
        print("Captured screenshot_mobile_landscape_route.png")

        print("=== 4. TEST: CONSOLE ERRORS CHECK ===")
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"Total console errors: {len(real_errors)}")
        if real_errors:
            print("Errors detected:", real_errors)
        assert len(real_errors) == 0, f"Found console errors: {real_errors}"

        browser.close()
        print("\n ALL MOBILE LANDSCAPE E2E TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    test_mobile_landscape()
