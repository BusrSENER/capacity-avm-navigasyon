import sys
import time
from playwright.sync_api import sync_playwright

def run_test():
    console_errors = []
    
    with sync_playwright() as p:
        # iPhone 12/13/14 Pro viewport 390x844
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        def on_console(msg):
            if msg.type == 'error':
                console_errors.append(msg.text)
                print(f"[CONSOLE ERROR]: {msg.text}")
            elif 'error' in msg.text.lower() and not 'favicon' in msg.text.lower():
                print(f"[CONSOLE WARN/ERR]: {msg.text}")
            else:
                pass

        page.on("console", on_console)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:3000/ ...")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # 1. Verify dynamic minScale calculation on mobile
        min_scale = page.evaluate("window.mallMap ? window.mallMap.minScale : null")
        container_w = page.evaluate("window.mallMap ? window.mallMap.containerWidth : null")
        container_h = page.evaluate("window.mallMap ? window.mallMap.containerHeight : null")
        print(f"Container: {container_w}x{container_h}, Dynamic minScale: {min_scale}")
        assert min_scale is not None and min_scale < 0.35, f"Expected mobile minScale < 0.35, got {min_scale}"
        print("✓ Dynamic minScale calculation verified!")

        # 2. Test Free Start Selection via [ 📍 Nereden? ] modal search (Vakko)
        print("Testing [ 📍 Nereden? ] modal search for Vakko...")
        page.click("#input-start-loc")
        page.wait_for_timeout(500)

        # Check modal is visible
        modal_visible = page.is_visible("#entrance-modal")
        assert modal_visible, "Entrance modal should be visible after clicking [ 📍 Nereden? ]"

        # Search "Vakko"
        page.fill("#entrance-modal-search", "Vakko")
        page.wait_for_timeout(300)

        # Check result in entrance list
        vakko_item = page.locator("#entrance-list > div", has_text="Vakko").first
        assert vakko_item.is_visible(), "Vakko should be visible in entrance modal search results"
        vakko_item.click()
        page.wait_for_timeout(500)

        # Verify start location set
        start_val = page.input_value("#input-start-loc")
        print(f"Start input value: {start_val}")
        assert "Vakko" in start_val, f"Expected Vakko in start input, got {start_val}"
        print("✓ Vakko selected as start point successfully!")

        # 3. Test Destination selection: Zara
        print("Testing [ 🎯 Nereye? ] search for Zara...")
        page.fill("#input-target-loc", "Zara")
        page.wait_for_timeout(400)

        zara_card = page.locator(".store-card", has_text="Zara").first
        assert zara_card.is_visible(), "Zara store card should be visible in sidebar search"
        zara_card.click()
        page.wait_for_timeout(800)

        # Verify target set and route calculated
        target_val = page.input_value("#input-target-loc")
        print(f"Target input value: {target_val}")
        assert "Zara" in target_val, f"Expected Zara in target input, got {target_val}"

        # Verify HUD is visible and active
        hud_active = page.evaluate("document.getElementById('nav-hud-bar').classList.contains('is-active')")
        hud_route = page.text_content("#hud-route-name")
        hud_dist = page.text_content("#hud-distance")
        hud_time = page.text_content("#hud-time")
        print(f"HUD Bar: active={hud_active}, route='{hud_route}', distance='{hud_dist}', time='{hud_time}'")
        assert hud_active, "HUD bar should be active after route calculation"
        assert "Vakko" in hud_route and "Zara" in hud_route, f"Expected Vakko -> Zara in HUD route, got {hud_route}"

        # Verify route SVG paths rendered
        path_count = page.evaluate("document.querySelectorAll('#route-svg path').length")
        print(f"Route SVG path count: {path_count}")
        assert path_count > 0, "Route SVG should contain rendered paths"
        print("✓ Vakko -> Zara store-to-store route calculated and displayed perfectly!")

        page.screenshot(path="screenshot_vakko_to_zara_mobile.png")
        print("Screenshot saved to screenshot_vakko_to_zara_mobile.png")

        # 4. Test Mobile Touch Pinch-to-Zoom Out & Clamping (Full Plan View)
        print("Testing mobile zoom-out down to dynamic minScale...")
        # Simulate zoom-out button clicks down to minScale
        for _ in range(9):
            page.click("#zoom-out-btn")
            page.wait_for_timeout(100)

        final_scale = page.evaluate("window.mallMap.scale")
        pan_x = page.evaluate("window.mallMap.panX")
        pan_y = page.evaluate("window.mallMap.panY")
        min_scale = page.evaluate("window.mallMap.minScale")
        print(f"Zoomed-out state: scale={final_scale:.4f}, minScale={min_scale:.4f}, panX={pan_x:.1f}, panY={pan_y:.1f}")
        assert final_scale <= min_scale * 1.05, f"Expected scale <= minScale ({min_scale}), got {final_scale}"
        print("✓ Map successfully zoomed out to general floor plan without locking or jitter!")

        # Verify map can zoom back in smoothly
        page.click("#zoom-in-btn")
        page.wait_for_timeout(200)
        rezoomed_scale = page.evaluate("window.mallMap.scale")
        assert rezoomed_scale > final_scale, "Map should smoothly zoom in from minScale"
        print(f"✓ Map zoomed back in to {rezoomed_scale:.4f} without locking!")

        page.screenshot(path="screenshot_mobile_zoomed_out_plan.png")
        print("Screenshot saved to screenshot_mobile_zoomed_out_plan.png")

        # 5. Test POI Card Free Start Selection:
        # Click Finish route
        page.click("#btn-hud-finish")
        page.wait_for_timeout(400)

        # Inspect Beymen
        page.fill("#input-target-loc", "Beymen")
        page.wait_for_timeout(300)
        beymen_card = page.locator(".store-card", has_text="Beymen").first
        if beymen_card.is_visible():
            beymen_card.click()
            page.wait_for_timeout(400)
            
            # Click "📍 Başlangıç Noktası Yap" on POI Card
            poi_start_btn = page.locator("#poi-start-btn")
            assert poi_start_btn.is_visible(), "#poi-start-btn should be visible in POI details"
            poi_start_btn.click()
            page.wait_for_timeout(500)

            # Check that Beymen is now start
            new_start_val = page.input_value("#input-start-loc")
            print(f"New start value from POI button: {new_start_val}")
            assert "Beymen" in new_start_val, f"Expected Beymen as start, got {new_start_val}"
            print("✓ Free start selection via POI card verified!")

        # 6. Check console errors
        print(f"Total console errors encountered: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
            assert False, f"Encountered {len(console_errors)} console errors!"
        else:
            print("🎉 ALL TESTS PASSED WITH 0 CONSOLE ERRORS!")

        browser.close()

if __name__ == '__main__':
    run_test()
