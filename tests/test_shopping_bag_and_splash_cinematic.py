import time
import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:3000"
ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_shopping_bag_and_splash():
    print("=================================================================")
    print("STARTING E2E TEST: SHOPPING BAG AVATAR & SPLASH CINEMATIC")
    print("=================================================================")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        # -------------------------------------------------------------
        # 1. SPLASH SCREEN DOM & NO OVERFLOW-X TEST
        # -------------------------------------------------------------
        print("\n--- 1. SPLASH SCREEN DOM & SLIDE BAG ANIMATION ---")
        start_time = time.time()
        page.goto(f"{BASE_URL}/index.html")

        # Verify splash screen structure
        splash = page.locator("#splash-screen")
        assert splash.count() > 0 and splash.is_visible(), "Splash screen should be visible immediately"

        # Check pure centered nrdsor logo
        logo = page.locator("#splash-brand-logo")
        assert logo.is_visible(), "nrdsor horizontal logo should be visible in splash"
        assert page.locator("#splash-brand-icon").count() == 0, "No duplicate pin icon should exist"

        # Check new luxury slide bag element in DOM
        slide_bag = page.locator("#splash-slide-bag")
        assert slide_bag.count() > 0, "#splash-slide-bag element should exist in DOM"
        assert slide_bag.locator("svg").count() > 0, "Slide bag must contain an SVG"

        # Check track element
        bag_track = page.locator("#splash-bag-track")
        assert bag_track.count() > 0, "#splash-bag-track element should exist in DOM"
        print("✓ Verified: Splash screen contains centered logo and #splash-slide-bag runway")

        # -------------------------------------------------------------
        # 2. OVERFLOW-X TEST (NO HORIZONTAL OVERFLOW DURING ANIMATION)
        # -------------------------------------------------------------
        print("\n--- 2. VERIFYING 0 HORIZONTAL OVERFLOW (OVERFLOW-X CHECK) ---")
        overflow_info = page.evaluate("""() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const scrollX = window.scrollX || window.pageXOffset;
            const splashEl = document.getElementById('splash-screen');
            const splashOverflowX = splashEl ? window.getComputedStyle(splashEl).overflowX : '';
            return {
                docWidth,
                winWidth,
                scrollX,
                splashOverflowX,
                hasOverflow: docWidth > winWidth
            };
        }""")
        print(f"Overflow info: {overflow_info}")
        assert not overflow_info["hasOverflow"], f"Horizontal overflow detected: docWidth={overflow_info['docWidth']} > winWidth={overflow_info['winWidth']}"
        assert overflow_info["scrollX"] == 0, "Page should not be horizontally scrolled"
        assert overflow_info["splashOverflowX"] == "hidden", "Splash screen must have overflow-x: hidden"
        print("✓ Verified: No horizontal overflow-x during bag sliding animation!")

        # Take screenshot of splash screen with slide bag
        scr_splash = os.path.join(ARTIFACT_DIR, "screenshot_splash_slide_bag.png")
        page.screenshot(path=scr_splash)
        print(f"✓ Saved screenshot: {scr_splash}")

        # -------------------------------------------------------------
        # 3. TRANSITION TIMING (TOTAL ~2800ms)
        # -------------------------------------------------------------
        print("\n--- 3. TIMING TEST: SPLASH SMOOTH FADE OUT AT ~2.8s ---")
        # At 1.2s, splash should definitely still be visible
        page.wait_for_timeout(1000)
        assert splash.count() > 0 and splash.is_visible(), "Splash screen should still be visible at 1.2s"
        print("✓ Verified: Splash remains visible while bag travels across runway")

        # Wait until 3.2s total (2800ms + margin)
        page.wait_for_timeout(2000)
        elapsed = time.time() - start_time
        print(f"Elapsed time: {elapsed:.2f}s")
        assert splash.count() == 0 or not splash.is_visible(), f"Splash screen should fade out by 2.8s - 3.2s (elapsed: {elapsed:.2f}s)"
        print("✓ Verified: Splash screen smoothly faded out into map navigation")

        # -------------------------------------------------------------
        # 4. ROUTE AVATAR: LUXURY SHOPPING BAG (CART -> BAG REPLACEMENT)
        # -------------------------------------------------------------
        print("\n--- 4. ROUTE AVATAR: LUXURY SHOPPING BAG ON ROUTE ---")
        # Load Floor 4 and plan route Vakko -> Cookshop
        page.evaluate("""async () => {
            await mallMap.loadFloor(4);
            updateFloorUI(4);
            const s = mallData.floors[4].stores.find(x => x.name === 'Vakko');
            const t = mallData.floors[4].stores.find(x => x.name === 'Cookshop');
            setStartLocation(s);
            setTargetLocation(t);
        }""")
        time.sleep(1.5)

        # Verify avatar elements in DOM
        bag_avatar = page.locator(".cart-avatar")
        assert bag_avatar.count() > 0, "Route avatar container should exist"

        # Check shopping bag SVG
        bag_svg = page.locator(".cart-avatar .bag-svg-el")
        assert bag_svg.count() > 0, "Avatar should contain .bag-svg-el (Shopping Bag SVG)"

        # Verify OLD cart elements are completely gone
        assert page.locator(".cart-avatar .cart__wheel").count() == 0, "Old cart wheels must be completely removed"
        assert page.locator(".cart-avatar .cart__body").count() == 0, "Old wireframe cart body must be completely removed"
        print("✓ Verified: Old shopping cart basket & wheels are 100% REMOVED from route avatar")

        # Check luxury shopping bag SVG features
        svg_info = page.evaluate("""() => {
            const svg = document.querySelector('.cart-avatar .bag-svg-el');
            const hasGradients = svg ? svg.querySelectorAll('linearGradient').length > 0 : false;
            const hasHandles = svg ? svg.querySelectorAll('path').length >= 4 : false;
            const hasEmblem = svg ? svg.querySelector('rect') !== null : false;
            return { hasGradients, hasHandles, hasEmblem };
        }""")
        assert svg_info["hasGradients"], "Shopping bag must contain luxury gradient defs"
        assert svg_info["hasHandles"], "Shopping bag must contain luxury handles and pleat lines"
        assert svg_info["hasEmblem"], "Shopping bag must contain brand emblem patch"
        print(f"✓ Verified: Luxury Shopping Bag SVG attributes verified: {svg_info}")

        # Start simulation and test movement
        page.evaluate("() => cartSimulator.play()")
        time.sleep(1.5)

        # Check position changes and moves smoothly
        pos1 = page.evaluate("() => ({ x: cartSimulator.currentX, y: cartSimulator.currentY, isPlaying: cartSimulator.isPlaying })")
        print(f"Simulation in progress: {pos1}")
        assert pos1["isPlaying"], "Simulation should be playing"
        assert pos1["x"] > 0 and pos1["y"] > 0, "Bag coordinates must be positive"

        # Take screenshot of luxury bag on map route
        scr_route_bag = os.path.join(ARTIFACT_DIR, "screenshot_route_shopping_bag.png")
        page.screenshot(path=scr_route_bag)
        print(f"✓ Saved screenshot: {scr_route_bag}")

        # -------------------------------------------------------------
        # 5. MOBILE VIEWPORT NO-OVERFLOW CHECK (390x844)
        # -------------------------------------------------------------
        print("\n--- 5. MOBILE VIEWPORT OVERFLOW CHECK (390x844) ---")
        page.set_viewport_size({"width": 390, "height": 844})
        time.sleep(0.5)

        mobile_overflow = page.evaluate("""() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            return { docWidth, winWidth, hasOverflow: docWidth > winWidth };
        }""")
        assert not mobile_overflow["hasOverflow"], f"Mobile horizontal overflow detected: {mobile_overflow}"
        print(f"✓ Verified: Mobile (390px) has 0 horizontal overflow ({mobile_overflow})")

        scr_mobile_bag = os.path.join(ARTIFACT_DIR, "screenshot_mobile_route_bag.png")
        page.screenshot(path=scr_mobile_bag)
        print(f"✓ Saved screenshot: {scr_mobile_bag}")

        # -------------------------------------------------------------
        # 6. CONSOLE ERRORS CHECK
        # -------------------------------------------------------------
        print("\n--- 6. CONSOLE ERRORS CHECK ---")
        print(f"Total console errors captured: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"
        print("✓ Verified: 0 console errors throughout entire run!")

        browser.close()

    print("\n=================================================================")
    print("ALL TESTS PASSED WITH 0 CONSOLE ERRORS!")
    print("=================================================================")

if __name__ == "__main__":
    test_shopping_bag_and_splash()
