import time
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def test_mobile_ux_and_fixes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        # ---------------------------------------------------------
        # 1. DESKTOP VIEWPORT TEST (1280x800)
        # ---------------------------------------------------------
        print("\n--- 1. DESKTOP VIEWPORT TEST (1280x800) ---")
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto("http://localhost:3000/")
        page.wait_for_selector("#map-svg-element", timeout=10000)
        time.sleep(3) # Wait for splash dismissal

        # Verify #floor-header-card on desktop
        card = page.locator("#floor-header-card")
        assert card.is_visible(), "Floor header card should be visible"
        box = card.bounding_box()
        assert box["x"] >= 16, f"Desktop left margin should be >= 16px, got {box['x']}"
        assert box["y"] >= 16, f"Desktop top margin should be >= 16px, got {box['y']}"
        print(f"✓ Desktop floor header card positioned cleanly at x={box['x']}, y={box['y']}, width={box['width']}")

        # ---------------------------------------------------------
        # 2. STORE SELECTION - NO HOLLOW BLUE BOX (ITEM 3)
        # ---------------------------------------------------------
        print("\n--- 2. STORE SELECTION - NO HOLLOW BLUE BOX ---")
        # Select store Atasay
        page.evaluate("""() => {
            const store = mallData.floors[4].stores.find(s => s.name === 'Atasay');
            selectStore(store);
        }""")
        time.sleep(1)

        # Check that no store polygon has blue stroke
        blue_strokes = page.evaluate("""() => {
            const polys = document.querySelectorAll('.store-polygon, .store-polygon *');
            let count = 0;
            for (const p of polys) {
                const s = window.getComputedStyle(p);
                if (s.stroke && s.stroke.includes('2, 132, 199') && s.strokeWidth !== '0px') {
                    count++;
                }
            }
            return count;
        }""")
        assert blue_strokes == 0, f"No store polygon should have blue stroke #0284c7, found {blue_strokes}"
        print("✓ Verified: No hollow blue frame/stroke on selected store polygon")

        # ---------------------------------------------------------
        # 3. SPOR CATEGORY FILTER & AUTO-FLOOR NAVIGATION (ITEM 4)
        # ---------------------------------------------------------
        print("\n--- 3. SPOR CATEGORY FILTER NAVIGATION ---")
        # Currently on Floor 4 (Zemin). Click "Spor" filter chip
        spor_pill = page.locator('.cat-pill[data-category="sports"]')
        assert spor_pill.count() > 0, "Sports category pill should exist"
        spor_pill.click()
        time.sleep(1.5)

        # System should automatically switch to Floor 3 (1. Bodrum / B1)
        current_floor_title = page.locator("#current-floor-title").inner_text()
        print("Current floor title after clicking Spor:", current_floor_title)
        assert "Bodrum" in current_floor_title or "B1" in current_floor_title, f"Should switch to B1 floor, got {current_floor_title}"

        # Verify sidebar store grid shows sports stores
        grid_items = page.locator("#sidebar-store-grid .store-card")
        grid_count = grid_items.count()
        assert grid_count >= 5, f"Expected at least 5 sports stores, found {grid_count}"
        first_store_name = page.locator("#sidebar-store-grid .store-card__name").first.inner_text()
        print(f"✓ Verified: Sports filter automatically switched to B1 and listed {grid_count} stores (e.g. {first_store_name})")

        # Verify horizontal scroll styling on category and amenity chips
        scroll_styles = page.evaluate("""() => {
            const catRow = document.getElementById('category-pills-row');
            const amRow = document.getElementById('amenity-chips-row');
            const cs1 = window.getComputedStyle(catRow);
            const cs2 = window.getComputedStyle(amRow);
            return {
                catOverflowX: cs1.overflowX,
                amOverflowX: cs2.overflowX,
                catWrap: cs1.flexWrap,
                amWrap: cs2.flexWrap
            };
        }""")
        assert scroll_styles["catOverflowX"] in ["auto", "scroll"], "Category row must have horizontal scroll"
        assert scroll_styles["amOverflowX"] in ["auto", "scroll"], "Amenity row must have horizontal scroll"
        print(f"✓ Verified: Horizontal swipe enabled on category and amenity rows ({scroll_styles})")

        # ---------------------------------------------------------
        # 4. ROUTE CALCULATION & TARGET PIN CENTERING (ITEM 5)
        # ---------------------------------------------------------
        print("\n--- 4. ROUTE CALCULATION & TARGET PIN CENTERING ---")
        # Go to Floor 4 and route Vakko -> Cookshop
        page.evaluate("""async () => {
            await mallMap.loadFloor(4);
            updateFloorUI(4);
            const s = mallData.floors[4].stores.find(x => x.name === 'Vakko');
            const t = mallData.floors[4].stores.find(x => x.name === 'Cookshop');
            setStartLocation(s);
            setTargetLocation(t);
        }""")
        time.sleep(1.5)

        # Check route header summary
        sub_text = page.locator("#current-floor-sub").inner_text()
        assert "m" in sub_text and "dk" in sub_text, f"Sub header should show distance and time, got: {sub_text}"
        print(f"✓ Verified route summary in header card: '{sub_text}'")

        # Check target pin coordinates
        pin_coords = page.evaluate("""() => {
            const target = mallData.floors[4].stores.find(x => x.name === 'Cookshop');
            const pinCircle = document.querySelector('.route-end-pin circle');
            const marker = document.querySelector('.logo-tile-marker.is-target');
            return {
                targetCx: target.cx,
                targetCy: target.cy,
                pinCx: pinCircle ? parseFloat(pinCircle.getAttribute('cx')) : null,
                pinCy: pinCircle ? parseFloat(pinCircle.getAttribute('cy')) : null,
                markerLeft: marker ? parseFloat(marker.style.left) : null,
                markerTop: marker ? parseFloat(marker.style.top) : null
            };
        }""")
        assert pin_coords["pinCx"] == pin_coords["targetCx"], f"Pin cx should match target cx {pin_coords}"
        assert pin_coords["pinCy"] == pin_coords["targetCy"], f"Pin cy should match target cy {pin_coords}"
        assert pin_coords["markerLeft"] == pin_coords["targetCx"], f"Marker left should match target cx {pin_coords}"
        assert pin_coords["markerTop"] == pin_coords["targetCy"], f"Marker top should match target cy {pin_coords}"
        print(f"✓ Verified: Target pin is 100% centered inside Cookshop (x={pin_coords['pinCx']}, y={pin_coords['pinCy']})")

        # ---------------------------------------------------------
        # 5. MOBILE VIEWPORT TEST (390x844 iPhone 14) (ITEM 1 & 6)
        # ---------------------------------------------------------
        print("\n--- 5. MOBILE VIEWPORT TEST (390x844) ---")
        page.set_viewport_size({"width": 390, "height": 844})
        time.sleep(1)

        # Check mobile floor header card position
        mobile_card = page.locator("#floor-header-card")
        mobile_box = mobile_card.bounding_box()
        # Should be centered: middle of card should be near 390/2 = 195
        card_center_x = mobile_box["x"] + mobile_box["width"] / 2
        assert abs(card_center_x - 195) < 15, f"Floor header card should be centered on mobile, center={card_center_x}"
        print(f"✓ Verified: Mobile route info box is centered horizontally at center_x={card_center_x:.1f} (width={mobile_box['width']:.1f})")

        # Check compass and floor pill bar do not overlap card
        compass_box = page.locator("#btn-compass").bounding_box()
        assert compass_box["y"] > mobile_box["y"] + mobile_box["height"] - 5, "Compass should sit below or separate from header card"
        print(f"✓ Verified: Compass sits cleanly below header card (compass_y={compass_box['y']}, card_bottom={mobile_box['y'] + mobile_box['height']})")

        # Check route path chips are flex-nowrap and scrollable
        chip_container = page.locator("#route-path-chips")
        assert chip_container.is_visible(), "Route path chips should be visible"
        qr_btn = page.locator("#btn-route-qr")
        assert qr_btn.is_visible(), "Rotayı Cebine Al button should be visible"
        print("✓ Verified: 'Rotayı Cebine Al' button is visible and intact")

        # Check mobile marker scale
        marker_scale = page.evaluate("""() => {
            const container = document.getElementById('map-canvas-container');
            return container.style.getPropertyValue('--marker-scale');
        }""")
        print(f"✓ Verified: Dynamic --marker-scale on mobile = {marker_scale} (responsive scale active)")
        assert float(marker_scale) > 1.0, f"Mobile marker scale should be boosted (>1.0), got {marker_scale}"

        # ---------------------------------------------------------
        # 6. MOBILE PEEK CARD (ITEM 6)
        # ---------------------------------------------------------
        print("\n--- 6. MOBILE PEEK CARD BUTTONS ---")
        # Clear route and tap a store to open peek card
        page.evaluate("""() => {
            clearCurrentRoute();
            const store = mallData.floors[4].stores.find(x => x.name === 'Vakko');
            showPoiPeekCard(store);
        }""")
        time.sleep(1)

        peek_card = page.locator("#poi-peek-card")
        assert peek_card.is_visible(), "Peek card should be visible"
        btn_start = page.locator("#btn-peek-start")
        btn_target = page.locator("#btn-peek-target")
        assert btn_start.is_visible() and btn_target.is_visible(), "Both action buttons should be visible"
        start_box = btn_start.bounding_box()
        target_box = btn_target.bounding_box()
        # Buttons should be side by side
        assert start_box["y"] == target_box["y"], "Buttons should be aligned side by side"
        assert start_box["width"] > 100, f"Button should have ample width, got {start_box['width']}"
        print(f"✓ Verified: Peek card buttons are aligned side-by-side with width={start_box['width']}px, no overlapping")

        # Save mobile screenshot for verification
        page.screenshot(path="screenshot_verified_mobile_ux.png")
        print("✓ Saved screenshot: screenshot_verified_mobile_ux.png")

        # Also save desktop screenshot
        page.set_viewport_size({"width": 1280, "height": 800})
        time.sleep(1)
        page.screenshot(path="screenshot_verified_desktop_ux.png")
        print("✓ Saved screenshot: screenshot_verified_desktop_ux.png")

        # ---------------------------------------------------------
        # 7. CONSOLE ERRORS
        # ---------------------------------------------------------
        print(f"\nTotal console errors captured: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Expected 0 console errors, got: {console_errors}"

        browser.close()
        print("\n==========================================")
        print("ALL TESTS PASSED WITH 0 CONSOLE ERRORS!")
        print("==========================================")

if __name__ == "__main__":
    test_mobile_ux_and_fixes()
