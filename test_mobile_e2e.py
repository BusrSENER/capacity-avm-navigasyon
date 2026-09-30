import sys
import time
from playwright.sync_api import sync_playwright

def run():
    console_errors = []
    page_errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # iPhone 13 / 14 mobile viewport
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            is_mobile=True,
            has_touch=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:3000/ on mobile...")
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
            const fisekhaneBtn = document.getElementById('btn-quick-fisekhane');
            const carouselBtn = document.getElementById('btn-quick-carousel');
            const searchInput = document.getElementById('search-input');
            const floatBtn = document.getElementById('floating-view-toggle');
            const sRect = sheet ? sheet.getBoundingClientRect() : null;
            return {
                sheetTop: sRect ? sRect.top : null,
                sheetHeightVisible: sRect ? (window.innerHeight - sRect.top) : null,
                handleVisible: handle ? (handle.getBoundingClientRect().height > 0) : false,
                carouselVisible: carouselBtn ? (carouselBtn.getBoundingClientRect().height > 0) : false,
                searchVisible: searchInput ? (searchInput.getBoundingClientRect().height > 0) : false,
                floatingBtnText: floatBtn ? floatBtn.innerText.trim() : null
            };
        }""")
        print("2. Bottom Sheet Peek State:", sheet_peek)
        assert 110 <= sheet_peek['sheetHeightVisible'] <= 160, f"Peek height unexpected: {sheet_peek['sheetHeightVisible']}"
        assert sheet_peek['carouselVisible'], "Carousel quick start button not visible in peek mode!"

        # 3. Click Carousel Quick Start Button in Peek Mode
        print("3. Clicking Carousel Entrance (#btn-quick-carousel)...")
        page.click("#btn-quick-carousel")
        time.sleep(0.5)

        badge_text = page.evaluate("() => document.getElementById('start-badge-text')?.innerText.trim()")
        print("   Start location badge text:", badge_text)
        assert "Carousel" in badge_text, f"Badge not updated to Carousel: {badge_text}"

        # 4. Expand Bottom Sheet via Floating Action Button (#floating-view-toggle)
        print("4. Clicking Floating View Toggle to expand Bottom Sheet...")
        page.click("#floating-view-toggle")
        time.sleep(0.6)

        sheet_expanded = page.evaluate("""() => {
            const sheet = document.getElementById('sidebar-panel');
            const floatBtn = document.getElementById('floating-view-toggle');
            const sRect = sheet ? sheet.getBoundingClientRect() : null;
            return {
                isExpandedClass: sheet ? sheet.classList.contains('is-expanded') : false,
                sheetTop: sRect ? sRect.top : null,
                sheetHeightVisible: sRect ? (window.innerHeight - sRect.top) : null,
                floatingBtnText: floatBtn ? floatBtn.innerText.trim() : null
            };
        }""")
        print("   Bottom Sheet Expanded State:", sheet_expanded)
        assert sheet_expanded['isExpandedClass'], "Sheet should have .is-expanded class!"
        assert sheet_expanded['sheetHeightVisible'] > 500, "Sheet should be expanded to ~75vh!"

        # 5. Search for "Beymen" and select store
        print("5. Searching for 'Beymen' in #search-input...")
        page.fill("#search-input", "Beymen")
        time.sleep(0.8)

        store_cards = page.query_selector_all(".store-card")
        print(f"   Found {len(store_cards)} store card(s)")
        assert len(store_cards) > 0, "No store card found for 'Beymen'!"
        store_cards[0].click()
        time.sleep(0.8)

        # 6. Request route ("Buraya Yol Tarifi Al")
        print("6. Clicking #poi-route-btn ('Buraya Yol Tarifi Al')...")
        poi_route_btn = page.query_selector("#poi-route-btn")
        assert poi_route_btn and poi_route_btn.is_visible(), "Route button not visible in POI detail!"
        poi_route_btn.click()
        time.sleep(1.5)

        # 7. Verify bottom sheet auto-collapsed back to peek, route panel open, route line visible
        route_state = page.evaluate("""() => {
            const sheet = document.getElementById('sidebar-panel');
            const routeCard = document.getElementById('route-info-card');
            const line = document.querySelector('#route-svg .route__line');
            const sRect = sheet ? sheet.getBoundingClientRect() : null;
            const rRect = routeCard ? routeCard.getBoundingClientRect() : null;
            return {
                sheetIsExpanded: sheet ? sheet.classList.contains('is-expanded') : true,
                sheetVisibleHeight: sRect ? (window.innerHeight - sRect.top) : null,
                routeCardVisible: routeCard ? !routeCard.classList.contains('hidden') : false,
                routeCardTop: rRect ? rRect.top : null,
                routeLineFound: !!line,
                pathD: line ? line.getAttribute('d') : null,
                strokeColor: line ? window.getComputedStyle(line).stroke : null,
                distance: document.getElementById('route-distance')?.innerText,
                duration: document.getElementById('route-time')?.innerText
            };
        }""")
        print("7. Route & Sheet State after Routing:", route_state)
        assert not route_state['sheetIsExpanded'], "Bottom sheet should auto-collapse when route is created!"
        assert route_state['routeCardVisible'], "Route info card should be visible!"
        assert route_state['routeLineFound'], "Route line SVG should be rendered!"
        assert "rgb(37, 99, 235)" in route_state['strokeColor'], "Route line should be bright blue #2563eb!"

        # 8. Start Cart Simulation
        print("8. Starting cart simulation (#sim-play-btn)...")
        sim_btn = page.query_selector("#sim-play-btn")
        assert sim_btn and sim_btn.is_visible(), "#sim-play-btn not visible!"
        sim_btn.click()
        time.sleep(3)

        sim_progress = page.evaluate("""() => {
            const bar = document.getElementById('sim-progress-bar');
            return bar ? bar.style.width : null;
        }""")
        print("   Simulation Progress:", sim_progress)

        # 9. Take Screenshot
        page.screenshot(path="screenshot_mobile_view.png")
        print("9. Saved screenshot_mobile_view.png successfully!")

        # 10. Console Error Verification
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
        print("ALL MOBILE E2E TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run()
