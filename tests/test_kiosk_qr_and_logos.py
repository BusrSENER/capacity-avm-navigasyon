import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

def test_kiosk_qr_and_logos():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("=== 1. TEST: STANDARD DESKTOP VIEW & GROUND FLOOR BRAND LOGOS ===")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Ensure we are on Floor 4 (Zemin Kat)
        current_floor = page.evaluate("mallMap.currentFloor")
        assert current_floor == 4, f"Expected floor 4, got {current_floor}"

        # Verify brand logo tiles rendered on floor 4
        logo_tiles = page.query_selector_all(".logo-tile-marker .logo-tile svg")
        print(f"Found {len(logo_tiles)} brand logo SVGs rendered on Floor 4")
        assert len(logo_tiles) >= 5, f"Expected at least 5 brand logos on floor 4, found {len(logo_tiles)}"

        # Check specific ground floor brands (e.g. Twist, Faik Sönmez, Lacoste)
        has_twist = page.evaluate("window.hasBrandLogo({name: 'Twist'})")
        has_faik = page.evaluate("window.hasBrandLogo({name: 'Faik Sönmez'})")
        has_lacoste = page.evaluate("window.hasBrandLogo({name: 'Lacoste'})")
        has_derimod = page.evaluate("window.hasBrandLogo({name: 'Derimod'})")
        assert has_twist and has_faik and has_lacoste and has_derimod, "Brand logo check failed for ground floor stores"

        # Screenshot of ground floor with logos
        page.screenshot(path="screenshot_ground_floor_logos.png")
        print("Captured screenshot_ground_floor_logos.png")

        print("=== 2. TEST: ROTATION LOCK TO 0° ===")
        # Test calling setRotation / rotateAroundPoint
        rot_after_call = page.evaluate("""() => {
            mallMap.setRotation(45);
            return mallMap.rotation;
        }""")
        assert rot_after_call == 0, f"Expected rotation 0 after setRotation(45), got {rot_after_call}"

        # Test touch gesture simulation
        rot_after_touch = page.evaluate("""() => {
            const container = document.getElementById('map-canvas-container');
            // Dispatch simulated touchstart with 2 fingers
            const t1 = new Touch({ identifier: 1, target: container, clientX: 200, clientY: 200 });
            const t2 = new Touch({ identifier: 2, target: container, clientX: 300, clientY: 200 });
            container.dispatchEvent(new TouchEvent('touchstart', { touches: [t1, t2], changedTouches: [t1, t2] }));

            // Dispatch simulated touchmove with 45 degree angle
            const t1m = new Touch({ identifier: 1, target: container, clientX: 200, clientY: 200 });
            const t2m = new Touch({ identifier: 2, target: container, clientX: 270, clientY: 270 });
            container.dispatchEvent(new TouchEvent('touchmove', { touches: [t1m, t2m], changedTouches: [t1m, t2m] }));

            return mallMap.rotation;
        }""")
        assert rot_after_touch == 0, f"Expected rotation 0 after 2-finger touch, got {rot_after_touch}"
        print("Rotation lock 0° verified successfully!")

        print("=== 3. TEST: KIOSK MODE (?kiosk=true) ===")
        page.goto("http://127.0.0.1:3000/?kiosk=true", wait_until="networkidle")
        page.wait_for_timeout(1000)

        is_kiosk = page.evaluate("window.isKioskMode")
        assert is_kiosk == True, f"Expected isKioskMode to be True, got {is_kiosk}"

        start_input_val = page.evaluate("document.getElementById('input-start-loc').value")
        start_input_readonly = page.evaluate("document.getElementById('input-start-loc').readOnly")
        print(f"Kiosk start input value: '{start_input_val}', readOnly: {start_input_readonly}")
        assert "Danışma" in start_input_val or "Kiosk" in start_input_val, "Start input does not contain Danışma/Kiosk"
        assert start_input_readonly == True, "Start input is not readOnly in Kiosk mode"

        # Try clicking start input in kiosk mode -> entrance modal should stay hidden
        page.click("#input-start-loc")
        page.wait_for_timeout(300)
        entrance_modal_hidden = page.evaluate("document.getElementById('entrance-modal').classList.contains('hidden')")
        assert entrance_modal_hidden == True, "Entrance modal should not open in kiosk mode"

        print("=== 4. TEST: ROUTE CREATION & QR MODAL ===")
        # Select target store in kiosk mode (e.g. Cookshop store_4_8)
        page.evaluate("""() => {
            const store = getAllStores().find(s => s.id === 'store_4_8' || s.name.includes('Cookshop'));
            if (store) setTargetLocation(store);
        }""")
        page.wait_for_timeout(1000)

        # Verify route was calculated
        has_route = page.evaluate("mallMap.activeRoute !== null")
        assert has_route == True, "Route was not generated"

        # Verify QR button in route chips is visible
        qr_btn_visible = page.is_visible("#btn-route-qr")
        assert qr_btn_visible == True, "#btn-route-qr should be visible"

        # Verify HUD QR button is visible
        hud_qr_visible = page.is_visible("#btn-hud-qr")
        assert hud_qr_visible == True, "#btn-hud-qr should be visible in HUD"

        # Click QR button to open modal
        page.click("#btn-route-qr")
        page.wait_for_timeout(500)

        modal_visible = page.is_visible("#route-qr-modal")
        assert modal_visible == True, "#route-qr-modal should be visible after clicking QR button"

        # Check QR code SVG inside container
        qr_svg_count = page.evaluate("document.querySelectorAll('#qr-code-container svg').length")
        assert qr_svg_count >= 1, "QR code SVG was not rendered inside #qr-code-container"

        # Check share URL input
        share_url = page.evaluate("document.getElementById('qr-url-input').value")
        print(f"Generated QR share URL: {share_url}")
        assert "from=kiosk" in share_url or "from=ent_danisma" in share_url, "Share URL missing from=kiosk"
        assert "to=" in share_url, "Share URL missing to= parameter"

        # Check modal labels
        modal_from = page.evaluate("document.getElementById('qr-modal-from').textContent")
        modal_to = page.evaluate("document.getElementById('qr-modal-to').textContent")
        print(f"QR modal: From '{modal_from}' -> To '{modal_to}'")
        assert "Danışma" in modal_from or "Kiosk" in modal_from, "QR modal from label mismatch"
        assert "Cookshop" in modal_to, "QR modal to label mismatch"

        # Screenshot of QR modal
        page.screenshot(path="screenshot_kiosk_qr_modal.png")
        print("Captured screenshot_kiosk_qr_modal.png")

        # Close QR modal
        page.click("#btn-qr-modal-close")
        page.wait_for_timeout(300)
        assert page.is_visible("#route-qr-modal") == False, "QR modal failed to close"

        print("=== 5. TEST: URL PARAMETER AUTO-ROUTING (?from=kiosk&to=store_4_8) ===")
        page.goto("http://127.0.0.1:3000/?from=kiosk&to=store_4_8", wait_until="networkidle")
        page.wait_for_timeout(1200)

        # Route should be automatically active
        auto_route = page.evaluate("mallMap.activeRoute !== null")
        assert auto_route == True, "URL auto-routing failed to build route"

        header_title = page.evaluate("document.getElementById('current-floor-title').textContent")
        print(f"Header title after auto-route: '{header_title}'")
        assert "Cookshop" in header_title, f"Header summary does not show Cookshop, got: {header_title}"

        # Screenshot of auto-routing result
        page.screenshot(path="screenshot_url_param_auto_route.png")
        print("Captured screenshot_url_param_auto_route.png")

        print("=== 6. CONSOLE ERRORS CHECK ===")
        # Filter out benign 404s if any favicon
        real_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"Total console errors: {len(real_errors)}")
        if real_errors:
            print("Errors detected:", real_errors)
        assert len(real_errors) == 0, f"Found console errors: {real_errors}"

        browser.close()
        print("\n ALL PLAYWRIGHT E2E TESTS PASSED SUCCESSFULLY! ")

if __name__ == "__main__":
    test_kiosk_qr_and_logos()
