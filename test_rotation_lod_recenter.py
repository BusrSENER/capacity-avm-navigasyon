import asyncio
from playwright.async_api import async_playwright

async def test_mobile_map_engine():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Mobile viewport (iPhone 14 Pro: 390x844)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            is_mobile=True,
            has_touch=True
        )
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        print("Navigating to http://127.0.0.1:3000/ ...")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # 1. TEST: Max Zoom 8x
        print("Testing Max Zoom 8.0x...")
        max_scale = await page.evaluate("window.mallMap.maxScale")
        assert max_scale == 8.0, f"Expected maxScale 8.0, got {max_scale}"
        print(f"✓ maxScale is confirmed: {max_scale}x")

        # Zoom in repeatedly to reach high scale
        for i in range(12):
            await page.click("#zoom-in-btn")
            await page.wait_for_timeout(100)

        scale_after_zoom = await page.evaluate("window.mallMap.scale")
        print(f"✓ Scale after multiple zoom-ins: {scale_after_zoom:.2f}x (Limit is 8.0x)")
        assert scale_after_zoom > 3.0, f"Expected scale > 3.0, got {scale_after_zoom}"
        assert scale_after_zoom <= 8.0, f"Scale exceeded 8.0: {scale_after_zoom}"

        # 2. TEST: Level of Detail (LoD) at scale >= 1.8x vs < 1.8x
        print("Testing LoD classes...")
        lod_high_present = await page.evaluate("document.getElementById('map-canvas-container').classList.contains('lod-high')")
        assert lod_high_present, "Expected lod-high class at high zoom level"
        print("✓ lod-high active at high scale")

        await page.screenshot(path="screenshot_lod_high_8x.png")

        # Reset view to test low zoom LoD
        await page.click("#zoom-reset-btn")
        await page.wait_for_timeout(400)
        lod_low_present = await page.evaluate("document.getElementById('map-canvas-container').classList.contains('lod-low')")
        assert lod_low_present, "Expected lod-low class after reset view"
        print("✓ lod-low active at default scale")

        # 3. TEST: Map Rotation, Billboard Effect & North Compass Reset
        print("Testing Rotation, Billboard Effect & Compass needle...")
        # Set rotation to 65 degrees
        await page.evaluate("window.mallMap.setRotation(65)")
        await page.wait_for_timeout(300)

        rot_val = await page.evaluate("window.mallMap.rotation")
        assert abs(rot_val - 65) < 0.1, f"Expected rotation 65, got {rot_val}"

        # Check CSS variable --billboard-rot
        billboard_rot = await page.evaluate("document.getElementById('map-canvas-container').style.getPropertyValue('--billboard-rot')")
        assert billboard_rot == "-65deg", f"Expected --billboard-rot '-65deg', got {billboard_rot}"
        print(f"✓ Billboard rotation CSS property correctly set: {billboard_rot}")

        # Check needle transform
        needle_transform = await page.evaluate("document.getElementById('compass-needle').style.transform")
        assert "rotate(-65deg)" in needle_transform, f"Expected rotate(-65deg) on needle, got {needle_transform}"
        print(f"✓ Compass needle correctly tracks North: {needle_transform}")

        await page.screenshot(path="screenshot_map_rotated_65deg.png")

        # Click North Compass button to smoothly reset rotation to 0°
        print("Clicking North Compass button to reset to 0°...")
        await page.click("#btn-compass")
        await page.wait_for_timeout(600)

        final_rot = await page.evaluate("window.mallMap.rotation")
        assert abs(final_rot) < 1.0, f"Expected rotation reset near 0, got {final_rot}"
        needle_final = await page.evaluate("document.getElementById('compass-needle').style.transform")
        assert "rotate(0deg)" in needle_final or "rotate(-0deg)" in needle_final or abs(final_rot) < 0.01, f"Expected needle reset to 0deg, got {needle_final}"
        print(f"✓ North Compass reset successfully returned map to {final_rot:.2f}°")

        # 4. TEST: Route Navigation & Cart Simulation Free Camera
        print("Testing Route creation and Cart Simulation...")
        # Select quick start: Fişekhane Kapısı
        await page.click("#btn-quick-fisekhane")
        await page.wait_for_timeout(300)

        # Search target: Zara
        await page.fill("#input-target-loc", "Zara")
        await page.wait_for_timeout(400)
        # Click on Zara from list
        zara_card = page.locator(".store-card:has-text('Zara')").first
        await zara_card.click()
        await page.wait_for_timeout(800)

        # Verify route is displayed
        route_active = await page.evaluate("document.body.classList.contains('has-active-route')")
        assert route_active, "Expected active route"
        print("✓ Route created between Fişekhane and Zara")

        # Start Cart Simulation
        print("Starting shopping cart simulation...")
        await page.click("#btn-hud-sim-play")
        await page.wait_for_timeout(500)

        is_playing = await page.evaluate("window.cartSimulator.isPlaying")
        assert is_playing, "Expected simulator to be playing"
        auto_follow_initial = await page.evaluate("window.cartSimulator.autoFollow")
        assert auto_follow_initial, "Expected autoFollow to be True initially"

        recenter_btn = page.locator("#btn-recenter-cart")
        assert await recenter_btn.evaluate("el => el.classList.contains('hidden')"), "Recenter button should be hidden initially"
        print("✓ Simulation started with autoFollow = True, recenter button hidden")

        # Simulate user panning/dragging the map during simulation
        print("Simulating user pan gesture during simulation...")
        map_box = await page.locator("#map-canvas-container").bounding_box()
        start_x = map_box["x"] + map_box["width"] / 2
        start_y = map_box["y"] + map_box["height"] / 2

        await page.mouse.move(start_x, start_y)
        await page.mouse.down()
        await page.mouse.move(start_x - 80, start_y - 60, steps=5)
        await page.mouse.up()
        await page.wait_for_timeout(400)

        auto_follow_after_drag = await page.evaluate("window.cartSimulator.autoFollow")
        assert not auto_follow_after_drag, "Expected autoFollow to become False after user drag"
        recenter_hidden = await recenter_btn.evaluate("el => el.classList.contains('hidden')")
        assert not recenter_hidden, "Expected recenter button to become visible"
        print("✓ User drag detached camera: autoFollow is False and [ 🎯 Sepete Dön ] is visible")

        await page.screenshot(path="screenshot_sim_free_camera_recenter_visible.png")

        # Click Recenter button
        print("Clicking [ 🎯 Sepete Dön ] button...")
        await recenter_btn.click(force=True)
        await page.wait_for_timeout(500)

        auto_follow_restored = await page.evaluate("window.cartSimulator.autoFollow")
        assert auto_follow_restored, "Expected autoFollow to be True after clicking recenter"
        recenter_hidden_again = await recenter_btn.evaluate("el => el.classList.contains('hidden')")
        assert recenter_hidden_again, "Expected recenter button to be hidden after clicking recenter"
        print("✓ Recenter button clicked: camera re-attached to cart and button hidden")

        # Finish route
        print("Finishing route...")
        await page.click("#btn-hud-finish")
        await page.wait_for_timeout(400)

        route_cleared = await page.evaluate("!document.body.classList.contains('has-active-route')")
        assert route_cleared, "Expected route to be cleared"
        recenter_still_hidden = await recenter_btn.evaluate("el => el.classList.contains('hidden')")
        assert recenter_still_hidden, "Recenter button must remain hidden after route finish"
        print("✓ Route cleared and recenter button remains hidden")

        # Verify console errors
        print(f"Console errors recorded: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"

        print("\n========================================================")
        print("🎉 ALL TESTS PASSED SUCCESSFULLY WITH ZERO CONSOLE ERRORS!")
        print("========================================================")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_mobile_map_engine())
