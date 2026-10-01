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

        # 1. VERIFY OLD FLOATING VIEW TOGGLE IS COMPLETELY REMOVED / HIDDEN IN LANDSCAPE
        toggle_visible = page.is_visible("#floating-view-toggle")
        toggle_display = page.evaluate("window.getComputedStyle(document.getElementById('floating-view-toggle')).display")
        print(f"Floating view toggle visible: {toggle_visible}, display: '{toggle_display}'")
        assert toggle_visible == False, f"Floating view toggle should be completely hidden in landscape mode! Got is_visible={toggle_visible}"
        assert toggle_display == "none", f"Floating view toggle display should be 'none', got '{toggle_display}'"

        # 2. VERIFY APPLE MAPS STYLE HAMBURGER BUTTON IS VISIBLE AT TOP-LEFT
        hamb_visible = page.is_visible("#btn-sidebar-toggle")
        hamb_box = page.locator("#btn-sidebar-toggle").bounding_box()
        print(f"Hamburger button visible: {hamb_visible}, box: {hamb_box}")
        assert hamb_visible == True, "Hamburger drawer button (#btn-sidebar-toggle) should be visible in landscape mode!"
        assert hamb_box is not None, "Hamburger button box not found"
        assert hamb_box["x"] <= 15, f"Hamburger button should be at the left corner, got x={hamb_box['x']}"
        assert hamb_box["y"] <= 15, f"Hamburger button should be at the top corner, got y={hamb_box['y']}"

        # 3. VERIFY HEADER CARD IS MINIMIZED & SHIFTED TO THE RIGHT OF HAMBURGER BUTTON
        header_box = page.locator("#floor-header-card").bounding_box()
        print(f"Floor header card box: {header_box}")
        assert header_box is not None, "Floor header card not found"
        assert header_box["x"] >= 40, f"Floor header card should sit after hamburger button (x >= 40px), got {header_box['x']}"
        assert header_box["height"] <= 44, f"Floor header card should be compact (<= 44px), got {header_box['height']}"

        # 4. VERIFY MAP CONTAINER IS FULL SCREEN (100vw x 100vh/100dvh)
        map_box = page.locator("#main-map-area").bounding_box()
        print(f"Map container box: {map_box}")
        assert map_box is not None, "Map container not found"
        assert map_box["width"] >= 840, f"Map container should span full width (~844px), got {map_box['width']}"
        assert map_box["x"] == 0, f"Map container should start at x=0, got {map_box['x']}"

        # 5. VERIFY SIDEBAR PANEL IS INITIALLY OFF-SCREEN (TRANSLATE-X OUTSIDE)
        sidebar_visible = page.is_visible("#sidebar-panel")
        print(f"Initial sidebar panel visible: {sidebar_visible}")
        assert sidebar_visible == False, f"Sidebar should initially be off-screen/hidden in landscape, got {sidebar_visible}"

        # 6. TEST OPENING DRAWER VIA HAMBURGER BUTTON
        print("Clicking hamburger button to open drawer...")
        page.click("#btn-sidebar-toggle")
        page.wait_for_timeout(500)

        drawer_visible = page.is_visible("#sidebar-panel")
        drawer_box = page.locator("#sidebar-panel").bounding_box()
        backdrop_visible = page.is_visible("#landscape-drawer-backdrop")
        close_btn_visible = page.is_visible("#btn-sidebar-close")
        print(f"Drawer opened: visible={drawer_visible}, box={drawer_box}, backdrop={backdrop_visible}, close_btn={close_btn_visible}")

        assert drawer_visible == True, "Sidebar drawer should be visible after clicking hamburger toggle"
        assert drawer_box is not None and drawer_box["width"] <= 380, f"Sidebar drawer should be ~40vw/360px wide, got {drawer_box['width']}"
        assert backdrop_visible == True, "Landscape drawer backdrop should be visible when drawer is open"
        assert close_btn_visible == True, "Drawer close button (#btn-sidebar-close) should be visible"

        page.screenshot(path="screenshot_landscape_drawer_open.png")
        print("Captured screenshot_landscape_drawer_open.png")

        # 7. TEST CLOSING DRAWER VIA CLOSE BUTTON
        print("Clicking close button inside drawer...")
        page.click("#btn-sidebar-close")
        page.wait_for_timeout(400)

        drawer_closed = page.is_visible("#sidebar-panel")
        backdrop_closed = page.is_visible("#landscape-drawer-backdrop")
        print(f"Drawer closed: visible={drawer_closed}, backdrop={backdrop_closed}")
        assert drawer_closed == False, "Sidebar drawer should be hidden after closing"
        assert backdrop_closed == False, "Backdrop should be hidden after closing drawer"

        page.screenshot(path="screenshot_mobile_landscape_initial.png")
        print("Captured screenshot_mobile_landscape_initial.png")

        print("=== 2. TEST: MAP VERTICAL PAN & SETTLE BOUNDS (NO BOUNCE) ===")
        # Test that vertical pan stays where user panned and settleBounds does NOT snap back
        initial_pan_y = page.evaluate("mallMap.panY")
        print(f"Initial panY: {initial_pan_y}")

        # Pan Y up by 90px
        page.evaluate("""() => {
            mallMap.panY -= 90;
            mallMap.clampToBounds();
            mallMap.applyTransform();
        }""")
        panned_y = page.evaluate("mallMap.panY")
        print(f"Panned panY: {panned_y}")

        # Trigger settleBounds (which previously snapped back to center)
        page.evaluate("mallMap.settleBounds(150)")
        page.wait_for_timeout(350)
        settled_y = page.evaluate("mallMap.panY")
        print(f"Settled panY: {settled_y}")

        # In landscape, settled_y should stay close to panned_y, NOT snap back to initial_pan_y
        diff_from_panned = abs(settled_y - panned_y)
        diff_from_initial = abs(settled_y - initial_pan_y)
        print(f"Diff from panned: {diff_from_panned}, Diff from initial center: {diff_from_initial}")
        assert diff_from_panned < 10, f"Map bounced back! Expected settled panY near {panned_y}, got {settled_y}"

        print("=== 3. TEST: STORE SELECTION & COMPACT HORIZONTAL PEEK CARD ===")
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
        print(f"Peek card box: {peek_box}, flex-direction: '{peek_flex_dir}'")
        assert peek_flex_dir == "row", f"Peek card should have flex-direction: row, got '{peek_flex_dir}'"
        assert peek_box["height"] <= 65, f"Peek card height should be compact (<= 65px), got {peek_box['height']}"
        assert peek_box["width"] >= 500, f"Peek card should stretch horizontally, got {peek_box['width']}"

        # Verify buttons inside peek card
        assert page.is_visible("#btn-peek-start") == True, "Start button inside peek card should be visible"
        assert page.is_visible("#btn-peek-target") == True, "Target button inside peek card should be visible"
        assert page.is_visible("#btn-peek-close") == True, "Close button inside peek card should be visible"

        page.screenshot(path="screenshot_mobile_landscape_peek.png")
        print("Captured screenshot_mobile_landscape_peek.png")

        print("=== 4. TEST: ROUTE NAVIGATION & COMPACT HUD IN LANDSCAPE ===")
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
        print(f"Nav HUD bar visible: {hud_visible}, box: {hud_box}")
        assert hud_visible == True, "#nav-hud-bar should be visible"
        assert hud_box["height"] <= 52, f"HUD bar height should be compact (<= 52px), got {hud_box['height']}"

        # Verify Header Card in route state is also compact and has chips
        header_box_route = page.locator("#floor-header-card").bounding_box()
        print(f"Floor header card box during route: {header_box_route}")
        assert header_box_route["height"] <= 44, f"Floor header card during route should stay compact (<= 44px), got {header_box_route['height']}"

        page.screenshot(path="screenshot_mobile_landscape_route.png")
        print("Captured screenshot_mobile_landscape_route.png")

        print("=== 5. TEST: CONSOLE ERRORS CHECK ===")
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"Total console errors: {len(real_errors)}")
        if real_errors:
            print("Errors detected:", real_errors)
        assert len(real_errors) == 0, f"Found console errors: {real_errors}"

        browser.close()
        print("\n ALL PROFESSIONAL MOBILE LANDSCAPE E2E TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    test_mobile_landscape()
