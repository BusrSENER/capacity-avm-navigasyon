import re
import time
import sys
import os
import shutil
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def test_aggressive_ui_cleanup():
    console_errors = []
    
    with sync_playwright() as p:
        # iPhone 13 / 14 viewport
        device = p.devices['iPhone 13']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**device)
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        # 1. Load application
        print("Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")

        # Wait for splash screen to complete (3200ms + fade)
        page.wait_for_timeout(3500)
        
        # 1. TEST ITEM 1: Summary card (#route-panel, #route-info-card) removed completely from DOM
        print("Verifying #route-panel and #route-info-card do not exist in DOM...")
        route_panel_count = page.locator("#route-panel").count()
        route_info_card_count = page.locator("#route-info-card").count()
        assert route_panel_count == 0, f"Expected #route-panel to be 0, found {route_panel_count}"
        assert route_info_card_count == 0, f"Expected #route-info-card to be 0, found {route_info_card_count}"
        print("PASS: #route-panel and #route-info-card completely absent from DOM.")

        # 2. TEST ITEM 2: Smart Auto-Collapse Bottom Sheet
        print("Verifying bottom sheet collapsed state...")
        sidebar_panel = page.locator("#sidebar-panel")
        assert sidebar_panel.is_visible()

        # Check that it starts collapsed (not .is-expanded)
        has_expanded_class = page.evaluate("() => document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert not has_expanded_class, "Expected sidebar-panel to not have 'is-expanded' class initially on mobile"

        # Check collapsed height: visible portion at the bottom of the screen should be ~58px (<= 65px)
        viewport_height = page.viewport_size['height']
        panel_box = sidebar_panel.bounding_box()
        visible_height = (panel_box['y'] + panel_box['height']) - (panel_box['y'] if panel_box['y'] >= 0 else 0)
        # Or calculate how much of the bottom sheet extends into the viewport from the bottom:
        visible_bottom_extent = viewport_height - panel_box['y']
        print(f"Viewport height: {viewport_height}, Panel Y: {panel_box['y']}, Visible extent from bottom: {visible_bottom_extent}px")
        assert 50 <= visible_bottom_extent <= 68, f"Expected collapsed visible height ~58px, got {visible_bottom_extent}px"

        # Verify bar text has 'Yeni Rota Çiz'
        bar_text = page.locator("#bottom-sheet-hint").inner_text()
        print(f"Handle bar text: {bar_text}")
        assert "Yeni Rota Çiz" in bar_text, f"Expected 'Yeni Rota Çiz' in handle bar, got {bar_text}"

        # Verify clutter elements are hidden in collapsed mode
        dual_search_hidden = page.evaluate("() => window.getComputedStyle(document.getElementById('dual-search-container')).display === 'none'")
        category_pills_hidden = page.evaluate("() => window.getComputedStyle(document.getElementById('category-pills-row')).display === 'none'")
        print(f"Dual search hidden: {dual_search_hidden}, Category pills hidden: {category_pills_hidden}")
        assert dual_search_hidden, "Expected dual search container to be hidden in collapsed mode"
        assert category_pills_hidden, "Expected category pills row to be hidden in collapsed mode"

        # Take screenshot of collapsed state
        page.screenshot(path="screenshot_aggressive_cleanup_collapsed.png")

        # TEST: Expand by tapping handle bar
        print("Tapping handle bar to expand...")
        page.locator("#bottom-sheet-handle-bar").click()
        page.wait_for_timeout(400)

        is_now_expanded = page.evaluate("() => document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert is_now_expanded, "Expected sidebar-panel to be expanded after clicking handle bar"
        
        dual_search_visible = page.evaluate("() => window.getComputedStyle(document.getElementById('dual-search-container')).display !== 'none'")
        assert dual_search_visible, "Expected dual search container to be visible when expanded"
        page.screenshot(path="screenshot_aggressive_cleanup_expanded.png")
        print("PASS: Expanded state verified.")

        # TEST: Auto-collapse on map click / pan
        print("Clicking map above bottom sheet to auto-collapse...")
        page.locator("#map-canvas-container").click(position={"x": 340, "y": 100}, force=True)
        page.wait_for_timeout(400)
        
        is_collapsed_after_click = not page.evaluate("() => document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert is_collapsed_after_click, "Expected bottom sheet to auto-collapse after clicking on map"
        print("PASS: Auto-collapsed on map click.")

        # 3. TEST ITEM 3: Zoom and Compass controls docked at bottom-left corner
        print("Verifying zoom controls and compass position on mobile...")
        zoom_bar = page.locator(".zoom-bar")
        btn_compass = page.locator("#btn-compass")
        assert zoom_bar.is_visible()
        assert btn_compass.is_visible()

        zoom_box = zoom_bar.bounding_box()
        compass_box = btn_compass.bounding_box()

        # Check left margin (~12px)
        assert abs(zoom_box['x'] - 12) <= 5, f"Expected zoom_bar left ~12px, got {zoom_box['x']}"
        assert abs(compass_box['x'] - 12) <= 5, f"Expected btn_compass left ~12px, got {compass_box['x']}"

        # Check distance from bottom of screen
        zoom_bottom_dist = viewport_height - (zoom_box['y'] + zoom_box['height'])
        compass_bottom_dist = viewport_height - (compass_box['y'] + compass_box['height'])
        print(f"Zoom bar bottom distance: {zoom_bottom_dist}px (CSS specifies 70px)")
        print(f"Compass bottom distance: {compass_bottom_dist}px (CSS specifies 175px)")
        assert 60 <= zoom_bottom_dist <= 80, f"Expected zoom bar bottom distance ~70px, got {zoom_bottom_dist}px"
        assert 165 <= compass_bottom_dist <= 190, f"Expected compass bottom distance ~175px, got {compass_bottom_dist}px"
        print("PASS: Zoom and compass docked properly above the 58px collapsed bottom sheet.")

        # 4. TEST ITEM 4: Route calculation, HUD bar, and Destination Reached Toast
        print("Calculating route to test HUD bar and destination arrival...")
        route_setup = page.evaluate("""() => {
            const all = window.getAllStores();
            const zStore = all.find(s => s.name.toLowerCase().includes('zara'));
            const targetStore = all.find(s => s.name.toLowerCase().includes('sephora') || s.name.toLowerCase().includes('mavi'));
            window.setStartLocation(zStore);
            window.setTargetLocation(targetStore);
            return {
                start: zStore ? zStore.name : null,
                target: targetStore ? targetStore.name : null
            };
        }""")
        print(f"Configured Route: {route_setup['start']} -> {route_setup['target']}")
        page.wait_for_timeout(800)

        # Check that bottom sheet is collapsed so route is visible
        sheet_collapsed_with_route = not page.evaluate("() => document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert sheet_collapsed_with_route, "Expected bottom sheet to be collapsed after route calculation"

        # Check HUD bar is visible and active
        hud_bar = page.locator("#nav-hud-bar")
        assert hud_bar.is_visible(), "Expected nav HUD bar to be visible during active route"
        assert "is-active" in hud_bar.get_attribute("class")

        # Click HUD Play button when bottom sheet is collapsed
        print("Starting simulation via HUD play button...")
        page.locator("#btn-hud-sim-play").click()
        page.wait_for_timeout(400)
        assert page.evaluate("() => cartSimulator && cartSimulator.isPlaying"), "Simulation should be playing"

        # Pause it
        page.locator("#btn-hud-sim-play").click()
        page.wait_for_timeout(200)

        # Now test: if bottom sheet is expanded and simulation is triggered, bottom sheet auto-collapses
        page.evaluate("() => expandBottomSheet()")
        page.wait_for_timeout(300)
        assert page.evaluate("() => document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        
        print("Starting simulation to verify auto-collapse...")
        page.evaluate("() => toggleCartSimulation()")
        page.wait_for_timeout(300)
        assert not page.evaluate("() => document.getElementById('sidebar-panel').classList.contains('is-expanded')"), "Expected bottom sheet to auto-collapse when simulation starts"

        # Trigger destination reached (simulation finish)
        print("Finishing simulation (destination reached)...")
        page.evaluate("() => { window.cartSimulator.finish(); }")
        page.wait_for_timeout(500)

        # Check green toast appears
        toast = page.locator("#toast-container")
        assert toast.is_visible()
        toast_text = toast.inner_text()
        print(f"Toast notification text: {toast_text}")
        assert "Hedefe ulaştınız" in toast_text, f"Expected 'Hedefe ulaştınız' in toast, got {toast_text}"

        # Crucial: NO summary card or modal should appear
        assert page.locator("#route-panel").count() == 0, "No #route-panel should exist"
        assert page.locator("#route-info-card").count() == 0, "No #route-info-card should exist"

        # Target input should be cleared, Start input should now have the target store
        start_val = page.locator("#input-start-loc").input_value()
        target_val = page.locator("#input-target-loc").input_value()
        print(f"After arrival - Start loc: '{start_val}', Target loc: '{target_val}'")
        assert target_val == "", f"Expected target input to be cleared, got '{target_val}'"
        assert len(start_val) > 0, "Expected arrived store to be set as new start location"

        page.screenshot(path="screenshot_aggressive_cleanup_destination_toast.png")
        print("PASS: Destination reached flow completed cleanly.")

        # Copy screenshots to artifact directory
        import shutil
        import os
        artifact_dir = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"
        for shot in ["screenshot_aggressive_cleanup_collapsed.png", "screenshot_aggressive_cleanup_expanded.png", "screenshot_aggressive_cleanup_destination_toast.png"]:
            if os.path.exists(shot):
                shutil.copy(shot, os.path.join(artifact_dir, shot))
                print(f"Copied {shot} to {artifact_dir}")

        browser.close()

    print(f"Console errors: {console_errors}")
    assert len(console_errors) == 0, f"Expected 0 console errors, got {len(console_errors)}: {console_errors}"
    print("ALL AGGRESSIVE UI CLEANUP TESTS PASSED WITH 0 CONSOLE ERRORS!")

if __name__ == "__main__":
    test_aggressive_ui_cleanup()
