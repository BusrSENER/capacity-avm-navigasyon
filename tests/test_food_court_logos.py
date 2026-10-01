import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_food_court_logos_and_category():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== 1. TEST: LOAD APP & SWITCH TO 2. KAT (FLOOR 6 FOOD COURT) ===")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Switch to Floor 6 (2. Kat: Sinema & Yeme-İçme)
        floor6_btn = page.locator('.floor-pill[data-floor="6"]')
        assert floor6_btn.count() > 0, "Floor 6 button not found"
        floor6_btn.click()
        page.wait_for_timeout(1500)

        current_floor = page.evaluate("mallMap.currentFloor")
        assert current_floor == 6, f"Expected floor 6, got {current_floor}"
        print(f"Current floor is confirmed: {current_floor} (2. Kat)")

        print("=== 2. TEST: VERIFY 2. KAT BRAND LOGOS IN DOM (.logo-tile) ===")
        # Check that logo markers are rendered
        logo_tiles = page.locator("#markers-layer .logo-tile")
        count = logo_tiles.count()
        print(f"Total .logo-tile elements rendered on Floor 6: {count}")
        assert count >= 15, f"Expected at least 15 logo tiles on Floor 6, found {count}"

        # Test specific requested brand logos
        requested_brands = [
            "Arby's", "Burger King", "HD İskender", "KFC", "Köfteci Ramiz",
            "Popeyes", "Tavuk Dünyası", "Günaydın", "Doyuyo", "Dürümle",
            "Özsüt", "Pidem", "Terra Pizza", "D&R"
        ]

        for brand in requested_brands:
            has_logo = page.evaluate("b => window.hasBrandLogo({ name: b })", brand)
            assert has_logo, f"Brand logo check failed for {brand}"
            print(f"  [OK] Brand logo recognized: {brand}")

        # Verify markers exist in DOM for key stores
        hd_marker = page.locator('.logo-tile-marker[data-store-id="store_6_12"]')
        assert hd_marker.count() > 0, "HD İskender marker element not found in DOM"

        bk_marker = page.locator('.logo-tile-marker[data-store-id="store_6_2"]')
        assert bk_marker.count() > 0, "Burger King marker element not found in DOM"

        kfc_marker = page.locator('.logo-tile-marker[data-store-id="store_6_13"]')
        assert kfc_marker.count() > 0, "KFC marker element not found in DOM"

        screenshot_f6_path = os.path.join(ARTIFACT_DIR, "screenshot_floor_2_food_court_logos.png")
        page.screenshot(path=screenshot_f6_path)
        print(f"Captured {screenshot_f6_path}")

        print("=== 3. TEST: HD İSKENDER SELECTION & CATEGORY BADGE VERIFICATION ===")
        # Click HD İskender marker or polygon
        hd_marker.click()
        page.wait_for_timeout(800)

        # Check Desktop Sidebar POI detail card
        sidebar_name = page.locator("#poi-name").text_content()
        sidebar_cat = page.locator("#poi-category").text_content()
        print(f"Sidebar Store Name: '{sidebar_name}', Category Badge: '{sidebar_cat}'")

        assert "HD İskender" in sidebar_name or "İskender" in sidebar_name, f"Expected HD İskender, got {sidebar_name}"
        assert sidebar_cat.strip() != "Moda", f"HD İskender category must NOT be 'Moda'! Got '{sidebar_cat}'"
        assert sidebar_cat.strip() in ["Yeme & İçme", "Restoran"], f"Expected 'Yeme & İçme' or 'Restoran', got '{sidebar_cat}'"

        screenshot_hd_selected = os.path.join(ARTIFACT_DIR, "screenshot_hd_iskender_selected_desktop.png")
        page.screenshot(path=screenshot_hd_selected)
        print(f"Captured {screenshot_hd_selected}")

        print("=== 4. TEST: CATEGORY FILTERING ('Yeme & İçme') ===")
        food_pill = page.locator('.cat-pill[data-category="food"]')
        assert food_pill.count() > 0, "Food category pill not found"
        food_pill.click()
        page.wait_for_timeout(600)

        # Verify active class on pill
        is_active = page.evaluate("document.querySelector('.cat-pill[data-category=\"food\"]').classList.contains('active')")
        assert is_active, "Food pill should have active class"

        # Check stores in sidebar list
        store_items = page.locator("#sidebar-store-grid .store-card")
        store_count = store_items.count()
        print(f"Filtered store list items count for 'Yeme & İçme': {store_count}")
        assert store_count > 0, "Expected at least 1 food store in list"

        screenshot_food_filter = os.path.join(ARTIFACT_DIR, "screenshot_food_filter_active.png")
        page.screenshot(path=screenshot_food_filter)
        print(f"Captured {screenshot_food_filter}")

        print("=== 5. TEST: MOBILE PORTRAIT VIEW (390x844) & PEEK CARD ===")
        # Open mobile context
        mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        mobile_page = mobile_context.new_page()
        mobile_page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        mobile_page.on("pageerror", lambda err: console_errors.append(str(err)))

        mobile_page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        mobile_page.wait_for_timeout(1000)

        # Switch to Floor 6 on mobile
        mobile_page.locator('.floor-pill[data-floor="6"]').click()
        mobile_page.wait_for_timeout(1500)

        # Click HD İskender marker
        m_hd = mobile_page.locator('.logo-tile-marker[data-store-id="store_6_12"]')
        assert m_hd.count() > 0, "HD marker on mobile not found"
        m_hd.click()
        mobile_page.wait_for_timeout(800)

        # Check peek card
        peek_card = mobile_page.locator("#poi-peek-card")
        assert peek_card.is_visible(), "Mobile peek card should be visible"

        peek_name = mobile_page.locator("#peek-store-name").text_content()
        peek_cat = mobile_page.locator("#peek-category-badge").text_content()
        print(f"Mobile Peek Card Name: '{peek_name}', Category Badge: '{peek_cat}'")

        assert "HD İskender" in peek_name, f"Expected HD İskender, got {peek_name}"
        assert peek_cat.strip() != "Moda", f"Mobile peek card must NOT say 'Moda'! Got '{peek_cat}'"
        assert peek_cat.strip() in ["Yeme & İçme", "Restoran"], f"Expected 'Yeme & İçme' or 'Restoran', got '{peek_cat}'"

        screenshot_mobile_peek = os.path.join(ARTIFACT_DIR, "screenshot_mobile_hd_iskender_peek.png")
        mobile_page.screenshot(path=screenshot_mobile_peek)
        print(f"Captured {screenshot_mobile_peek}")

        print("=== 6. CONSOLE ERRORS CHECK ===")
        print(f"Total console errors encountered: {len(console_errors)}")
        if console_errors:
            for err in console_errors:
                print(f"  [Console Error]: {err}")
        assert len(console_errors) == 0, f"Found {len(console_errors)} console errors: {console_errors}"

        print("\n ALL FOOD COURT LOGO & CATEGORY TESTS PASSED WITH 0 ERRORS! \n")
        browser.close()

if __name__ == "__main__":
    test_food_court_logos_and_category()
