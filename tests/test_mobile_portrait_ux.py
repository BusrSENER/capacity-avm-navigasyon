import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

def test_mobile_portrait_ux():
    console_errors = []

    with sync_playwright() as p:
        # iPhone 12/13/14 Portrait viewport (390 x 844)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== 1. TEST: LOAD PAGE IN PORTRAIT (390x844) & VERIFY MINIMIZED BOTTOM SHEET ===")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1.1 Verify bottom sheet is NOT expanded by default
        is_expanded = page.evaluate("document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        print(f"Bottom sheet initial is-expanded: {is_expanded}")
        assert is_expanded == False, "Bottom sheet should be collapsed/minimized by default on initial load"

        # 1.2 Verify search inputs and category pills ARE visible in minimized state
        start_visible = page.is_visible("#input-start-loc")
        target_visible = page.is_visible("#input-target-loc")
        cat_pills_visible = page.is_visible("#category-pills-row")
        print(f"Start input visible: {start_visible}, Target input visible: {target_visible}, Category pills visible: {cat_pills_visible}")
        assert start_visible == True, "'Nereden?' input must be visible in minimized bottom sheet"
        assert target_visible == True, "'Nereye?' input must be visible in minimized bottom sheet"
        assert cat_pills_visible == True, "Category pills row must be visible in minimized bottom sheet"

        # 1.3 Verify heavy store grid & tabs are COMPLETELY HIDDEN in minimized state
        grid_visible = page.is_visible("#sidebar-store-grid")
        tabs_visible = page.is_visible("#sidebar-tabs-container")
        header_visible = page.is_visible("#sidebar-header-row")
        print(f"Store grid visible: {grid_visible}, Tabs visible: {tabs_visible}, Header visible: {header_visible}")
        assert grid_visible == False, "Heavy store grid (173 stores) must be hidden in minimized state"
        assert tabs_visible == False, "Sidebar tabs container must be hidden in minimized state"
        assert header_visible == False, "Sidebar top logo/header must be hidden in minimized state"

        # 1.4 Verify visible height of bottom sheet from screen bottom
        sheet_box = page.locator("#sidebar-panel").bounding_box()
        print(f"Sidebar panel bounding box: {sheet_box}")
        assert sheet_box is not None, "Sidebar panel bounding box not found"
        # The visible portion from screen bottom (844 - y):
        visible_height = 844 - sheet_box["y"]
        print(f"Visible height of minimized sheet above bottom: {visible_height}px")
        # Should be compact (~150px - 180px), occupying only ~20% of screen, NOT 60%!
        assert 130 <= visible_height <= 200, f"Minimized sheet visible height should be ~150-180px, got {visible_height}px"

        page.screenshot(path="screenshot_portrait_minimized_sheet.png")
        print("Captured screenshot_portrait_minimized_sheet.png")

        print("=== 2. TEST: COMPACT FLOOR SELECTOR BAR (< 240px & > 30% REDUCTION) ===")
        floors_bar_box = page.locator(".floors-pill-bar").bounding_box()
        print(f"Floors pill bar bounding box: {floors_bar_box}")
        assert floors_bar_box is not None, "Floors pill bar bounding box not found"
        print(f"Floors bar height: {floors_bar_box['height']}px (previously ~330px)")
        # Height should be <= 235px (was ~330px, reduction is > 30%)
        assert floors_bar_box["height"] <= 235, f"Floors bar height should be compact (<= 235px), got {floors_bar_box['height']}px"

        # Check individual floor pill button dimensions
        pill_box = page.locator(".floor-pill[data-floor='4']").bounding_box()
        print(f"Floor pill 'Z' bounding box: {pill_box}")
        assert pill_box is not None, "Floor pill not found"
        assert pill_box["width"] <= 32 and pill_box["height"] <= 32, f"Floor pill should be <= 32x32px, got {pill_box['width']}x{pill_box['height']}px"

        print("=== 3. TEST: EXPAND BOTTOM SHEET ON SEARCH INPUT CLICK ===")
        page.click("#input-target-loc")
        page.wait_for_timeout(500)

        is_expanded_now = page.evaluate("document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        grid_visible_now = page.is_visible("#sidebar-store-grid")
        sheet_box_expanded = page.locator("#sidebar-panel").bounding_box()
        print(f"After search click: is-expanded={is_expanded_now}, store grid visible={grid_visible_now}")
        assert is_expanded_now == True, "Bottom sheet must expand when clicking search input"
        assert grid_visible_now == True, "Store grid must become visible when bottom sheet is expanded"
        assert sheet_box_expanded["y"] <= 250, f"Expanded sheet should move up to ~75vh, got y={sheet_box_expanded['y']}"

        page.screenshot(path="screenshot_portrait_expanded_sheet.png")
        print("Captured screenshot_portrait_expanded_sheet.png")

        # Collapse it back
        page.click("#btn-sheet-toggle")
        page.wait_for_timeout(400)
        is_collapsed_again = page.evaluate("!document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert is_collapsed_again == True, "Bottom sheet should collapse when clicking chevron toggle"

        print("=== 4. TEST: TOAST NOTIFICATION POSITIONING & AUTO-DISMISS ===")
        # Trigger the specific warning mentioned by user:
        page.evaluate("showToast('Bu katta aranan servis noktası bulunamadı.', 'warning')")
        page.wait_for_timeout(300)

        toast_visible = page.is_visible("#toast-container .border-amber-500\\/40")
        assert toast_visible == True, "Toast warning should be visible"

        toast_box = page.locator("#toast-container").bounding_box()
        print(f"Toast container bounding box: {toast_box}")
        assert toast_box is not None, "Toast container bounding box not found"
        # In portrait mode, toast should be in lower half of screen (above minimized sheet ~bottom 175px => y around 600-670px)
        # It must NOT be at the top (y < 100px)!
        print(f"Toast y-position: {toast_box['y']}px")
        assert toast_box["y"] > 450, f"Toast must appear above bottom sheet (y > 450px), not at top! Got y={toast_box['y']}"

        page.screenshot(path="screenshot_portrait_toast_warning.png")
        print("Captured screenshot_portrait_toast_warning.png")

        # Wait for auto-dismiss (3.2s + 300ms fade)
        print("Waiting for toast auto-dismiss...")
        page.wait_for_timeout(3600)
        toast_gone = page.evaluate("document.getElementById('toast-container').innerHTML === ''")
        print(f"Toast auto-dismissed: {toast_gone}")
        assert toast_gone == True, "Toast should automatically dismiss and disappear after ~3.2 seconds"

        print("=== 5. TEST: CONSOLE ERRORS CHECK ===")
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"Total console errors: {len(real_errors)}")
        if real_errors:
            print("Errors detected:", real_errors)
        assert len(real_errors) == 0, f"Found console errors: {real_errors}"

        browser.close()
        print("\n ALL MOBILE PORTRAIT UX TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    test_mobile_portrait_ux()
