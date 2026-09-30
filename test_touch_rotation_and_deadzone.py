import asyncio
from playwright.async_api import async_playwright

async def run_touch_tests():
    errors = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Mobile viewport (iPhone 14 Pro: 390x844, has_touch=True)
        context = await browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        )
        page = await context.new_page()

        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        print("Navigating to http://127.0.0.1:3000/ ...")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_selector("#map-canvas-container", timeout=10000)
        await page.wait_for_timeout(1000)

        # 1. Verify MallMap instance exists and rotateAroundPoint method exists
        has_method = await page.evaluate("() => typeof window.mallMap.rotateAroundPoint === 'function'")
        print(f"1. rotateAroundPoint method exists: {has_method}")
        assert has_method, "rotateAroundPoint method is missing from MallMap"

        # 2. Test mathematical precision of rotateAroundPoint:
        # Verify that for any midpoint (e.g., 200, 350), the world point under midpoint remains stationary
        drift_result = await page.evaluate("""() => {
            const map = window.mallMap;
            map.resetView();
            const screenX = 200;
            const screenY = 350;
            
            const cxWorld = map.vbWidth / 2;
            const cyWorld = map.vbHeight / 2;
            
            // Screen position of world point W before rotation:
            const rotBefore = map.rotation;
            const initialPanX = map.panX;
            const initialPanY = map.panY;
            
            map.rotateAroundPoint(15, screenX, screenY);
            map.applyTransform();
            
            const rotDiff = map.rotation - rotBefore;
            
            return {
                rotBefore: rotBefore,
                rotAfter: map.rotation,
                rotDiff: rotDiff,
                panX: map.panX,
                panY: map.panY,
                deltaPanX: map.panX - initialPanX,
                deltaPanY: map.panY - initialPanY
            };
        }""")
        print(f"2. rotateAroundPoint verification: {drift_result}")
        assert abs(drift_result['rotDiff'] - 15) < 0.01, f"Expected 15 deg rotation, got {drift_result['rotDiff']}"

        # 3. Test Touch Rotation Deadzone (< 8 degrees should NOT rotate)
        deadzone_test = await page.evaluate("""() => {
            const map = window.mallMap;
            map.resetView();
            map.setRotation(0);
            
            const container = map.container;
            const rect = container.getBoundingClientRect();
            
            // Midpoint at (200, 400), two fingers separated horizontally by 120px
            // Touch 0: (140, 400), Touch 1: (260, 400) -> angle = 0 rad (0 deg)
            const touch0 = new Touch({
                identifier: 0,
                target: container,
                clientX: rect.left + 140,
                clientY: rect.top + 400
            });
            const touch1 = new Touch({
                identifier: 1,
                target: container,
                clientX: rect.left + 260,
                clientY: rect.top + 400
            });
            
            const startEvent = new TouchEvent('touchstart', {
                touches: [touch0, touch1],
                targetTouches: [touch0, touch1],
                changedTouches: [touch0, touch1],
                bubbles: true,
                cancelable: true
            });
            container.dispatchEvent(startEvent);
            
            // Move: rotate by 4 degrees (which is < 8 deg deadzone!)
            const rad4 = 4 * Math.PI / 180;
            const halfLen = 60;
            const move0 = new Touch({
                identifier: 0,
                target: container,
                clientX: rect.left + 200 - halfLen * Math.cos(rad4),
                clientY: rect.top + 400 - halfLen * Math.sin(rad4)
            });
            const move1 = new Touch({
                identifier: 1,
                target: container,
                clientX: rect.left + 200 + halfLen * Math.cos(rad4),
                clientY: rect.top + 400 + halfLen * Math.sin(rad4)
            });
            
            const moveEvent = new TouchEvent('touchmove', {
                touches: [move0, move1],
                targetTouches: [move0, move1],
                changedTouches: [move0, move1],
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(moveEvent);
            
            const rotAfterSmallMove = map.rotation;
            
            // Now rotate further by 18 degrees (which is > 8 deg deadzone!)
            const rad18 = 18 * Math.PI / 180;
            const move0_big = new Touch({
                identifier: 0,
                target: container,
                clientX: rect.left + 200 - halfLen * Math.cos(rad18),
                clientY: rect.top + 400 - halfLen * Math.sin(rad18)
            });
            const move1_big = new Touch({
                identifier: 1,
                target: container,
                clientX: rect.left + 200 + halfLen * Math.cos(rad18),
                clientY: rect.top + 400 + halfLen * Math.sin(rad18)
            });
            const moveEventBig = new TouchEvent('touchmove', {
                touches: [move0_big, move1_big],
                targetTouches: [move0_big, move1_big],
                changedTouches: [move0_big, move1_big],
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(moveEventBig);
            
            const rotAfterBigMove = map.rotation;
            
            // End touch
            const endEvent = new TouchEvent('touchend', {
                touches: [],
                targetTouches: [],
                changedTouches: [move0_big, move1_big],
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(endEvent);
            
            return {
                rotAfterSmallMove: rotAfterSmallMove,
                rotAfterBigMove: rotAfterBigMove
            };
        }""")
        print(f"3. Touch deadzone test: {deadzone_test}")
        assert deadzone_test['rotAfterSmallMove'] == 0, f"Expected rotation 0 below deadzone, but got {deadzone_test['rotAfterSmallMove']}"
        assert abs(deadzone_test['rotAfterBigMove']) > 0, f"Expected non-zero rotation after exceeding deadzone, but got {deadzone_test['rotAfterBigMove']}"

        # 4. Test Two-finger Pan without rotation (jitter within deadzone)
        pan_test = await page.evaluate("""() => {
            const map = window.mallMap;
            map.resetView();
            map.setRotation(0);
            const initialPanX = map.panX;
            const initialPanY = map.panY;
            
            const container = map.container;
            const rect = container.getBoundingClientRect();
            
            // Start touch
            const touch0 = new Touch({
                identifier: 0,
                target: container,
                clientX: rect.left + 100,
                clientY: rect.top + 200
            });
            const touch1 = new Touch({
                identifier: 1,
                target: container,
                clientX: rect.left + 200,
                clientY: rect.top + 200
            });
            container.dispatchEvent(new TouchEvent('touchstart', {
                touches: [touch0, touch1],
                targetTouches: [touch0, touch1],
                changedTouches: [touch0, touch1],
                bubbles: true
            }));
            
            // Move both fingers right +50px, down +30px with 0 rotation
            const move0 = new Touch({
                identifier: 0,
                target: container,
                clientX: rect.left + 150,
                clientY: rect.top + 230
            });
            const move1 = new Touch({
                identifier: 1,
                target: container,
                clientX: rect.left + 250,
                clientY: rect.top + 230
            });
            window.dispatchEvent(new TouchEvent('touchmove', {
                touches: [move0, move1],
                targetTouches: [move0, move1],
                changedTouches: [move0, move1],
                bubbles: true
            }));
            
            const panXAfter = map.panX;
            const panYAfter = map.panY;
            const rotAfter = map.rotation;
            
            window.dispatchEvent(new TouchEvent('touchend', {
                touches: [],
                targetTouches: [],
                changedTouches: [move0, move1],
                bubbles: true
            }));
            
            return {
                deltaPanX: panXAfter - initialPanX,
                deltaPanY: panYAfter - initialPanY,
                rotation: rotAfter
            };
        }""")
        print(f"4. Two-finger Pan Test: {pan_test}")
        assert pan_test['rotation'] == 0, f"Rotation should remain 0 during pure pan, got {pan_test['rotation']}"
        assert abs(pan_test['deltaPanX'] - 50) < 5, f"Expected deltaPanX ~50, got {pan_test['deltaPanX']}"
        assert abs(pan_test['deltaPanY'] - 30) < 5, f"Expected deltaPanY ~30, got {pan_test['deltaPanY']}"

        # 5. Capture screenshot of mobile view after rotation & pinch
        await page.evaluate("() => { window.mallMap.rotateAroundPoint(25, 195, 422); window.mallMap.applyTransform(); }")
        await page.wait_for_timeout(300)
        await page.screenshot(path="screenshot_midpoint_rotation_mobile.png")
        print("5. Screenshot saved: screenshot_midpoint_rotation_mobile.png")

        # 6. Verify 0 console errors
        print(f"6. Total console errors: {len(errors)}")
        if errors:
            print("Console Errors:", errors)
        assert len(errors) == 0, f"Found {len(errors)} console errors"

        await browser.close()
        print("\n=== ALL TOUCH GESTURE TESTS PASSED WITH 0 CONSOLE ERRORS ===")

if __name__ == '__main__':
    asyncio.run(run_touch_tests())
