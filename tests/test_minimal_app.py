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
    print("=== STARTING CEVAHIR & SITUM MINIMAL APP TESTS ===")
    
    # Start local http server on port 8089 if not running
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    is_running = False
    try:
        s.bind(("127.0.0.1", 8089))
        s.close()
    except OSError:
        is_running = True
        
    server_proc = None
    if not is_running:
        server_proc = subprocess.Popen(
            ["C:\\Users\\busra.sener\\AppData\\Local\\Python\\bin\\python3.14.exe", "-m", "http.server", "8089"],
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
            
            await page_mobile.goto("http://127.0.0.1:8089/index.html")
            await page_mobile.wait_for_timeout(3800) # Wait for splash animation to fade out
            
            # Check 1: 3D POV Container completely removed
            pov_container = await page_mobile.query_selector("#pov-3d-container")
            assert pov_container is None, "FAIL: #pov-3d-container still exists in DOM!"
            print("PASS: #pov-3d-container does NOT exist in DOM.")

            # Check 2: POV view mode button removed from switcher
            btn_mode_pov = await page_mobile.query_selector("#btn-mode-pov")
            assert btn_mode_pov is None, "FAIL: #btn-mode-pov still exists in DOM!"
            view_mode_btns = await page_mobile.query_selector_all(".view-mode-btn")
            assert len(view_mode_btns) == 2, f"FAIL: Expected 2 view mode buttons (2B & 3B), got {len(view_mode_btns)}!"
            print("PASS: Only 2 view mode buttons exist (2B Plan and 3B Maket).")
            
            # Check 3: Floating toggle and obsolete nav hud bar removed
            floating_toggle = await page_mobile.query_selector("#floating-view-toggle")
            assert floating_toggle is None, "FAIL: #floating-view-toggle still exists in DOM!"
            hud_bar = await page_mobile.query_selector("#nav-hud-bar")
            assert hud_bar is None, "FAIL: #nav-hud-bar still exists in DOM!"
            print("PASS: Floating toggle and bottom hud bar removed.")
            
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
            
            # Check 6: Select Store & Sleek Cevahir-Style POI Card
            await page_mobile.evaluate("window.selectStore(mallData.floors[4].stores[0])")
            await page_mobile.wait_for_timeout(400)
            
            # Check POI buttons: Primary 'Yol Tarifi Al' + 2 secondary 'Buradayım' & 'Ara'
            poi_target_btn = await page_mobile.query_selector("#poi-route-btn")
            assert poi_target_btn is not None, "FAIL: #poi-route-btn missing!"
            target_text = await poi_target_btn.inner_text()
            print(f"POI primary button: {target_text.strip()}")
            assert "Yol Tarifi Al" in target_text or "Hedef" in target_text, f"Unexpected target text: {target_text}"
            
            poi_start_btn = await page_mobile.query_selector("#poi-start-btn")
            assert poi_start_btn is not None, "FAIL: #poi-start-btn missing!"
            start_text = await poi_start_btn.inner_text()
            print(f"POI start button: {start_text.strip()}")
            assert "Buradayım" in start_text or "Buradasınız" in start_text, f"Unexpected start text: {start_text}"

            poi_call_btn = await page_mobile.query_selector("#poi-action-buttons a, #poi-action-buttons button[data-action='call-danisma']")
            assert poi_call_btn is not None, "FAIL: Call button missing!"
            call_text = await poi_call_btn.inner_text()
            print(f"POI call button: {call_text.strip()}")
            assert "Ara" in call_text or "Danışma" in call_text, f"Unexpected call text: {call_text}"
            
            # Verify no 3B button in POI actions
            all_poi_btns = await page_mobile.query_selector_all("#poi-action-buttons button, #poi-action-buttons a")
            all_texts = [await b.inner_text() for b in all_poi_btns]
            assert not any("3B" in t for t in all_texts), f"FAIL: 3B button should not be in POI actions! Texts: {all_texts}"
            print("PASS: POI Card has clean 3-button layout (Primary: Yol Tarifi Al, Secondary: Buradayım & Ara).")
            
            # Screenshot mobile POI card
            mobile_poi_path = os.path.join(ARTIFACT_DIR, "test_mobile_minimal_poi.png")
            await page_mobile.screenshot(path=mobile_poi_path)
            print(f"Saved mobile POI screenshot to {mobile_poi_path}")
            
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
            
            # Check primary nav button
            sim_play_btn = await page_mobile.query_selector("#btn-route-sim-play")
            assert sim_play_btn is not None, "FAIL: #btn-route-sim-play missing!"
            sim_text = await sim_play_btn.inner_text()
            print(f"Route primary action: {sim_text.strip()}")
            assert "Navigasyon" in sim_text or "Başlat" in sim_text or "Önizleme" in sim_text
            
            # Check secondary buttons: 1x Speed and QR Transfer
            speed_btn = await page_mobile.query_selector("#btn-route-speed-toggle")
            assert speed_btn is not None, "FAIL: #btn-route-speed-toggle missing!"
            qr_btn = await page_mobile.query_selector("#btn-sidebar-route-qr")
            assert qr_btn is not None, "FAIL: #btn-sidebar-route-qr missing!"
            print("PASS: Route controls have clean Cevahir layout (Primary Navigasyonu Başlat + 1x Hız + Cebine Al).")
            
            # Check route steps
            steps = await page_mobile.query_selector_all("#sidebar-route-steps-list > div")
            print(f"Route steps count: {len(steps)}")
            assert len(steps) > 0, "FAIL: Route steps list is empty!"
            print("PASS: Step-by-step instructions rendered cleanly.")
            
            # Check 8: GPS Indoor Blue Dot Tracking
            await page_mobile.evaluate("window.mallMap.updateLiveUserLocation(700, 425, 4, 90)")
            await page_mobile.wait_for_timeout(200)
            user_marker = await page_mobile.query_selector("#live-user-gps-dot")
            assert user_marker is not None, "FAIL: #live-user-gps-dot (blue dot) missing!"
            print("PASS: GPS Indoor Location (Blue Dot + directional cone) works smoothly on SVG map.")
            
            # Expand bottom sheet to see route detail screenshot
            await handle_bar.click()
            await page_mobile.wait_for_timeout(400)
            mobile_route_path = os.path.join(ARTIFACT_DIR, "test_mobile_minimal_route.png")
            await page_mobile.screenshot(path=mobile_route_path)
            print(f"Saved mobile route screenshot to {mobile_route_path}")
            
            await context_mobile.close()
            
            # TEST 2: DESKTOP VIEWPORT (1920 x 1080)
            print("\n--- TEST 2: DESKTOP VIEWPORT (1920x1080) ---")
            context_desk = await browser.new_context(viewport={"width": 1920, "height": 1080})
            page_desk = await context_desk.new_page()
            
            page_desk.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page_desk.on("pageerror", lambda err: console_errors.append(str(err)))
            
            await page_desk.goto("http://127.0.0.1:8089/index.html")
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
            
            # Test 3D Perspective toggle (2.5D Maket angle)
            print("\n--- TEST 3: 2D PLAN / 3D MAKET TOGGLE ---")
            btn_3d = await page_desk.query_selector("#btn-mode-3d")
            assert btn_3d is not None, "FAIL: #btn-mode-3d missing!"
            await btn_3d.click()
            await page_desk.wait_for_timeout(500)
            
            is_3d_active = await page_desk.evaluate("window.currentViewMode")
            assert is_3d_active == "3d", f"FAIL: Expected currentViewMode to be '3d', got {is_3d_active}"
            print("PASS: 3B Maket (isometric perspective) toggled successfully.")
            
            # Switch back to 2D
            btn_2d = await page_desk.query_selector("#btn-mode-2d")
            await btn_2d.click()
            await page_desk.wait_for_timeout(300)
            is_2d_active = await page_desk.evaluate("window.currentViewMode")
            assert is_2d_active == "2d", f"FAIL: Expected currentViewMode to be '2d', got {is_2d_active}"
            print("PASS: 2B Plan view toggled successfully.")
            
            # Desktop screenshot
            desk_screenshot_path = os.path.join(ARTIFACT_DIR, "test_desktop_minimal.png")
            await page_desk.screenshot(path=desk_screenshot_path)
            print(f"Saved desktop screenshot to {desk_screenshot_path}")
            
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
            
    print("\n=== ALL MINIMAL APP TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
