import sys
import time
from playwright.sync_api import sync_playwright

def run():
    console_errors = []
    page_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True
        )
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:3000/ ...")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        time.sleep(2)

        # 1. Open Entrance Modal via [ 📍 Nereden? ]
        print("1. Clicking [ 📍 Nereden? ] input to open entrance modal...")
        page.click("#input-start-loc")
        time.sleep(0.5)

        modal_visible = page.is_visible("#entrance-modal")
        assert modal_visible, "Entrance modal is not visible!"

        # 2. Select 'Müzikli Gösteri Havuzu'
        print("2. Selecting 'Müzikli Gösteri Havuzu (Etkinlik Alanı)' from entrance modal...")
        havuz_btn = page.query_selector("[data-loc-id='start_havuz']")
        assert havuz_btn, "Could not find start_havuz button in modal!"
        havuz_btn.click()
        time.sleep(0.8)

        # Verify start input has Havuz
        start_val = page.evaluate("() => document.getElementById('input-start-loc')?.value")
        print(f"   Start input value: '{start_val}'")
        assert "Havuz" in start_val, f"Unexpected start input: {start_val}"

        # Verify start nav_node
        start_node = page.evaluate("() => selectedStartStore ? selectedStartStore.nav_node : null")
        print(f"   selectedStartStore.nav_node: '{start_node}'")
        assert start_node == "c_4_m_700", f"nav_node should be 'c_4_m_700', got: '{start_node}'"

        # 3. Expand Bottom Sheet & Select 'Avva'
        print("3. Expanding bottom sheet & searching for 'Avva' in [ 🎯 Nereye? ]...")
        page.click("#floating-view-toggle")
        time.sleep(0.5)

        page.fill("#input-target-loc", "Avva")
        time.sleep(0.8)

        cards = page.query_selector_all(".store-card")
        print(f"   Found {len(cards)} store card(s)")
        assert len(cards) > 0, "Avva store card not found!"
        cards[0].click()
        time.sleep(1.5)

        # 4. Verify Route Generation
        route_info = page.evaluate("""() => {
            const line = document.querySelector('#route-svg .route__line');
            const dist = document.getElementById('hud-distance')?.innerText.trim();
            const time = document.getElementById('hud-time')?.innerText.trim();
            const name = document.getElementById('hud-route-name')?.innerText.trim();
            const hud = document.getElementById('nav-hud-bar');
            return {
                hasRouteLine: !!line,
                hudActive: hud ? hud.classList.contains('is-active') : false,
                dist,
                time,
                name
            };
        }""")
        print("4. Route Evaluation:", route_info)
        assert route_info['hasRouteLine'], "CRITICAL: Route line SVG was not generated!"
        assert route_info['hudActive'], "HUD bar is not active!"
        assert "129" in route_info['dist'] or "m" in route_info['dist'], f"Unexpected distance: {route_info['dist']}"
        assert "Avva" in route_info['name'], f"Target Avva not in route name: {route_info['name']}"
        assert "Havuz" in route_info['name'], f"Start Havuz not in route name: {route_info['name']}"

        # 5. Verify Toast Queue / Stacking Prevention
        print("5. Testing rapid toasts stacking prevention...")
        toast_count = page.evaluate("""() => {
            showToast('Test 1', 'info');
            showToast('Test 2', 'warning');
            showToast('Test 3', 'success');
            const container = document.getElementById('toast-container');
            return container ? container.children.length : 0;
        }""")
        print(f"   Toast elements count in DOM after 3 rapid calls: {toast_count}")
        assert toast_count == 1, f"Toast queue failed: expected exactly 1 toast, found {toast_count}!"

        # 6. Take Screenshot of Havuz -> Avva Route
        page.screenshot(path="screenshot_havuz_avva_route.png")
        print("6. Saved screenshot_havuz_avva_route.png successfully!")

        # 7. Check Console Errors
        print("\n--- CONSOLE ERRORS ---")
        for err in console_errors:
            print("  ERROR:", err)
        assert len(console_errors) == 0, f"Found {len(console_errors)} console errors!"
        assert len(page_errors) == 0, f"Found {len(page_errors)} page errors!"

        browser.close()
        print("\n🎉 ALL TESTS FOR HAVUZ ➔ AVVA AND TOAST QUEUE PASSED WITH 0 ERRORS!")

if __name__ == "__main__":
    run()
