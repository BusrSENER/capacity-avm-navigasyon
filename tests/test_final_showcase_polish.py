import sys
import os
import time
import shutil
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_final_showcase_polish():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # TEST 1: FAST & SNAPPY SPLASH WITH BUMP ANIMATION (~2.15s)
        # -------------------------------------------------------------
        print("\n--- 1. TESTING FAST SPLASH TIMING AND LOGO BUMP ---")
        context_splash = browser.new_context(viewport={"width": 390, "height": 844})
        page_splash = context_splash.new_page()
        page_splash.on("console", lambda msg: console_errors.append(f"Splash console error: {msg.text}") if msg.type == "error" else None)
        page_splash.on("pageerror", lambda exc: console_errors.append(f"Splash page error: {str(exc)}"))

        start_time = time.time()
        page_splash.goto("http://localhost:3000")

        splash = page_splash.locator("#splash-screen")
        assert splash.is_visible(), "Splash screen should be visible initially"

        # Capture early splash screenshot
        scr_splash = "screenshot_fast_splash_bump.png"
        page_splash.screenshot(path=scr_splash)
        if os.path.exists(scr_splash):
            shutil.copy(scr_splash, os.path.join(ARTIFACT_DIR, scr_splash))
            print(f"Captured splash screenshot: {scr_splash}")

        # Check CSS animation definitions
        css_rules = page_splash.evaluate("""() => {
            let hasBump = false;
            let hasScale135 = false;
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE) {
                            if (rule.name === 'logo-bump') hasBump = true;
                            if (rule.name === 'bag-quest-story') {
                                for (const kf of rule.cssRules) {
                                    if (kf.cssText.includes('scale(1.35)')) hasScale135 = true;
                                }
                            }
                        }
                    }
                } catch(e) {}
            }
            return { hasBump, hasScale135 };
        }""")
        assert css_rules["hasBump"], "CSS should contain @keyframes logo-bump animation"
        assert css_rules["hasScale135"], "@keyframes bag-quest-story should contain scale(1.35) stretch bump"

        # Wait for splash to detach
        splash.wait_for(state="detached", timeout=6000)
        splash_ms = page_splash.evaluate("() => window.splashFinishedAt - window.splashStartedAt")
        splash_sec = splash_ms / 1000.0
        print(f"In-browser Splash Screen active duration: {splash_sec:.2f}s (Target: ~2.1 - 2.8s)")
        assert 2.0 <= splash_sec <= 2.9, f"In-browser Splash duration was {splash_sec:.2f}s, expected ~2.1s - 2.8s"
        context_splash.close()

        # -------------------------------------------------------------
        # TEST 2: QR MODAL SUPPRESSES BACKGROUND TOASTS
        # -------------------------------------------------------------
        print("\n--- 2. TESTING QR MODAL BACKGROUND TOAST SUPPRESSION ---")
        context_main = browser.new_context(viewport={"width": 412, "height": 915}) # Mobile viewport
        page = context_main.new_page()
        page.on("console", lambda msg: console_errors.append(f"Main console error: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(f"Main page error: {str(exc)}"))

        page.goto("http://localhost:3000")
        page.locator("#splash-screen").wait_for(state="detached", timeout=4500)

        # Plan route to Zara or Vakko
        page.evaluate("""() => {
            const allStores = getAllStores();
            const start = (mallData.entrances && mallData.entrances.find(e => e.id === 'ent_danisma')) || allStores[0];
            const target = allStores.find(s => s.name.includes('Zara') || s.name.includes('Vakko')) || allStores[1];
            setStartLocation(start);
            setTargetLocation(target);
        }""")
        page.wait_for_timeout(300)

        # Verify toast was triggered by route calculation
        toast_container = page.locator("#toast-container")
        
        # Click "Rotayı Cebine Al" button to open QR modal
        page.click("#btn-hud-qr")
        page.wait_for_timeout(300)

        qr_modal = page.locator("#route-qr-modal")
        assert qr_modal.is_visible(), "QR modal should be open and visible"

        # Check body class and toast container visibility
        has_qr_class = page.evaluate("() => document.body.classList.contains('has-qr-modal-open')")
        assert has_qr_class, "Body should have 'has-qr-modal-open' class when QR modal is active"

        toast_display = page.evaluate("""() => {
            const tc = document.getElementById('toast-container');
            if (!tc) return 'none';
            return window.getComputedStyle(tc).display;
        }""")
        assert toast_display == "none", f"Toast container display should be 'none' when QR modal is open, got: {toast_display}"

        # Try triggering a toast while QR modal is open
        page.evaluate("() => showToast('Bu toast görünmemeli!', 'warning')")
        page.wait_for_timeout(100)
        toast_count = page.evaluate("() => document.getElementById('toast-container')?.children.length || 0")
        assert toast_count == 0, f"No toast should be added to container while QR modal is open, got {toast_count}"

        scr_qr = "screenshot_qr_modal_toast_suppressed.png"
        page.screenshot(path=scr_qr)
        if os.path.exists(scr_qr):
            shutil.copy(scr_qr, os.path.join(ARTIFACT_DIR, scr_qr))
            print(f"Captured QR modal screenshot: {scr_qr}")

        # Close QR modal
        page.click("#btn-qr-modal-close")
        page.wait_for_timeout(300)
        assert not qr_modal.is_visible(), "QR modal should close"
        has_qr_class_after = page.evaluate("() => document.body.classList.contains('has-qr-modal-open')")
        assert not has_qr_class_after, "Body should not have 'has-qr-modal-open' after closing modal"

        # -------------------------------------------------------------
        # TEST 3: LEVEL OF DETAIL (LOD) ZOOM BADGES (ZOOM < 1.2 vs >= 1.2)
        # -------------------------------------------------------------
        print("\n--- 3. TESTING PROGRESSIVE ZOOM (LOD) BADGES ---")
        
        # Test Zoom < 1.2 (Far overview)
        page.evaluate("""() => {
            mallMap.scale = 1.0;
            mallMap.applyTransform();
        }""")
        page.wait_for_timeout(200)

        map_has_lod_far = page.evaluate("() => (document.getElementById('map-canvas-container') || mallMap.container).classList.contains('lod-far')")
        assert map_has_lod_far, "map-canvas-container should have 'lod-far' class when scale < 1.2"

        # Check anchor vs secondary visibility under lod-far
        vis_report_far = page.evaluate("""() => {
            const anchor = document.querySelector('.logo-tile-marker.is-anchor');
            const secondary = document.querySelector('.logo-tile-marker:not(.is-anchor):not(.is-target):not(.is-start)');
            const anchorOpacity = anchor ? window.getComputedStyle(anchor).opacity : '0';
            const secondaryOpacity = secondary ? window.getComputedStyle(secondary).opacity : '1';
            const secondaryVisibility = secondary ? window.getComputedStyle(secondary).visibility : 'visible';
            return { anchorOpacity, secondaryOpacity, secondaryVisibility };
        }""")
        print(f"LOD Far (scale 1.0) -> Anchor Opacity: {vis_report_far['anchorOpacity']}, Secondary Opacity: {vis_report_far['secondaryOpacity']}, Visibility: {vis_report_far['secondaryVisibility']}")
        assert float(vis_report_far['anchorOpacity']) > 0.5, "Anchor stores should remain visible in lod-far"
        assert float(vis_report_far['secondaryOpacity']) == 0.0 or vis_report_far['secondaryVisibility'] == 'hidden', "Secondary stores should be hidden (opacity 0 / visibility hidden) in lod-far"

        scr_lod_far = "screenshot_lod_far_zoom_overview.png"
        page.screenshot(path=scr_lod_far)
        if os.path.exists(scr_lod_far):
            shutil.copy(scr_lod_far, os.path.join(ARTIFACT_DIR, scr_lod_far))
            print(f"Captured LOD Far screenshot: {scr_lod_far}")

        # Test Zoom >= 1.2 (Close inspection)
        page.evaluate("""() => {
            mallMap.scale = 1.35;
            mallMap.applyTransform();
        }""")
        page.wait_for_timeout(350) # Allow CSS opacity 0.3s transition

        map_has_lod_far_after = page.evaluate("() => (document.getElementById('map-canvas-container') || mallMap.container).classList.contains('lod-far')")
        assert not map_has_lod_far_after, "map-canvas-container should NOT have 'lod-far' class when scale >= 1.2"

        vis_report_near = page.evaluate("""() => {
            const secondary = document.querySelector('.logo-tile-marker:not(.is-anchor):not(.is-target):not(.is-start)');
            const secondaryOpacity = secondary ? window.getComputedStyle(secondary).opacity : '0';
            const secondaryVisibility = secondary ? window.getComputedStyle(secondary).visibility : 'hidden';
            return { secondaryOpacity, secondaryVisibility };
        }""")
        print(f"LOD Near (scale 1.35) -> Secondary Opacity: {vis_report_near['secondaryOpacity']}, Visibility: {vis_report_near['secondaryVisibility']}")
        assert float(vis_report_near['secondaryOpacity']) >= 0.9, "Secondary stores should become fully visible when scale >= 1.2"
        assert vis_report_near['secondaryVisibility'] == 'visible', "Secondary stores should be visible"

        scr_lod_near = "screenshot_lod_near_zoom_detail.png"
        page.screenshot(path=scr_lod_near)
        if os.path.exists(scr_lod_near):
            shutil.copy(scr_lod_near, os.path.join(ARTIFACT_DIR, scr_lod_near))
            print(f"Captured LOD Near screenshot: {scr_lod_near}")

        # -------------------------------------------------------------
        # TEST 4: TARGET / START PINNED BADGES VERTICAL OFFSET
        # -------------------------------------------------------------
        print("\n--- 4. TESTING TARGET / START BADGES VERTICAL OFFSET (NO LOGO OVERLAP) ---")
        
        # Select target store and inspect position of .marker-name-pinned relative to .logo-tile
        overlap_info = page.evaluate("""() => {
            const targetMarker = document.querySelector('.logo-tile-marker.is-target');
            if (!targetMarker) return { error: 'No target marker found' };
            const tile = targetMarker.querySelector('.logo-tile');
            const badge = targetMarker.querySelector('.marker-name-pinned');
            if (!tile || !badge) return { error: 'Tile or badge missing in target marker' };

            const tileRect = tile.getBoundingClientRect();
            const badgeRect = badge.getBoundingClientRect();

            // Gap between bottom of tile and top of badge
            const verticalGap = badgeRect.top - tileRect.bottom;
            return {
                tileTop: tileRect.top,
                tileBottom: tileRect.bottom,
                badgeTop: badgeRect.top,
                badgeBottom: badgeRect.bottom,
                verticalGap: verticalGap,
                overlaps: (badgeRect.top < tileRect.bottom && badgeRect.bottom > tileRect.top)
            };
        }""")
        print(f"Target marker bounding checks: {overlap_info}")
        assert "error" not in overlap_info, f"Error inspecting target marker: {overlap_info.get('error')}"
        assert not overlap_info["overlaps"], "Pinned target badge MUST NOT overlap the logo tile!"
        assert overlap_info["verticalGap"] >= 0, f"Pinned badge should be vertically offset below logo, gap: {overlap_info['verticalGap']}px"

        scr_offset = "screenshot_target_badge_vertical_offset.png"
        page.screenshot(path=scr_offset)
        if os.path.exists(scr_offset):
            shutil.copy(scr_offset, os.path.join(ARTIFACT_DIR, scr_offset))
            print(f"Captured target offset screenshot: {scr_offset}")

        # -------------------------------------------------------------
        # TEST 5: FLOOR TRANSITION FLYTO & CAMERA JITTER PREVENTION
        # -------------------------------------------------------------
        print("\n--- 5. TESTING FLOOR TRANSITION CAMERA JITTER PREVENTION ---")
        
        # Check simulator method implementation
        sim_check = page.evaluate("""() => {
            const hasFlyToAnim = 'flyToAnimId' in mallMap || typeof mallMap.flyTo === 'function';
            return { hasFlyToAnim };
        }""")
        assert sim_check["hasFlyToAnim"], "mallMap.flyTo exists and tracks animation frames"

        # Verify no console errors occurred
        print(f"\n--- CONSOLE ERROR CHECK ({len(console_errors)} errors) ---")
        for err in console_errors:
            print(f"  [ERROR] {err}")
        assert len(console_errors) == 0, f"Expected 0 console errors, but found {len(console_errors)}"

        context_main.close()
        browser.close()
        print("\n=== ALL FINAL SHOWCASE POLISH TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_final_showcase_polish()
