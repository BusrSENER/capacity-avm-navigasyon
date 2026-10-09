import sys
import os
import time
import shutil
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_pool_bypass_and_live_hud():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # TEST 1: MINIMALIST LUXURY SPLASH SCREEN (~1.8 - 2.0s)
        # -------------------------------------------------------------
        print("\n--- 1. TESTING MINIMALIST SPLASH SCREEN & CLEAN REVEAL ---")
        context_splash = browser.new_context(viewport={"width": 390, "height": 844})
        page_splash = context_splash.new_page()
        page_splash.on("console", lambda msg: console_errors.append(f"Splash console error: {msg.text}") if msg.type == "error" else None)
        page_splash.on("pageerror", lambda exc: console_errors.append(f"Splash page error: {str(exc)}"))

        page_splash.goto("http://localhost:3000")

        splash = page_splash.locator("#splash-screen")
        assert splash.is_visible(), "Splash screen should be visible initially"

        # Verify static horizontal line and emotion badges were removed
        static_line_count = page_splash.locator("#splash-bag-track > div.h-\\[1\\.5px\\]").count()
        assert static_line_count == 0, f"Static line should be removed, found {static_line_count}"

        badge_q_count = page_splash.locator("#splash-badge-question").count()
        badge_excl_count = page_splash.locator("#splash-badge-exclamation").count()
        assert badge_q_count == 0, "Question emotion badge should be removed"
        assert badge_excl_count == 0, "Exclamation emotion badge should be removed"

        # Capture splash screenshot
        scr_splash = "screenshot_minimalist_luxury_splash.png"
        page_splash.screenshot(path=scr_splash)
        if os.path.exists(scr_splash):
            shutil.copy(scr_splash, os.path.join(ARTIFACT_DIR, scr_splash))
            print(f"Captured splash screenshot: {scr_splash}")

        # Check CSS animation definitions
        css_rules = page_splash.evaluate("""() => {
            let hasBreath = false;
            let hasGlide = false;
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE) {
                            if (rule.name === 'splash-logo-breath') hasBreath = true;
                            if (rule.name === 'splash-bag-glide') hasGlide = true;
                        }
                    }
                } catch(e) {}
            }
            return { hasBreath, hasGlide };
        }""")
        assert css_rules["hasBreath"], "CSS should contain @keyframes splash-logo-breath animation"
        assert css_rules["hasGlide"], "CSS should contain @keyframes splash-bag-glide animation"

        # Wait for splash to detach
        splash.wait_for(state="detached", timeout=5000)
        splash_ms = page_splash.evaluate("() => window.splashFinishedAt - window.splashStartedAt")
        splash_sec = splash_ms / 1000.0
        print(f"In-browser Splash Screen duration: {splash_sec:.2f}s (Target: ~1.8s - 2.2s)")
        assert 1.7 <= splash_sec <= 2.5, f"In-browser Splash duration was {splash_sec:.2f}s, expected ~1.8s - 2.2s"
        context_splash.close()

        # -------------------------------------------------------------
        # TEST 2: POOL BYPASS VERIFICATION (ZEN -> ELEVATOR & CORRIDORS)
        # -------------------------------------------------------------
        print("\n--- 2. TESTING POOL BYPASS NAVIGATION (DIJKSTRA) ---")
        context_main = browser.new_context(viewport={"width": 412, "height": 915})
        page = context_main.new_page()
        page.on("console", lambda msg: console_errors.append(f"Main console error: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(f"Main page error: {str(exc)}"))

        page.goto("http://localhost:3000")
        page.locator("#splash-screen").wait_for(state="detached", timeout=4500)

        # Test pool bypass in browser JS environment
        pool_test_result = page.evaluate("""() => {
            const allStores = getAllStores();
            const zen = allStores.find(s => s.name === 'Zen');
            const atasay = allStores.find(s => s.name === 'Atasay');
            const twist = allStores.find(s => s.name === 'Twist');
            const koton = allStores.find(s => s.name === 'Koton');

            // 1. Zen -> Elevator (c_4_m_565)
            const rZen = navEngine.findRoute(zen.nav_node, 'c_4_m_565');
            const zenHasPoolNode = rZen ? rZen.pathNodes.some(n => n.id === 'c_4_m_700') : false;

            // 2. South corridor -> North corridor
            const rSouthNorth = navEngine.findRoute('c_4_s_680', 'c_4_n_680');
            const snHasPoolNode = rSouthNorth ? rSouthNorth.pathNodes.some(n => n.id === 'c_4_m_700') : false;

            // 3. Twist -> Carousel entrance
            const rTwist = navEngine.findRoute(twist.nav_node, 'c_4_car_gate');
            const twistHasPoolNode = rTwist ? rTwist.pathNodes.some(n => n.id === 'c_4_m_700') : false;

            return {
                zenRouteFound: !!rZen,
                zenDist: rZen ? rZen.totalDistance : 0,
                zenHasPoolNode,
                zenPath: rZen ? rZen.pathNodes.map(n => n.id) : [],
                snRouteFound: !!rSouthNorth,
                snHasPoolNode,
                twistHasPoolNode
            };
        }""")

        print(f"Zen -> Elevator Route found: {pool_test_result['zenRouteFound']}, Distance: {pool_test_result['zenDist']}m")
        print(f"Zen -> Elevator Path: {' -> '.join(pool_test_result['zenPath'])}")
        print(f"Zen path contains c_4_m_700 (pool)? {pool_test_result['zenHasPoolNode']}")
        print(f"South-North corridor contains c_4_m_700 (pool)? {pool_test_result['snHasPoolNode']}")
        print(f"Twist -> Carousel contains c_4_m_700 (pool)? {pool_test_result['twistHasPoolNode']}")

        assert pool_test_result["zenRouteFound"], "Route from Zen to Elevator must be found"
        assert not pool_test_result["zenHasPoolNode"], "Zen to Elevator route must NOT pass through pool node c_4_m_700"
        assert not pool_test_result["snHasPoolNode"], "South-North corridor route must NOT pass through pool node c_4_m_700"
        assert not pool_test_result["twistHasPoolNode"], "Twist to Carousel route must NOT pass through pool node c_4_m_700"

        # -------------------------------------------------------------
        # TEST 3: LIVE TURN-BY-TURN HUD BANNER IN FLOOR HEADER CARD
        # -------------------------------------------------------------
        print("\n--- 3. TESTING LIVE TURN-BY-TURN HUD BANNER ---")
        # Plan route from Zen to LC Waikiki or Zara
        page.evaluate("""() => {
            const allStores = getAllStores();
            const zen = allStores.find(s => s.name === 'Zen');
            const target = allStores.find(s => s.name.includes('Waikiki') || s.name.includes('Zara')) || allStores[10];
            setStartLocation(zen);
            setTargetLocation(target);
        }""")
        page.wait_for_timeout(400)

        live_banner = page.locator("#header-live-nav-banner")
        assert live_banner.is_visible(), "Live turn-by-turn banner must be visible when route is active"

        icon_text = page.locator("#live-nav-icon").inner_text().strip()
        nav_text = page.locator("#live-nav-text").inner_text().strip()
        sub_text = page.locator("#live-nav-sub").inner_text().strip()
        print(f"Initial HUD: Icon='{icon_text}', Text='{nav_text}', Sub='{sub_text}'")
        assert len(icon_text) > 0, "Live nav icon should not be empty"
        assert len(nav_text) > 0, "Live nav text should not be empty"

        scr_hud = "screenshot_live_nav_banner_active.png"
        page.screenshot(path=scr_hud)
        if os.path.exists(scr_hud):
            shutil.copy(scr_hud, os.path.join(ARTIFACT_DIR, scr_hud))
            print(f"Captured live HUD screenshot: {scr_hud}")

        # Test dynamic updates during simulation
        page.evaluate("""() => {
            // Simulate progression to a turn step
            updateLiveNavHUD(2, 35);
        }""")
        page.wait_for_timeout(200)
        nav_text_mid = page.locator("#live-nav-text").inner_text().strip()
        icon_text_mid = page.locator("#live-nav-icon").inner_text().strip()
        print(f"Mid-Route HUD: Icon='{icon_text_mid}', Text='{nav_text_mid}'")
        assert len(nav_text_mid) > 0

        # -------------------------------------------------------------
        # TEST 4: ROUTE LINE PRESERVED ON DESTINATION ARRIVAL (OPACITY 0.6)
        # -------------------------------------------------------------
        print("\n--- 4. TESTING ROUTE TRACE PRESERVATION ON ARRIVAL ---")
        # Trigger arrival
        page.evaluate("""() => {
            cartSimulator.finish();
        }""")
        page.wait_for_timeout(600)

        # Check route group still exists in SVG
        route_group_exists = page.evaluate("""() => {
            const rg = document.querySelector('#route-svg .route-group');
            const opacity = rg ? window.getComputedStyle(rg).opacity : null;
            return { exists: !!rg, opacity: opacity };
        }""")
        print(f"On arrival: route-group exists? {route_group_exists['exists']}, opacity: {route_group_exists['opacity']}")
        assert route_group_exists["exists"], "Route line should NOT be removed from DOM upon destination arrival"
        assert float(route_group_exists["opacity"]) <= 0.7, f"Route line opacity should be dimmed (~0.6), got {route_group_exists['opacity']}"

        # Check destination reached HUD state
        arr_icon = page.locator("#live-nav-icon").inner_text().strip()
        arr_text = page.locator("#live-nav-text").inner_text().strip()
        print(f"Arrival HUD: Icon='{arr_icon}', Text='{arr_text}'")
        assert arr_icon == "🎉" or "Hedefe" in arr_text, "HUD should show destination reached status"

        scr_arrival = "screenshot_route_preserved_on_arrival.png"
        page.screenshot(path=scr_arrival)
        if os.path.exists(scr_arrival):
            shutil.copy(scr_arrival, os.path.join(ARTIFACT_DIR, scr_arrival))
            print(f"Captured arrival screenshot: {scr_arrival}")

        # Test clearCurrentRoute actually clears the route
        page.evaluate("clearCurrentRoute()")
        page.wait_for_timeout(300)
        route_cleared = page.evaluate("() => document.querySelectorAll('#route-svg .route-group').length === 0")
        assert route_cleared, "Route line should be cleared when clearCurrentRoute() is called"
        banner_hidden = page.evaluate("() => document.getElementById('header-live-nav-banner').classList.contains('hidden')")
        assert banner_hidden, "Live nav banner should be hidden when route is cleared"

        context_main.close()
        browser.close()

    print("\n--- 5. CHECKING CONSOLE ERRORS ---")
    print(f"Total console errors encountered: {len(console_errors)}")
    for err in console_errors:
        print(f"  ERROR: {err}")
    assert len(console_errors) == 0, f"Expected 0 console errors, but found {len(console_errors)}"
    print("ALL TESTS PASSED WITH 0 CONSOLE ERRORS!")

if __name__ == '__main__':
    test_pool_bypass_and_live_hud()
