import asyncio
import os
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run_tests():
    console_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Mobile viewport (iPhone 14 Pro: 390x844)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            is_mobile=True,
            has_touch=True
        )
        page = await context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        # =====================================================================
        # TEST 1: AÇILIŞ EKRANI (SPLASH SCREEN - PULSE) & 0ms DOĞAL FADE-OUT
        # =====================================================================
        print("\n--- TEST 1: Açılış Ekranı (Splash Screen) ---")
        print("Navigating to http://127.0.0.1:3000/ ...")
        await page.goto("http://127.0.0.1:3000/", wait_until="commit")

        # Check splash screen is initially present in DOM
        splash = page.locator("#splash-screen")
        splash_count = await splash.count()
        print(f"Splash screen present on start: {splash_count > 0}")

        # Wait for map load and ensure splash screen fades out
        await page.wait_for_selector("#map-canvas-container svg", timeout=10000)
        await page.wait_for_timeout(700) # Allow fade-out transition

        # Verify splash screen is dismissed (either removed from DOM or has pointer-events-none / opacity-0)
        splash_visible = False
        if await splash.count() > 0:
            splash_classes = await splash.get_attribute("class") or ""
            is_hidden = "opacity-0" in splash_classes and "pointer-events-none" in splash_classes
            print(f"Splash screen classes: {splash_classes}")
            assert is_hidden or not await splash.is_visible(), "Expected splash screen to be faded out"
        print("PASS: Splash screen naturally faded out without artificial delay.")

        # =====================================================================
        # TEST 2: GRAPH ONARIMI & ROTA FİLTRELEME ([🛣️ Geniş Yol] vs [✂️ Kısa Yol])
        # =====================================================================
        print("\n--- TEST 2: Graph Onarımı & Rota Koridor Filtreleme ---")

        # Set Start = Fişekhane (east of pool, node c_4_m_600)
        # Set Target = Avva or Vakko (west of pool, node c_4_m_800 side)
        # Using evaluate to simulate store/entrance selection via clean API
        route_setup = await page.evaluate("""() => {
            const allStores = getAllMallStores();
            const fisekhaneEnt = mallData.entrances.find(e => e.id === 'ent_fisekhane');
            const avvaStore = allStores.find(s => s.name === 'Avva' && s.floor === 4);
            
            if (!fisekhaneEnt || !avvaStore) {
                return { success: false, reason: 'Entities not found' };
            }

            setStartLocation(fisekhaneEnt);
            setTargetLocation(avvaStore);

            return {
                success: true,
                start: fisekhaneEnt.name,
                target: avvaStore.name,
                hasActiveRoute: !!mallMap.activeRoute,
                pathFilter: navEngine.findRoute(fisekhaneEnt.nav_node, avvaStore.nav_node, 'escalator', 'wide')
            };
        }""")
        print(f"Route setup result: {route_setup}")
        assert route_setup["success"], f"Failed to set start/target: {route_setup}"

        await page.wait_for_timeout(600)

        # 2.1: Verify #route-path-chips is visible and wide path is selected by default
        chips_container = page.locator("#route-path-chips")
        assert await chips_container.is_visible(), "Expected #route-path-chips to be visible"

        chip_wide = page.locator("#chip-path-wide")
        chip_short = page.locator("#chip-path-short")
        assert await chip_wide.is_visible(), "Expected #chip-path-wide to be visible"
        assert await chip_short.is_visible(), "Expected #chip-path-short to be visible"

        wide_classes = await chip_wide.get_attribute("class") or ""
        assert "bg-indigo-600" in wide_classes, "Expected #chip-path-wide to be active by default"

        # Check Dijkstra path in Wide Mode (excludes 'narrow' edges, uses southern corridor)
        route_data_wide = await page.evaluate("""() => {
            const r = lastCalculatedRoute;
            return {
                totalDistance: r.totalDistance,
                pathNodes: r.pathNodes.map(n => n.id)
            };
        }""")
        print(f"Wide Route Distance: {route_data_wide['totalDistance']}m, Nodes: {route_data_wide['pathNodes']}")
        # Must not contain northern narrow waypoints
        assert "c_4_wp_pool_n1" not in route_data_wide["pathNodes"], "Wide path should NOT use c_4_wp_pool_n1"
        assert "c_4_wp_pool_n2" not in route_data_wide["pathNodes"], "Wide path should NOT use c_4_wp_pool_n2"
        # Must bypass through southern wide waypoints
        has_south = any(n in route_data_wide["pathNodes"] for n in ["c_4_wp_pool_s1", "c_4_wp_pool_s2", "c_4_wp_pool_s3"])
        assert has_south, "Wide path must route via southern pool waypoints"
        print("PASS: Geniş Yol correctly excludes narrow corridor and routes via southern wide path.")

        # Capture screenshot of Geniş Yol
        wide_screenshot_path = os.path.join(ARTIFACTS_DIR, "screenshot_wide_path_route.png")
        await page.screenshot(path=wide_screenshot_path)
        print(f"Saved Geniş Yol screenshot: {wide_screenshot_path}")

        # 2.2: Click [✂️ Kısa Yol]
        print("Clicking [✂️ Kısa Yol] chip...")
        await chip_short.click()
        await page.wait_for_timeout(600)

        short_classes = await chip_short.get_attribute("class") or ""
        assert "bg-indigo-600" in short_classes, "Expected #chip-path-short to be active"

        route_data_short = await page.evaluate("""() => {
            const r = lastCalculatedRoute;
            return {
                totalDistance: r.totalDistance,
                pathNodes: r.pathNodes.map(n => n.id)
            };
        }""")
        print(f"Short Route Distance: {route_data_short['totalDistance']}m, Nodes: {route_data_short['pathNodes']}")
        # Must use northern narrow corridor
        has_north = any(n in route_data_short["pathNodes"] for n in ["c_4_wp_pool_n1", "c_4_wp_pool_n2", "c_4_wp_pool_n3"])
        assert has_north, "Short path must route via northern corridor"
        print("PASS: Kısa Yol correctly routes via northern corridor.")

        # Capture screenshot of Kısa Yol
        short_screenshot_path = os.path.join(ARTIFACTS_DIR, "screenshot_short_path_route.png")
        await page.screenshot(path=short_screenshot_path)
        print(f"Saved Kısa Yol screenshot: {short_screenshot_path}")

        # 2.3: Switch back to [🛣️ Geniş Yol]
        await chip_wide.click()
        await page.wait_for_timeout(400)
        route_back = await page.evaluate("lastCalculatedRoute.pathNodes.map(n => n.id)")
        assert any(n in route_back for n in ["c_4_wp_pool_s1", "c_4_wp_pool_s2", "c_4_wp_pool_s3"]), "Switched back to wide path"

        # 2.4: Clear route and verify chips hide
        await page.click("#btn-hud-finish")
        await page.wait_for_timeout(400)
        chips_visible_after = await chips_container.is_visible()
        print(f"Chips visible after route cleared: {chips_visible_after}")
        assert not chips_visible_after, "Expected chips to be hidden after clearCurrentRoute()"
        print("PASS: Chips correctly toggle visibility with route state.")

        # =====================================================================
        # TEST 3: ERİŞİLEBİLİRLİK (A11y) DOKUNMA ALANLARI (>= 44x44px)
        # =====================================================================
        print("\n--- TEST 3: Dokunma Alanları (Touch Targets >= 44x44px) ---")

        # Select a store so peek card is visible for testing peek card buttons
        await page.evaluate("""() => {
            const store = getAllMallStores().find(s => s.name === 'Beymen Club' && s.floor === 4);
            if (store) selectStore(store);
        }""")
        await page.wait_for_timeout(400)

        # Select route again so HUD and route chips can be tested
        await page.evaluate("""() => {
            const all = getAllMallStores();
            const s = all.find(x => x.name === 'Avva' && x.floor === 4);
            const ent = mallData.entrances.find(e => e.id === 'ent_fisekhane');
            setStartLocation(ent);
            setTargetLocation(s);
        }""")
        await page.wait_for_timeout(400)

        # 3.1: Map and HUD touch targets
        hud_and_map_targets = [
            ("#btn-compass", "Compass Button"),
            ("#zoom-in-btn", "Zoom In"),
            ("#zoom-out-btn", "Zoom Out"),
            ("#zoom-reset-btn", "Zoom Reset"),
            ("#btn-swap-locations", "Swap Button"),
            ("#btn-hud-swap", "HUD Swap"),
            ("#btn-hud-speed", "HUD Speed"),
            ("#btn-hud-steps-toggle", "HUD Steps Toggle"),
            ("#btn-hud-sim-play", "HUD Play/Pause"),
            ("#btn-hud-finish", "HUD Finish Route"),
            ("#chip-path-wide", "Wide Path Chip"),
            ("#chip-path-short", "Short Path Chip"),
            (".floor-pill[data-floor='4']", "Floor Pill Zemin"),
            (".floor-pill[data-floor='5']", "Floor Pill 1. Kat"),
            (".floor-pill[data-floor='6']", "Floor Pill 2. Kat"),
        ]

        for sel, label in hud_and_map_targets:
            el = page.locator(sel).first
            assert await el.count() > 0, f"Element {sel} ({label}) not found"
            box = await el.bounding_box()
            assert box is not None, f"Bounding box for {sel} is None"
            w, h = round(box["width"], 1), round(box["height"], 1)
            print(f"Target '{label}' ({sel}): {w}x{h}px")
            assert w >= 43.5, f"Width of {label} ({sel}) is {w}px < 44px standard"
            assert h >= 43.5, f"Height of {label} ({sel}) is {h}px < 44px standard"

        # 3.2: Expand bottom sheet to test #theme-toggle-btn and #btn-sheet-toggle
        print("Expanding bottom sheet to measure header controls...")
        await page.evaluate("expandBottomSheet()")
        await page.wait_for_timeout(400)

        sheet_targets = [
            ("#theme-toggle-btn", "Theme Toggle"),
            ("#btn-sheet-toggle", "Sheet Toggle")
        ]
        for sel, label in sheet_targets:
            el = page.locator(sel).first
            assert await el.count() > 0, f"Element {sel} ({label}) not found"
            box = await el.bounding_box()
            assert box is not None, f"Bounding box for {sel} is None"
            w, h = round(box["width"], 1), round(box["height"], 1)
            print(f"Target '{label}' ({sel}): {w}x{h}px")
            assert w >= 43.5, f"Width of {label} ({sel}) is {w}px < 44px standard"
            assert h >= 43.5, f"Height of {label} ({sel}) is {h}px < 44px standard"

        await page.evaluate("collapseBottomSheet()")
        await page.wait_for_timeout(300)

        # 3.3: Test Peek Card Buttons
        await page.evaluate("""() => {
            const store = getAllMallStores().find(s => s.name === 'Beymen Club' && s.floor === 4);
            if (store) showPoiPeekCard(store);
        }""")
        await page.wait_for_timeout(400)

        peek_targets = [
            ("#btn-peek-close", "Peek Close"),
            ("#btn-peek-start", "Peek Start"),
            ("#btn-peek-target", "Peek Target"),
        ]
        for sel, label in peek_targets:
            el = page.locator(sel).first
            assert await el.count() > 0, f"Element {sel} ({label}) not found"
            box = await el.bounding_box()
            assert box is not None, f"Bounding box for {sel} is None"
            w, h = round(box["width"], 1), round(box["height"], 1)
            print(f"Target '{label}' ({sel}): {w}x{h}px")
            assert w >= 43.5, f"Width of {label} ({sel}) is {w}px < 44px standard"
            assert h >= 43.5, f"Height of {label} ({sel}) is {h}px < 44px standard"

        await page.evaluate("closePoiPeekCard()")
        await page.wait_for_timeout(300)

        print("PASS: All key interactive buttons meet the >= 44x44px touch target standard.")

        # =====================================================================
        # TEST 4: TİPOGRAFİ VE YÜRÜRKEN OKUNABİLİRLİK (14px - 16px BANDI)
        # =====================================================================
        print("\n--- TEST 4: Tipografi (14px - 16px Bandı) ---")

        # 4.1 Header Title & Sub
        title_font = await page.evaluate("window.getComputedStyle(document.getElementById('current-floor-title')).fontSize")
        sub_font = await page.evaluate("window.getComputedStyle(document.getElementById('current-floor-sub')).fontSize")
        print(f"#current-floor-title font-size: {title_font}")
        print(f"#current-floor-sub font-size: {sub_font}")
        assert float(title_font.replace("px", "")) >= 16.0, f"Expected title font >= 16px, got {title_font}"
        assert float(sub_font.replace("px", "")) >= 14.0, f"Expected sub font >= 14px, got {sub_font}"

        # 4.2 Marker name label
        marker_label_font = await page.evaluate("""() => {
            const el = document.querySelector('.marker-name-label');
            return el ? window.getComputedStyle(el).fontSize : 'none';
        }""")
        print(f".marker-name-label font-size: {marker_label_font}")
        if marker_label_font != 'none':
            assert float(marker_label_font.replace("px", "")) >= 14.0, f"Expected marker label font >= 14px, got {marker_label_font}"

        # 4.3 Peek card fonts
        await page.click("#btn-hud-finish")
        await page.wait_for_timeout(300)
        await page.evaluate("""() => {
            const store = getAllMallStores().find(s => s.name === 'Beymen Club' && s.floor === 4);
            if (store) selectStore(store);
        }""")
        await page.wait_for_timeout(300)

        peek_title_font = await page.evaluate("window.getComputedStyle(document.getElementById('peek-store-name')).fontSize")
        peek_sub_font = await page.evaluate("window.getComputedStyle(document.getElementById('peek-landmark-text')).fontSize")
        print(f"#peek-store-name font-size: {peek_title_font}")
        print(f"#peek-landmark-text font-size: {peek_sub_font}")
        assert float(peek_title_font.replace("px", "")) >= 16.0, f"Expected peek title >= 16px, got {peek_title_font}"
        assert float(peek_sub_font.replace("px", "")) >= 14.0, f"Expected peek landmark >= 14px, got {peek_sub_font}"
        print("PASS: Typography conforms to walking legibility 14px-16px band.")

        # =====================================================================
        # TEST 5: SIFIR KONSOL HATASI (ZERO CONSOLE ERRORS)
        # =====================================================================
        print("\n--- TEST 5: Sıfır Konsol Hatası Denetimi ---")
        print(f"Console errors: {console_errors}")
        assert len(console_errors) == 0, f"Console errors detected: {console_errors}"
        print("PASS: 0 console errors detected throughout all interactions.")

        print("\n==========================================")
        print("🎉 ALL 5 E2E TESTS PASSED SUCCESSFULLY!")
        print("==========================================")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
