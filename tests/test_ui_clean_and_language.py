import os
import sys
import time
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:3000"
ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_language_toggle():
    print("\n--- TEST 1: TR / EN LANGUAGE TOGGLE ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        page.goto(f"{BASE_URL}/index.html")
        page.wait_for_timeout(3200) # wait for splash dismiss

        start_input = page.locator("#input-start-loc")
        target_input = page.locator("#input-target-loc")
        lang_btn = page.locator("#lang-toggle-btn")

        # 1. Initial TR State
        assert "Nereden" in start_input.get_attribute("placeholder")
        assert "Nereye" in target_input.get_attribute("placeholder")
        print("✓ Initial state: Turkish placeholders confirmed")

        # 2. Toggle to EN
        lang_btn.click()
        page.wait_for_timeout(400)

        assert "From where" in start_input.get_attribute("placeholder"), f"Expected English start placeholder, got {start_input.get_attribute('placeholder')}"
        assert "To where" in target_input.get_attribute("placeholder"), f"Expected English target placeholder, got {target_input.get_attribute('placeholder')}"
        
        # Check amenity pills in EN
        wc_text = page.locator('button[data-amenity="wc"]').inner_text()
        assert "Restrooms" in wc_text, f"Expected Restrooms, got {wc_text}"
        baby_text = page.locator('button[data-amenity="baby"]').inner_text()
        assert "Baby Care" in baby_text, f"Expected Baby Care, got {baby_text}"
        
        # Check category pills in EN
        all_cat = page.locator('button[data-category="all"]').inner_text()
        assert "All" in all_cat, f"Expected All, got {all_cat}"

        print("✓ Toggled to English: Placeholders, Amenities, Categories successfully updated")

        # Screenshot EN state
        scr_en = os.path.join(ARTIFACT_DIR, "screenshot_ui_language_en.png")
        page.screenshot(path=scr_en)
        print(f"✓ Screenshot saved: {scr_en}")

        # 3. Toggle back to TR
        lang_btn.click()
        page.wait_for_timeout(400)

        assert "Nereden" in start_input.get_attribute("placeholder")
        assert "Nereye" in target_input.get_attribute("placeholder")
        wc_text_tr = page.locator('button[data-amenity="wc"]').inner_text()
        assert "Tuvalet" in wc_text_tr
        print("✓ Toggled back to Turkish: All labels restored")

        scr_tr = os.path.join(ARTIFACT_DIR, "screenshot_ui_language_tr.png")
        page.screenshot(path=scr_tr)
        print(f"✓ Screenshot saved: {scr_tr}")

        assert len(console_errors) == 0, f"Console errors: {console_errors}"
        browser.close()

def test_logos_across_floors():
    print("\n--- TEST 2: BRAND LOGOS ACROSS FLOORS (B1, B2, 1. KAT) ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        page.goto(f"{BASE_URL}/index.html")
        page.wait_for_timeout(3200)

        # 1. Floor 3 (B1 Katı) - Migros, The North Face, Koton, Teknosa, Adidas
        page.locator('.floor-pill[data-floor="3"]').click()
        page.wait_for_timeout(1000)
        
        tiles_f3 = page.locator("#markers-layer .logo-tile")
        count_f3 = tiles_f3.count()
        print(f"✓ Floor 3 (B1): Found {count_f3} rendered .logo-tile markers")
        assert count_f3 >= 5, f"Expected at least 5 brand logo tiles on B1, found {count_f3}"

        scr_b1 = os.path.join(ARTIFACT_DIR, "screenshot_floor_b1_logos.png")
        page.screenshot(path=scr_b1)
        print(f"✓ Screenshot saved: {scr_b1}")

        # 2. Floor 2 (B2 Katı) - Hibatech Oto Yıkama
        page.locator('.floor-pill[data-floor="2"]').click()
        page.wait_for_timeout(1000)

        tiles_f2 = page.locator("#markers-layer .logo-tile")
        count_f2 = tiles_f2.count()
        print(f"✓ Floor 2 (B2): Found {count_f2} rendered .logo-tile markers")
        assert count_f2 >= 1, f"Expected at least 1 brand logo tile on B2 (Hibatech), found {count_f2}"

        scr_b2 = os.path.join(ARTIFACT_DIR, "screenshot_floor_b2_logos.png")
        page.screenshot(path=scr_b2)
        print(f"✓ Screenshot saved: {scr_b2}")

        # 3. Floor 5 (1. Kat) - Zara, Bershka, Stradivarius, Oysho, Pull&Bear, Mango, Mavi, Sephora
        page.locator('.floor-pill[data-floor="5"]').click()
        page.wait_for_timeout(1000)

        tiles_f5 = page.locator("#markers-layer .logo-tile")
        count_f5 = tiles_f5.count()
        print(f"✓ Floor 5 (1. Kat): Found {count_f5} rendered .logo-tile markers")
        assert count_f5 >= 10, f"Expected at least 10 brand logo tiles on 1. Kat, found {count_f5}"

        scr_f1 = os.path.join(ARTIFACT_DIR, "screenshot_floor_1st_logos.png")
        page.screenshot(path=scr_f1)
        print(f"✓ Screenshot saved: {scr_f1}")

        assert len(console_errors) == 0, f"Console errors: {console_errors}"
        browser.close()

def test_nearest_amenity_algorithm_and_no_error_toasts():
    print("\n--- TEST 3: NEAREST AMENITY ALGORITHM & NO TOAST ERRORS ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        page.goto(f"{BASE_URL}/index.html")
        page.wait_for_timeout(3200)

        # Switch to Floor 2 (B2 - Otopark)
        page.locator('.floor-pill[data-floor="2"]').click()
        page.wait_for_timeout(1000)

        # Click "Bebek Odası" amenity chip
        # Floor 2 does not have a baby room, so it must find nearest (B1 / Floor 3 or Floor 4)
        baby_btn = page.locator('button[data-amenity="baby"]')
        baby_btn.click()
        page.wait_for_timeout(800)

        # Verify NO orange toast error appeared!
        toasts = page.locator(".toast, [id*='toast']")
        for i in range(toasts.count()):
            t_el = toasts.nth(i)
            if t_el.is_visible():
                text = t_el.inner_text()
                assert "bulunamadı" not in text.lower(), f"Unexpected error toast found: {text}"

        target_val = page.locator("#input-target-loc").input_value()
        print(f"✓ Nearest baby care room successfully set as target: '{target_val}'")
        assert len(target_val) > 0, "Target input should be populated with nearest baby room"
        assert "bebek" in target_val.lower(), f"Expected baby care room in target, got '{target_val}'"

        # Now test selecting a start location and verify NO guidance toast appears
        page.locator("#btn-quick-danisma").click()
        page.wait_for_timeout(500)
        start_val = page.locator("#input-start-loc").input_value()
        assert "Danışma" in start_val

        # Verify no "Lütfen hedef seçin" or "Lütfen başlangıç seçin" toasts
        for i in range(toasts.count()):
            t_el = toasts.nth(i)
            if t_el.is_visible():
                text = t_el.inner_text()
                assert "lütfen" not in text.lower(), f"Unwanted guidance toast found: {text}"
        print("✓ Verified complete removal of 'Başlangıç: ... Lütfen hedef seçin' guidance toast")

        scr_nearest = os.path.join(ARTIFACT_DIR, "screenshot_nearest_amenity_routed.png")
        page.screenshot(path=scr_nearest)
        print(f"✓ Screenshot saved: {scr_nearest}")

        assert len(console_errors) == 0, f"Console errors: {console_errors}"
        browser.close()

def test_parking_options_selection_and_route_line():
    print("\n--- TEST 4: PARKING MODAL RADIO SELECTION & REFINED ROUTE LINE ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        page.goto(f"{BASE_URL}/index.html")
        page.wait_for_timeout(3200)

        # 1. Open Parking Memory modal
        page.locator("#btn-parking-memory").click()
        page.wait_for_timeout(500)

        p_modal = page.locator("#parking-memory-modal")
        assert p_modal.is_visible(), "Parking memory modal should be visible"

        # 2. Test selecting color / zone
        yellow_btn = page.locator('button.parking-zone-btn[data-zone="Sarı"]')
        yellow_btn.click()
        page.wait_for_timeout(300)
        assert "active" in yellow_btn.get_attribute("class"), "Yellow zone button should have 'active' class"

        orange_btn = page.locator('button.parking-zone-btn[data-zone="Turuncu"]')
        orange_btn.click()
        page.wait_for_timeout(300)
        assert "active" in orange_btn.get_attribute("class"), "Orange zone button should have 'active' class"
        assert "active" not in yellow_btn.get_attribute("class"), "Yellow zone button should not be active"
        print("✓ Parking color selection verified: Turuncu selected and active")

        # 3. Test selecting floor
        p1_btn = page.locator('button.parking-floor-btn[data-code="P1"]')
        p1_btn.click()
        page.wait_for_timeout(300)
        assert "active" in p1_btn.get_attribute("class"), "P1 floor button should have 'active' class"
        print("✓ Parking floor selection verified: P1 (-1) selected and active")

        # 4. Fill pillar note and save
        pillar_input = page.locator("#parking-spot-pillar")
        pillar_input.fill("Direk S14")
        page.locator("#btn-parking-save").click()
        page.wait_for_timeout(500)

        assert not p_modal.is_visible(), "Parking modal should close after save"
        print("✓ Parking spot saved successfully to localStorage")

        # Screenshot parking saved
        page.locator("#btn-parking-memory").click()
        page.wait_for_timeout(500)
        assert page.locator("#parking-saved-card").is_visible(), "Saved parking card should be visible"
        assert "Turuncu" in page.locator("#parking-saved-location-title").inner_text()
        assert "S14" in page.locator("#parking-saved-pillar-text").inner_text()

        scr_parking = os.path.join(ARTIFACT_DIR, "screenshot_parking_modal_selected.png")
        page.screenshot(path=scr_parking)
        print(f"✓ Screenshot saved: {scr_parking}")
        page.locator("#btn-parking-modal-close").click()
        page.wait_for_timeout(300)

        # 5. Check route SVG path thickness (thinner, 3.5px neon)
        # Select start (Danisma) and target (Boyner or Zara)
        page.locator("#btn-quick-danisma").click()
        page.wait_for_timeout(400)
        page.evaluate("selectStore(getAllStores().find(s => s.name.includes('Zara')))")
        page.wait_for_timeout(500)
        page.locator("#btn-peek-target").click()
        page.wait_for_timeout(1000)

        # Verify route SVG is rendered
        route_line = page.locator("#route-svg .route__line")
        assert route_line.count() > 0, "Route line SVG should exist"
        computed_stroke = page.evaluate("() => window.getComputedStyle(document.querySelector('#route-svg .route__line')).strokeWidth")
        print(f"✓ Computed route stroke-width: {computed_stroke}")
        assert "3.5" in computed_stroke or "4" in computed_stroke or "3" in computed_stroke, f"Expected stroke-width ~3.5px, got {computed_stroke}"

        # Screenshot elegant route
        scr_route = os.path.join(ARTIFACT_DIR, "screenshot_thinner_neon_route.png")
        page.screenshot(path=scr_route)
        print(f"✓ Screenshot saved: {scr_route}")

        assert len(console_errors) == 0, f"Console errors: {console_errors}"
        browser.close()

if __name__ == "__main__":
    print("=================================================================")
    print("STARTING E2E PLAYWRIGHT TESTS: UI CLEANUP, LANGUAGE & ALGORITHMS")
    print("=================================================================")
    test_language_toggle()
    test_logos_across_floors()
    test_nearest_amenity_algorithm_and_no_error_toasts()
    test_parking_options_selection_and_route_line()
    print("\n=================================================================")
    print("ALL 4 E2E TESTS PASSED WITH 0 CONSOLE ERRORS!")
    print("=================================================================")
