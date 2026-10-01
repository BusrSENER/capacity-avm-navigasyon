import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_desktop_collapse_sidebar():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 1. Desktop Test (1280x800)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== 1. TEST: LOAD APP ON DESKTOP (1280x800) ===")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Initial Dimensions
        sidebar = page.locator("#sidebar-panel")
        main_map = page.locator("#main-map-area")

        assert sidebar.is_visible(), "Sidebar should be visible initially on desktop"
        initial_sb_box = sidebar.bounding_box()
        initial_map_box = main_map.bounding_box()

        print(f"Initial Sidebar Box: {initial_sb_box}")
        print(f"Initial Map Area Box: {initial_map_box}")

        assert initial_sb_box["width"] >= 340, f"Expected sidebar width >= 340px, got {initial_sb_box['width']}"
        assert initial_map_box["width"] < 1000, f"Expected map width < 1000px, got {initial_map_box['width']}"

        # Collapse Button Visibility
        collapse_btn = page.locator("#btn-collapse-sidebar")
        assert collapse_btn.is_visible(), "#btn-collapse-sidebar should be visible on desktop"

        # Toggle Button should be hidden initially on desktop
        toggle_btn = page.locator("#btn-sidebar-toggle")
        assert not toggle_btn.is_visible(), "#btn-sidebar-toggle should be hidden when sidebar is open"

        screenshot_initial = os.path.join(ARTIFACT_DIR, "screenshot_desktop_initial_with_sidebar.png")
        page.screenshot(path=screenshot_initial)
        print(f"Captured {screenshot_initial}")

        print("=== 2. TEST: CLICK COLLAPSE BUTTON [<] (DARALT) ===")
        collapse_btn.click()
        page.wait_for_timeout(600)  # wait for 300ms transition + 320ms resize event

        # Check body class
        has_collapsed_class = page.evaluate("document.body.classList.contains('sidebar-collapsed')")
        assert has_collapsed_class, "body should have 'sidebar-collapsed' class"

        # Check Sidebar Dimensions after collapse
        collapsed_sb_box = sidebar.bounding_box()
        print(f"Collapsed Sidebar Box: {collapsed_sb_box}")
        assert collapsed_sb_box["width"] == 0 or collapsed_sb_box["x"] + collapsed_sb_box["width"] <= 0, \
            f"Sidebar should be width 0 or off-screen, got {collapsed_sb_box}"

        # Check Map Area Dimensions after collapse
        collapsed_map_box = main_map.bounding_box()
        print(f"Collapsed Map Area Box: {collapsed_map_box}")
        assert collapsed_map_box["width"] >= 1270, \
            f"Map Area should expand to ~1280px (100vw), got {collapsed_map_box['width']}"
        assert collapsed_map_box["x"] <= 1, f"Map Area should start at left edge x=0, got {collapsed_map_box['x']}"

        # Check Toggle Button [☰] is now visible
        assert toggle_btn.is_visible(), "#btn-sidebar-toggle should be visible in collapsed mode"
        toggle_box = toggle_btn.bounding_box()
        print(f"Toggle Button Box: {toggle_box}")
        assert toggle_box["x"] <= 20 and toggle_box["y"] <= 20, f"Toggle button should be in top-left corner, got {toggle_box}"

        screenshot_fullscreen = os.path.join(ARTIFACT_DIR, "screenshot_desktop_fullscreen_map_collapsed.png")
        page.screenshot(path=screenshot_fullscreen)
        print(f"Captured {screenshot_fullscreen}")

        print("=== 3. TEST: CLICK OPEN BUTTON [☰] (MENÜYÜ AÇ) ===")
        toggle_btn.click()
        page.wait_for_timeout(600)

        # Check body class removed
        has_collapsed_class = page.evaluate("document.body.classList.contains('sidebar-collapsed')")
        assert not has_collapsed_class, "body should NOT have 'sidebar-collapsed' class after expanding"

        # Check Sidebar Restored
        restored_sb_box = sidebar.bounding_box()
        restored_map_box = main_map.bounding_box()
        print(f"Restored Sidebar Box: {restored_sb_box}")
        print(f"Restored Map Area Box: {restored_map_box}")

        assert restored_sb_box["width"] >= 340, f"Sidebar width should be restored, got {restored_sb_box['width']}"
        assert restored_map_box["width"] < 1000, f"Map Area width should return to split layout, got {restored_map_box['width']}"
        assert not toggle_btn.is_visible(), "Toggle button should be hidden again"

        screenshot_restored = os.path.join(ARTIFACT_DIR, "screenshot_desktop_restored_sidebar.png")
        page.screenshot(path=screenshot_restored)
        print(f"Captured {screenshot_restored}")

        print("=== 4. TEST: HEADER COLLAPSE BUTTON ALTERNATIVE ===")
        header_collapse_btn = page.locator("#btn-collapse-sidebar-header")
        assert header_collapse_btn.is_visible(), "Header collapse button should be visible on desktop"
        header_collapse_btn.click()
        page.wait_for_timeout(600)

        assert page.evaluate("document.body.classList.contains('sidebar-collapsed')"), "Header button should collapse sidebar"
        assert main_map.bounding_box()["width"] >= 1270, "Map Area should expand to 100vw via header button"

        # Restore again
        toggle_btn.click()
        page.wait_for_timeout(600)
        assert not page.evaluate("document.body.classList.contains('sidebar-collapsed')"), "Toggle button should restore"

        print("=== 5. TEST: MOBILE VIEWPORT (390x844) - COLLAPSE BTN MUST BE HIDDEN ===")
        mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        mobile_page = mobile_context.new_page()
        mobile_page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        mobile_page.on("pageerror", lambda err: console_errors.append(str(err)))

        mobile_page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        mobile_page.wait_for_timeout(800)

        m_collapse_btn = mobile_page.locator("#btn-collapse-sidebar")
        assert not m_collapse_btn.is_visible(), "Desktop collapse button must be HIDDEN on mobile"

        m_header_collapse_btn = mobile_page.locator("#btn-collapse-sidebar-header")
        assert not m_header_collapse_btn.is_visible(), "Desktop header collapse button must be HIDDEN on mobile"

        print("=== 6. CONSOLE ERRORS CHECK ===")
        print(f"Total console errors encountered: {len(console_errors)}")
        if console_errors:
            for err in console_errors:
                print(f"  [Console Error]: {err}")
        assert len(console_errors) == 0, f"Found {len(console_errors)} console errors: {console_errors}"

        print("\n ALL DESKTOP COLLAPSE SIDEBAR TESTS PASSED WITH 0 ERRORS! \n")
        browser.close()

if __name__ == "__main__":
    test_desktop_collapse_sidebar()
