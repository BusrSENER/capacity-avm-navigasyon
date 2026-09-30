import sys
import time
from playwright.sync_api import sync_playwright

def run():
    console_errors = []
    page_errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # iPhone 13 / 14 mobile viewport (390 x 844)
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:3000/ on mobile (390x844)...")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        time.sleep(2)

        # 1. Verify Full-screen background map
        map_info = page.evaluate("""() => {
            const mapArea = document.getElementById('main-map-area');
            const mapCanvas = document.getElementById('map-canvas-container');
            const svgEl = document.getElementById('map-svg-element');
            const rect = mapArea ? mapArea.getBoundingClientRect() : null;
            return {
                exists: !!mapArea,
                rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
                svgFound: !!svgEl,
                viewBox: svgEl ? svgEl.getAttribute('viewBox') : null
            };
        }""")
        print("1. Mobile Full-Screen Map:", map_info)
        assert map_info['exists'] and map_info['rect']['width'] == 390 and map_info['rect']['height'] == 844, "Map is not full screen!"

        # 2. Verify Bottom Sheet in Peek Mode
        sheet_peek = page.evaluate("""() => {
            const sheet = document.getElementById('sidebar-panel');
            const handle = document.getElementById('bottom-sheet-handle-bar');
            const carouselBtn = document.getElementById('btn-quick-carousel');
            const startInput = document.getElementById('input-start-loc');
            const targetInput = document.getElementById('input-target-loc');
            const floatBtn = document.getElementById('floating-view-toggle');
            const sRect = sheet ? sheet.getBoundingClientRect() : null;
            return {
                sheetTop: sRect ? sRect.top : null,
                sheetHeightVisible: sRect ? (window.innerHeight - sRect.top) : null,
                handleVisible: handle ? (handle.getBoundingClientRect().height > 0) : false,
                carouselVisible: carouselBtn ? (carouselBtn.getBoundingClientRect().height > 0) : false,
                startInputVal: startInput ? startInput.value : null,
                targetInputVal: targetInput ? targetInput.value : null,
                floatingBtnText: floatBtn ? floatBtn.innerText.trim() : null
            };
        }""")
        print("2. Bottom Sheet Peek State:", sheet_peek)
        assert 110 <= sheet_peek['sheetHeightVisible'] <= 185, f"Peek height unexpected: {sheet_peek['sheetHeightVisible']}"
        assert sheet_peek['carouselVisible'], "Carousel quick start button not visible in peek mode!"

        # 3. Verify Dual Inputs initially empty & NO route drawn
        print("3. Checking dual inputs initially empty and no route drawn...")
        init_route_check = page.evaluate("""() => {
            const startVal = document.getElementById('input-start-loc')?.value;
            const targetVal = document.getElementById('input-target-loc')?.value;
            const line = document.querySelector('#route-svg .route__line');
            const hud = document.getElementById('nav-hud-bar');
            return {
                startVal,
                targetVal,
                hasRouteLine: !!line,
                hudActive: hud ? hud.classList.contains('is-active') : false
            };
        }""")
        print("   Initial State:", init_route_check)
        assert init_route_check['startVal'] == '', "Start input should be initially empty!"
        assert init_route_check['targetVal'] == '', "Target input should be initially empty!"
        assert not init_route_check['hasRouteLine'], "No route should be drawn initially!"
        assert not init_route_check['hudActive'], "HUD should not be active initially!"

        # 4. Test Route Preference Tabs
        print("4. Testing route preference tabs ([ 🚶 Yürüyen Merdiven ] vs [ 🛗 Asansör / Bebek ])...")
        page.click("#tab-pref-elevator")
        time.sleep(0.3)
        pref_ele = page.evaluate("""() => {
            const btn = document.getElementById('tab-pref-elevator');
            return btn ? btn.classList.contains('bg-red-600') : false;
        }""")
        assert pref_ele, "Elevator tab should be active after click!"

        page.click("#tab-pref-escalator")
        time.sleep(0.3)
        pref_esc = page.evaluate("""() => {
            const btn = document.getElementById('tab-pref-escalator');
            return btn ? btn.classList.contains('bg-red-600') : false;
        }""")
        assert pref_esc, "Escalator tab should be active after click!"

        # 5. Select Start Location via Carousel Entrance chip
        print("5. Clicking Carousel Entrance chip (#btn-quick-carousel)...")
        page.click("#btn-quick-carousel")
        time.sleep(0.5)

        start_selected = page.evaluate("""() => {
            const startVal = document.getElementById('input-start-loc')?.value;
            const line = document.querySelector('#route-svg .route__line');
            return {
                startVal,
                hasRouteLine: !!line
            };
        }""")
        print("   After selecting start:", start_selected)
        assert "Carousel" in start_selected['startVal'], f"Start input should contain 'Carousel', got: {start_selected['startVal']}"
        assert not start_selected['hasRouteLine'], "STRICT GUARD: No route must be drawn until BOTH points are selected!"

        # 6. Expand Bottom Sheet and Select Target Location ("Beymen Club")
        print("6. Expanding Bottom Sheet and searching for 'Beymen'...")
        page.click("#floating-view-toggle")
        time.sleep(0.6)

        page.fill("#input-target-loc", "Beymen")
        time.sleep(0.8)

        store_cards = page.query_selector_all(".store-card")
        print(f"   Found {len(store_cards)} store card(s)")
        assert len(store_cards) > 0, "No store card found for 'Beymen'!"
        store_cards[0].click()
        time.sleep(1.5)

        # 7. Verify Route Creation & Minimal 64px HUD Bar
        print("7. Verifying route creation and minimal 64px HUD bar...")
        hud_state = page.evaluate("""() => {
            const hud = document.getElementById('nav-hud-bar');
            const hRect = hud ? hud.getBoundingClientRect() : null;
            const line = document.querySelector('#route-svg .route__line');
            const dist = document.getElementById('hud-distance')?.innerText.trim();
            const time = document.getElementById('hud-time')?.innerText.trim();
            const routeName = document.getElementById('hud-route-name')?.innerText.trim();
            const routePanel = document.getElementById('route-panel');
            const rComputed = routePanel ? window.getComputedStyle(routePanel).display : null;
            return {
                hudExists: !!hud,
                hudActive: hud ? hud.classList.contains('is-active') : false,
                hudHeight: hRect ? hRect.height : null,
                hudBottom: hRect ? hRect.bottom : null,
                hasRouteLine: !!line,
                stroke: line ? window.getComputedStyle(line).stroke : null,
                distance: dist,
                time: time,
                routeName: routeName,
                routePanelDisplay: rComputed
            };
        }""")
        print("   HUD & Route State:", hud_state)
        assert hud_state['hudActive'], "HUD bar should have .is-active class!"
        assert hud_state['hudHeight'] == 64, f"HUD height must be 64px, got {hud_state['hudHeight']}"
        assert hud_state['hasRouteLine'], "Route line SVG should be rendered!"
        assert "rgb(37, 99, 235)" in hud_state['stroke'], "Route line should be bright blue!"
        assert hud_state['routePanelDisplay'] == 'none', "Bulky route panel should be hidden in favor of minimal HUD!"
        assert hud_state['distance'] and hud_state['distance'] != '0 m', "Distance should be calculated!"

        # 8. Test Step-by-Step Details Drawer Open & Close (Without clearing route)
        print("8. Testing Step-by-Step details drawer (#btn-hud-steps-toggle & #btn-hud-steps-close)...")
        page.click("#btn-hud-steps-toggle")
        time.sleep(0.5)

        drawer_open = page.evaluate("""() => {
            const drawer = document.getElementById('hud-steps-drawer');
            const list = document.getElementById('hud-steps-list');
            return {
                visible: drawer ? !drawer.classList.contains('hidden') : false,
                itemsCount: list ? list.children.length : 0
            };
        }""")
        print("   Drawer Open State:", drawer_open)
        assert drawer_open['visible'], "Steps drawer should be visible after toggle!"
        assert drawer_open['itemsCount'] > 0, "Steps drawer should contain step instructions!"

        # Close steps drawer
        page.click("#btn-hud-steps-close")
        time.sleep(0.5)

        drawer_closed = page.evaluate("""() => {
            const drawer = document.getElementById('hud-steps-drawer');
            const line = document.querySelector('#route-svg .route__line');
            return {
                hidden: drawer ? drawer.classList.contains('hidden') : false,
                hasRouteLine: !!line
            };
        }""")
        print("   Drawer Closed State:", drawer_closed)
        assert drawer_closed['hidden'], "Steps drawer should be hidden!"
        assert drawer_closed['hasRouteLine'], "CRITICAL: Route line must STAY on map after closing drawer!"

        # 9. Start Cart Simulation from HUD
        print("9. Starting cart simulation from HUD (#btn-hud-sim-play)...")
        page.click("#btn-hud-sim-play")
        time.sleep(3)

        sim_progress = page.evaluate("""() => {
            const hudText = document.getElementById('hud-sim-text')?.innerText.trim();
            const pct = document.getElementById('hud-progress-pct')?.innerText.trim();
            const bar = document.getElementById('sim-progress-bar')?.style.width;
            return { hudText, pct, bar };
        }""")
        # Capture screenshot while route, cart and 64px HUD are active
        page.screenshot(path="screenshot_mobile_route_hud.png")
        print("   Saved screenshot_mobile_route_hud.png during active route!")

        # 10. Verify UI Collision Avoidance (Zoom Controls in Middle, No Overlap)
        print("10. Checking UI collision avoidance between zoom buttons and other controls...")
        collision_check = page.evaluate("""() => {
            const zoom = document.querySelector('.zoom-bar');
            const floors = document.querySelector('.floors-pill-bar');
            const hud = document.getElementById('nav-hud-bar');
            const zRect = zoom ? zoom.getBoundingClientRect() : null;
            const fRect = floors ? floors.getBoundingClientRect() : null;
            const hRect = hud ? hud.getBoundingClientRect() : null;

            // Check if zoom overlaps with floors or hud
            const overlapWithFloors = zRect && fRect && !(zRect.bottom < fRect.top || zRect.top > fRect.bottom || zRect.right < fRect.left || zRect.left > fRect.right);
            const overlapWithHud = zRect && hRect && !(zRect.bottom < hRect.top || zRect.top > hRect.bottom || zRect.right < hRect.left || zRect.left > hRect.right);

            // Verify zoom is vertically centered (~50% of viewport)
            const zoomCenterY = zRect ? (zRect.top + zRect.height / 2) : 0;
            const screenCenterY = window.innerHeight / 2;
            const isNearCenter = Math.abs(zoomCenterY - screenCenterY) < 60;

            return {
                zRect,
                fRect,
                overlapWithFloors,
                overlapWithHud,
                zoomCenterY,
                screenCenterY,
                isNearCenter
            };
        }""")
        print("   Collision Check:", collision_check)
        assert not collision_check['overlapWithFloors'], "Zoom bar overlaps with floor selector!"
        assert not collision_check['overlapWithHud'], "Zoom bar overlaps with HUD!"
        assert collision_check['isNearCenter'], f"Zoom bar should be near vertical center (50%), got center {collision_check['zoomCenterY']} vs {collision_check['screenCenterY']}"

        # 11. Test [ ✖ Rotayı Bitir ] (#btn-hud-finish)
        print("11. Testing finish route (#btn-hud-finish)...")
        page.click("#btn-hud-finish")
        time.sleep(0.8)

        finish_state = page.evaluate("""() => {
            const hud = document.getElementById('nav-hud-bar');
            const line = document.querySelector('#route-svg .route__line');
            const startVal = document.getElementById('input-start-loc')?.value;
            const targetVal = document.getElementById('input-target-loc')?.value;
            return {
                hudActive: hud ? hud.classList.contains('is-active') : false,
                hasRouteLine: !!line,
                startVal,
                targetVal
            };
        }""")
        print("   After Finish Route:", finish_state)
        assert not finish_state['hudActive'], "HUD should be hidden after finishing route!"
        assert not finish_state['hasRouteLine'], "Route should be cleared from map!"
        assert finish_state['startVal'] == '', "Start input should be cleared!"
        assert finish_state['targetVal'] == '', "Target input should be cleared!"

        # 12. Take Screenshot for Verification
        page.screenshot(path="screenshot_mobile_view.png")
        print("12. Saved screenshot_mobile_view.png successfully!")

        # 13. Console Error Verification
        print("\n--- MOBILE TEST SUMMARY ---")
        print(f"Total Console Errors: {len(console_errors)}")
        for err in console_errors:
            print("  ERROR:", err)
        print(f"Total Page Errors: {len(page_errors)}")
        for err in page_errors:
            print("  PAGE ERROR:", err)

        assert len(console_errors) == 0, f"Found {len(console_errors)} console error(s)!"
        assert len(page_errors) == 0, f"Found {len(page_errors)} page error(s)!"

        browser.close()
        print("\n🎉 ALL MOBILE UX & NAVIGATION E2E TESTS PASSED WITH 0 ERRORS!")

if __name__ == "__main__":
    run()
