import sys
import time
from playwright.sync_api import sync_playwright

def run():
    console_errors = []
    page_errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1600, 'height': 950})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type in ["error"] else logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:3000/ ...")
        page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        time.sleep(2)

        # Check map elements and viewBox
        svg_info = page.evaluate("""() => {
            const svg = document.getElementById('map-svg-element');
            const routeSvg = document.getElementById('route-svg');
            const routeZ = routeSvg ? window.getComputedStyle(routeSvg).zIndex : null;
            return {
                viewBox: svg ? svg.getAttribute('viewBox') : null,
                routeZIndex: routeZ,
                markersCount: document.querySelectorAll('.logo-tile-marker').length,
                storeCardsCount: document.querySelectorAll('.store-card').length,
                storePolygonsCount: document.querySelectorAll('.store-polygon').length
            };
        }""")
        print("Initial Map Info:", svg_info)

        # Check Quick Start buttons
        quick_btns = page.evaluate("""() => {
            return {
                fisekhane: !!document.getElementById('btn-quick-fisekhane'),
                carousel: !!document.getElementById('btn-quick-carousel'),
                danisma: !!document.getElementById('btn-quick-danisma')
            };
        }""")
        print("Quick Start Buttons Present:", quick_btns)

        # Click Carousel quick start button
        print("Clicking Carousel Quick Start Button (#btn-quick-carousel)...")
        page.click("#btn-quick-carousel")
        time.sleep(0.5)

        badge_text = page.evaluate("() => document.getElementById('start-badge-text') ? document.getElementById('start-badge-text').innerText : ''")
        print("Start Location Badge Text:", badge_text)

        # Search for 'Beymen' in the search bar
        print("Searching for store 'Beymen' in #search-input...")
        page.fill("#search-input", "Beymen")
        time.sleep(0.8)

        # Check store cards in the grid
        store_cards = page.query_selector_all(".store-card")
        print(f"Found {len(store_cards)} store card(s) for 'Beymen'")
        
        # Click the first store card
        if store_cards:
            print("Clicking first store card...")
            store_cards[0].click()
            time.sleep(0.8)

        # Verify POI detail is visible and click "Buraya Yol Tarifi Al" (#poi-route-btn)
        poi_route_btn = page.query_selector("#poi-route-btn")
        if poi_route_btn and poi_route_btn.is_visible():
            print("Clicking #poi-route-btn ('Buraya Yol Tarifi Al')...")
            poi_route_btn.click()
            time.sleep(1.5)
        else:
            print("Warning: #poi-route-btn not visible!")

        # Check route SVG layer
        route_info = page.evaluate("""() => {
            const line = document.querySelector('#route-svg .route__line');
            const path = document.querySelector('#route-svg path');
            const routeSvg = document.getElementById('route-svg');
            return {
                routeSvgFound: !!routeSvg,
                routeLineFound: !!line,
                pathD: line ? line.getAttribute('d') : (path ? path.getAttribute('d') : null),
                strokeColor: line ? window.getComputedStyle(line).stroke : (path ? window.getComputedStyle(path).stroke : null),
                strokeDash: line ? window.getComputedStyle(line).strokeDasharray : null,
                zIndex: routeSvg ? window.getComputedStyle(routeSvg).zIndex : null,
                distanceText: document.getElementById('route-distance')?.innerText,
                timeText: document.getElementById('route-time')?.innerText
            };
        }""")
        print("Route rendering info:", route_info)

        # Take screenshot of route
        page.screenshot(path="screenshot_1400_route.png")
        print("Saved screenshot_1400_route.png")

        # Click "Sepeti Başlat" (#sim-play-btn)
        sim_btn = page.query_selector("#sim-play-btn")
        if sim_btn and sim_btn.is_visible():
            print("Starting Cart Simulation (#sim-play-btn)...")
            sim_btn.click()
            # Wait for simulation to run for 3.5 seconds
            time.sleep(3.5)

            # Check cart state
            sim_state = page.evaluate("""() => {
                const avatar = document.getElementById('avatar-cart');
                const progressBar = document.getElementById('sim-progress-bar');
                return {
                    avatarFound: !!avatar,
                    avatarTransform: avatar ? avatar.style.transform : null,
                    avatarVisible: avatar ? window.getComputedStyle(avatar).display : null,
                    progressWidth: progressBar ? progressBar.style.width : null
                };
            }""")
            print("Cart Simulation State:", sim_state)

            page.screenshot(path="screenshot_1400_sim.png")
            print("Saved screenshot_1400_sim.png")
        else:
            print("Warning: #sim-play-btn not found or not visible!")

        print("\n--- TEST SUMMARY ---")
        print(f"Total Console Errors: {len(console_errors)}")
        for err in console_errors:
            print("  ERROR:", err)
        print(f"Total Page Errors: {len(page_errors)}")
        for err in page_errors:
            print("  PAGE ERROR:", err)

        browser.close()

if __name__ == "__main__":
    run()
