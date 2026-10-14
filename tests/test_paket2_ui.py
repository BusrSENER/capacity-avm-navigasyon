import asyncio
import os
import subprocess
import time
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.async_api import async_playwright

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run_tests():
    print("=== STARTING PAKET 2 PLAYWRIGHT TESTS ===")
    
    # Start local http server on port 8088 if not running
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    is_running = False
    try:
        s.bind(("127.0.0.1", 8088))
        s.close()
    except OSError:
        is_running = True
        
    server_proc = None
    if not is_running:
        server_proc = subprocess.Popen(
            ["C:\\Users\\busra.sener\\AppData\\Local\\Python\\bin\\python3.14.exe", "-m", "http.server", "8088"],
            cwd=r"C:\Users\busra.sener\.gemini\antigravity\scratch\capacity-avm-navigasyon"
        )
        time.sleep(1.5)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            
            # TEST 1: MOBILE VIEWPORT (390 x 844)
            print("\n--- TEST 1: MOBILE VIEWPORT (390x844) ---")
            context_mobile = await browser.new_context(viewport={"width": 390, "height": 844})
            page_mobile = await context_mobile.new_page()
            
            console_errors = []
            page_mobile.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page_mobile.on("pageerror", lambda err: console_errors.append(str(err)))
            
            await page_mobile.goto("http://127.0.0.1:8088/index.html")
            await page_mobile.wait_for_timeout(3800) # Wait for splash animation to fade out
            
            # Check 1: [ Liste ] button removed
            floating_toggle = await page_mobile.query_selector("#floating-view-toggle")
            assert floating_toggle is None, "FAIL: #floating-view-toggle still exists in DOM!"
            print("PASS: #floating-view-toggle is completely removed.")
            
            # Check 2: #nav-hud-bar removed
            hud_bar = await page_mobile.query_selector("#nav-hud-bar")
            assert hud_bar is None, "FAIL: #nav-hud-bar still exists in DOM!"
            print("PASS: #nav-hud-bar is completely removed.")
            
            # Check 3: #floor-header-card has no round buttons
            round_btns = await page_mobile.query_selector_all("#floor-header-card button[id*='btn-header']")
            assert len(round_btns) == 0, f"FAIL: Found {len(round_btns)} header buttons in #floor-header-card!"
            print("PASS: #floor-header-card is clean with 0 circular action buttons.")
            
            # Check 4: Floor selector is vertical on the RIGHT edge
            floor_bar = await page_mobile.query_selector(".floors-pill-bar")
            assert floor_bar is not None, "FAIL: .floors-pill-bar not found!"
            box = await floor_bar.bounding_box()
            assert box is not None, "FAIL: .floors-pill-bar bounding box is None!"
            print(f"Floor bar bbox: x={box['x']}, y={box['y']}, w={box['width']}, h={box['height']}")
            assert box["x"] > 330, f"FAIL: Floor bar is not pinned to right edge (x={box['x']} <= 330)!"
            assert box["height"] > box["width"], f"FAIL: Floor bar is not vertical (h={box['height']} <= w={box['width']})!"
            print("PASS: Floor bar is a vertical capsule on the right edge.")
            
            # Check 5: Bottom Sheet Toggling
            sidebar = await page_mobile.query_selector("#sidebar-panel")
            classes_before = await sidebar.get_attribute("class") or ""
            assert "is-expanded" not in classes_before, "FAIL: Sidebar should start collapsed on mobile!"
            
            # Click bottom sheet handle bar to expand
            handle_bar = await page_mobile.query_selector("#bottom-sheet-handle-bar")
            await handle_bar.click()
            await page_mobile.wait_for_timeout(400)
            classes_expanded = await sidebar.get_attribute("class") or ""
            assert "is-expanded" in classes_expanded, "FAIL: Sidebar did not expand on handle-bar tap!"
            print("PASS: Bottom sheet expands on first tap of handle bar.")
            
            # Tap map canvas to collapse
            map_canvas = await page_mobile.query_selector("#map-canvas-container")
            await map_canvas.click(position={"x": 150, "y": 150})
            await page_mobile.wait_for_timeout(400)
            classes_after_map = await sidebar.get_attribute("class") or ""
            assert "is-expanded" not in classes_after_map, "FAIL: Sidebar did not collapse on map canvas tap!"
            print("PASS: Bottom sheet collapses when map canvas is tapped.")
            
            # Check 6: Select Store & Unified 2x2 POI Card
            await page_mobile.evaluate("window.selectStore(mallData.floors[4].stores[0])")
            await page_mobile.wait_for_timeout(400)
            
            poi_buttons = await page_mobile.query_selector_all("#poi-action-buttons > *")
            assert len(poi_buttons) == 4, f"FAIL: Expected 4 action buttons (2x2 grid), got {len(poi_buttons)}!"
            btn_texts = [await b.inner_text() for b in poi_buttons]
            print(f"POI 2x2 action buttons: {btn_texts}")
            assert any("Hedef" in t for t in btn_texts), "FAIL: 'Hedef Yap' button missing!"
            assert any("Başlangıç" in t for t in btn_texts), "FAIL: 'Başlangıç Yap' button missing!"
            assert any("Ara" in t for t in btn_texts), "FAIL: 'Ara' button missing!"
            assert any("3B Görünüm" in t for t in btn_texts), "FAIL: '3B Görünüm' button missing!"
            print("PASS: POI Detail Card displays unified 2x2 action buttons without separate peek balloon.")
            
            # Screenshot mobile POI card
            mobile_poi_path = os.path.join(ARTIFACT_DIR, "test_mobile_paket2_poi.png")
            await page_mobile.screenshot(path=mobile_poi_path)
            print(f"Saved mobile screenshot to {mobile_poi_path}")
            
            # Check 7: Route calculation inside Bottom Sheet
            await page_mobile.evaluate("""() => {
                const start = mallData.entrances.find(e => e.id === 'ent_fisekhane') || mallData.entrances[0];
                const target = mallData.floors[4].stores[0];
                window.setStartLocation(start);
                window.setTargetLocation(target);
            }""")
            await page_mobile.wait_for_timeout(800)
            
            # Check route detail card inside sidebar
            route_detail = await page_mobile.query_selector("#sidebar-route-detail")
            assert route_detail is not None, "FAIL: #sidebar-route-detail not found!"
            is_route_hidden = await route_detail.evaluate("el => el.classList.contains('hidden')")
            assert not is_route_hidden, "FAIL: #sidebar-route-detail is hidden during active route!"
            
            steps = await page_mobile.query_selector_all("#sidebar-route-steps-list > div")
            print(f"Route steps count: {len(steps)}")
            assert len(steps) > 0, "FAIL: Route steps list is empty!"
            print("PASS: Active route controls and step-by-step instructions unified inside bottom sheet.")
            
            # Expand bottom sheet to see route detail screenshot
            await handle_bar.click()
            await page_mobile.wait_for_timeout(400)
            mobile_route_path = os.path.join(ARTIFACT_DIR, "test_mobile_paket2_route.png")
            await page_mobile.screenshot(path=mobile_route_path)
            print(f"Saved mobile route screenshot to {mobile_route_path}")
            
            await context_mobile.close()
            
            # TEST 2: DESKTOP VIEWPORT (1920 x 1080)
            print("\n--- TEST 2: DESKTOP VIEWPORT (1920x1080) ---")
            context_desk = await browser.new_context(viewport={"width": 1920, "height": 1080})
            page_desk = await context_desk.new_page()
            
            page_desk.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page_desk.on("pageerror", lambda err: console_errors.append(str(err)))
            
            await page_desk.goto("http://127.0.0.1:8088/index.html")
            await page_desk.wait_for_timeout(3800)
            
            # Desktop Sidebar: Left 380px full height
            sidebar_desk = await page_desk.query_selector("#sidebar-panel")
            desk_box = await sidebar_desk.bounding_box()
            assert desk_box["x"] == 0, f"FAIL: Desktop sidebar not on left edge (x={desk_box['x']})!"
            assert desk_box["width"] >= 370, f"FAIL: Desktop sidebar width={desk_box['width']} < 370!"
            print(f"PASS: Desktop sidebar pinned left with w={desk_box['width']}, h={desk_box['height']}.")
            
            # Desktop Floor bar: right: 20px, vertical
            floor_bar_desk = await page_desk.query_selector(".floors-pill-bar")
            fbox_desk = await floor_bar_desk.bounding_box()
            assert fbox_desk["x"] > 1850, f"FAIL: Desktop floor bar not on right (x={fbox_desk['x']})!"
            assert fbox_desk["height"] > fbox_desk["width"], "FAIL: Desktop floor bar is not vertical!"
            print(f"PASS: Desktop floor selector pinned vertically to right edge (x={fbox_desk['x']}).")
            
            # Desktop Zoom bar: bottom right, no overlap with floor selector
            zoom_bar = await page_desk.query_selector(".zoom-bar")
            zbox = await zoom_bar.bounding_box()
            print(f"Zoom bar bbox: x={zbox['x']}, y={zbox['y']}")
            assert zbox["y"] > fbox_desk["y"] + fbox_desk["height"], "FAIL: Zoom bar overlaps floor bar!"
            print("PASS: Zoom bar cleanly separated below floor selector without collision.")
            
            # Test 3D POV in English mode
            print("\n--- TEST 3: 3D POV & ENGLISH TRANSLATIONS ---")
            # Switch to EN
            lang_btn = await page_desk.query_selector("#lang-toggle-btn")
            await lang_btn.click()
            await page_desk.wait_for_timeout(300)
            
            # Enter POV 3D
            await page_desk.evaluate("window.setMapViewMode('pov')")
            await page_desk.wait_for_timeout(500)
            
            # In POV 3D, floor selector should be hidden (opacity 0)
            is_floor_visible = await floor_bar_desk.evaluate("el => window.getComputedStyle(el).opacity")
            print(f"Floor bar opacity in POV 3D: {is_floor_visible}")
            assert float(is_floor_visible) < 0.1, f"FAIL: Floor bar not hidden in POV 3D (opacity={is_floor_visible})!"
            print("PASS: Floor selector automatically hidden in POV 3D mode.")
            
            # Check 3D HUD title / mode badge in EN
            hud_badge = await page_desk.query_selector("#pov-hud-mode-badge")
            badge_text = await hud_badge.inner_text()
            print(f"POV HUD Mode Badge (EN): {badge_text}")
            assert "360°" in badge_text or "3D" in badge_text, f"Unexpected badge text: {badge_text}"
            
            desk_pov_path = os.path.join(ARTIFACT_DIR, "test_desktop_paket2_pov.png")
            await page_desk.screenshot(path=desk_pov_path)
            print(f"Saved desktop POV screenshot to {desk_pov_path}")
            
            await context_desk.close()
            await browser.close()
            
            # Check Console Errors
            print("\n--- CONSOLE ERRORS CHECK ---")
            # Filter out expected favicon 404 or speech synthesis absence in headless
            relevant_errors = [e for e in console_errors if "favicon" not in e and "speechSynthesis" not in e]
            print(f"Total relevant errors: {len(relevant_errors)}")
            if relevant_errors:
                print("Errors found:", relevant_errors)
            assert len(relevant_errors) == 0, f"FAIL: Found {len(relevant_errors)} console errors!"
            print("PASS: ZERO console errors!")
            
    finally:
        if server_proc:
            server_proc.terminate()
            
    print("\n=== ALL PAKET 2 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
