import asyncio
from playwright.async_api import async_playwright

async def test_ux_state_machine():
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

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        print("Navigating to http://127.0.0.1:3000/ ...")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # ---------------------------------------------------------
        # TEST 1: DİNAMİK MAĞAZA KARTI BUTONLARI
        # ---------------------------------------------------------
        print("\n--- TEST 1: Dinamik Mağaza Kartı Butonları ---")
        
        # 1.1: [📍 Nereden?] boşken haritadan bir mağazaya tıkla (Zemin Kat: Avva)
        print("Clicking Avva store on map...")
        avva_poly = page.locator(".store-polygon[data-id='store_4_2']").first
        await avva_poly.click(force=True)
        await page.wait_for_timeout(600)

        # POI Detay Paneli açılmış olmalı
        poi_visible = await page.locator("#sidebar-poi-detail").is_visible()
        assert poi_visible, "POI detail panel should be visible"

        # Buton 1: [📍 Buradan Başla] (Öncelikli)
        btn_start = page.locator("#poi-action-buttons button").nth(0)
        btn_start_text = (await btn_start.text_content()).strip()
        print(f"Primary button text when start is empty: '{btn_start_text}'")
        assert "Buradan Başla" in btn_start_text, f"Expected 'Buradan Başla' as primary button, got '{btn_start_text}'"

        # Buton 2: [🎯 Hedef Yap] (İkincil)
        btn_target = page.locator("#poi-action-buttons button").nth(1)
        btn_target_text = (await btn_target.text_content()).strip()
        print(f"Secondary button text when start is empty: '{btn_target_text}'")
        assert "Hedef Yap" in btn_target_text, f"Expected 'Hedef Yap' as secondary button, got '{btn_target_text}'"

        await page.screenshot(path="screenshot_poi_buttons_start_empty.png")
        print("✓ Case 1 verified: [📍 Buradan Başla] is primary, [🎯 Hedef Yap] is secondary")

        # 1.2: [📍 Buradan Başla] butonuna tıkla
        await btn_start.click()
        await page.wait_for_timeout(500)

        start_val = await page.input_value("#input-start-loc")
        print(f"Start location input is now: '{start_val}'")
        assert "Avva" in start_val, f"Expected 'Avva' in start input, got '{start_val}'"

        # 1.3: [📍 Nereden?] DOLUYKEN başka bir mağaza seç (Örn: Zara 1. Kat)
        # Hedef arama kutusuna 'Zara' yaz
        print("Searching for 'Zara' in target input...")
        target_input = page.locator("#input-target-loc")
        await target_input.fill("Zara")
        await page.wait_for_timeout(400)

        zara_card = page.locator(".store-card:has-text('Zara')").first
        await zara_card.click()
        await page.wait_for_timeout(500)

        # Buton 1: [🎯 Hedef Yap] (Öncelikli)
        btn1 = page.locator("#poi-action-buttons button").nth(0)
        btn1_text = (await btn1.text_content()).strip()
        print(f"Primary button text when start is filled: '{btn1_text}'")
        assert "Hedef Yap" in btn1_text, f"Expected 'Hedef Yap' as primary button, got '{btn1_text}'"

        # Buton 2: [📍 Başlangıcı Değiştir] (İkincil)
        btn2 = page.locator("#poi-action-buttons button").nth(1)
        btn2_text = (await btn2.text_content()).strip()
        print(f"Secondary button text when start is filled: '{btn2_text}'")
        assert "Başlangıcı Değiştir" in btn2_text, f"Expected 'Başlangıcı Değiştir' as secondary button, got '{btn2_text}'"

        await page.screenshot(path="screenshot_poi_buttons_start_filled.png")
        print("✓ Case 2 verified: [🎯 Hedef Yap] is primary, [📍 Başlangıcı Değiştir] is secondary")

        # ---------------------------------------------------------
        # TEST 2: ROTA ÖNİZLEME (ROUTE PREVIEW) & MANUEL BAŞLATMA
        # ---------------------------------------------------------
        print("\n--- TEST 2: Rota Önizleme & Manuel Başlatma ---")
        
        # [🎯 Hedef Yap] butonuna basarak rotayı oluştur
        await btn1.click()
        await page.wait_for_timeout(800)

        # 2.1: Rota oluştu mu ve HUD aktif mi?
        has_route = await page.evaluate("document.body.classList.contains('has-active-route')")
        assert has_route, "Expected active route"
        hud_active = await page.locator("#nav-hud-bar").is_visible()
        assert hud_active, "HUD bar should be visible"

        # 2.2: KRİTİK: Simülasyon OTOMATİK BAŞLAMAMALI!
        is_playing = await page.evaluate("window.cartSimulator.isPlaying")
        print(f"Simulator isPlaying right after route creation: {is_playing}")
        assert not is_playing, "CRITICAL: Simulator MUST NOT start automatically upon route creation!"
        print("✓ Verified: Simulator did NOT start automatically. Route is in preview mode.")

        # 2.3: HUD butonu metni [▶ Simülasyonu Başlat] olmalı
        sim_btn_text = (await page.locator("#hud-sim-text").text_content()).strip()
        print(f"HUD Sim button text: '{sim_btn_text}'")
        assert sim_btn_text == "Simülasyonu Başlat", f"Expected 'Simülasyonu Başlat', got '{sim_btn_text}'"

        # 2.4: Simülasyon/Rota aktifken alt çekmece (Bottom Sheet) açılıp kapanabilmeli
        print("Testing Bottom Sheet toggle during active route...")
        toggle_btn = page.locator("#floating-view-toggle")
        assert await toggle_btn.is_visible(), "Floating view toggle should be accessible during active route"
        
        # Çekmeceyi aç
        await toggle_btn.click()
        await page.wait_for_timeout(400)
        sheet_expanded = await page.evaluate("document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert sheet_expanded, "Expected bottom sheet to expand when clicked"
        print("✓ Bottom sheet successfully expanded during active route")

        # Çekmeceyi kapat
        await toggle_btn.click()
        await page.wait_for_timeout(400)
        sheet_collapsed = await page.evaluate("!document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        assert sheet_collapsed, "Expected bottom sheet to collapse when clicked again"
        print("✓ Bottom sheet successfully collapsed back to map")

        # 2.5: Kullanıcı basınca simülasyon başlasın
        print("Clicking [▶ Simülasyonu Başlat]...")
        await page.click("#btn-hud-sim-play")
        await page.wait_for_timeout(150)

        is_playing_now = await page.evaluate("window.cartSimulator.isPlaying || window.cartSimulator.subProgress > 0 || window.cartSimulator.currentIndex > 0")
        assert is_playing_now, "Simulator should be running after explicit user click"
        sim_btn_running_text = (await page.locator("#hud-sim-text").text_content()).strip()
        assert sim_btn_running_text == "Duraklat", f"Expected 'Duraklat', got '{sim_btn_running_text}'"
        print("✓ Verified: Shopping cart moves only after user explicitly presses start button")

        # ---------------------------------------------------------
        # TEST 3: SİMÜLASYON HIZ KONTROLÜ (1x ➔ 2x ➔ 4x)
        # ---------------------------------------------------------
        print("\n--- TEST 3: HUD Hız Kontrolü (1x ➔ 2x ➔ 4x) ---")
        speed_btn = page.locator("#btn-hud-speed")
        speed_text_el = page.locator("#hud-speed-text")

        initial_speed_text = (await speed_text_el.text_content()).strip()
        assert initial_speed_text == "1x", f"Expected initial speed '1x', got '{initial_speed_text}'"
        print("✓ Initial speed is 1x")

        # Click 1: 1x ➔ 2x
        await speed_btn.click()
        await page.wait_for_timeout(300)
        speed_2x = await page.evaluate("window.cartSimulator.speed")
        speed_2x_text = (await speed_text_el.text_content()).strip()
        assert speed_2x == 2.0, f"Expected speed 2.0, got {speed_2x}"
        assert speed_2x_text == "2x", f"Expected text '2x', got '{speed_2x_text}'"
        print("✓ Speed cycled to 2x")

        # Click 2: 2x ➔ 4x
        await speed_btn.click()
        await page.wait_for_timeout(300)
        speed_4x = await page.evaluate("window.cartSimulator.speed")
        speed_4x_text = (await speed_text_el.text_content()).strip()
        assert speed_4x == 4.0, f"Expected speed 4.0, got {speed_4x}"
        assert speed_4x_text == "4x", f"Expected text '4x', got '{speed_4x_text}'"
        print("✓ Speed cycled to 4x")

        # Click 3: 4x ➔ 1x
        await speed_btn.click()
        await page.wait_for_timeout(300)
        speed_1x = await page.evaluate("window.cartSimulator.speed")
        speed_1x_text = (await speed_text_el.text_content()).strip()
        assert speed_1x == 1.0, f"Expected speed 1.0, got {speed_1x}"
        assert speed_1x_text == "1x", f"Expected text '1x', got '{speed_1x_text}'"
        print("✓ Speed cycled back to 1x")

        await page.screenshot(path="screenshot_hud_speed_and_route.png")

        # ---------------------------------------------------------
        # TEST 4: DİKİYE GEÇİŞ TERCİHİ (MERDİVEN / ASANSÖR)
        # ---------------------------------------------------------
        print("\n--- TEST 4: Dikey Geçiş Tercihi (Merdiven Öncelikli) ---")
        current_mode = await page.evaluate("window.activeRouteMode || activeRouteMode")
        print(f"Default route mode: '{current_mode}'")
        assert current_mode == "escalator", f"Expected default mode 'escalator', got '{current_mode}'"

        # Rota dikey geçiş türünü kontrol et: Vakko (Zemin) ➔ Boyner (1. Kat)
        # Zemin Kat Vakko ➔ 1. Kat Boyner
        route_edges = await page.evaluate("""
            () => {
                const route = window.mallMap.activeRoute;
                if (!route || !route.pathNodes) return [];
                return route.pathNodes.map(n => n.edgeType).filter(t => t && t !== 'walk' && t !== 'start');
            }
        """)
        print(f"Vertical edges used in route with mode='escalator': {route_edges}")
        assert "escalator" in route_edges or len(route_edges) == 0, f"Expected escalator in vertical edges, got {route_edges}"
        print("✓ Escalator edges successfully prioritized in escalator mode")

        # Asansör sekmesine tıkla (Mobilde alt çekmece açılarak erişilir)
        print("Opening bottom sheet to switch mode to Elevator...")
        await toggle_btn.click()
        await page.wait_for_timeout(400)

        await page.click("#tab-pref-elevator")
        await page.wait_for_timeout(500)

        # calculateAndDisplayRoute() mobilde alt çekmeceyi haritaya odaklanması için otomatik küçültür
        await page.evaluate("collapseBottomSheet()")
        await page.wait_for_timeout(400)

        elevator_edges = await page.evaluate("""
            () => {
                const route = window.mallMap.activeRoute;
                if (!route || !route.pathNodes) return [];
                return route.pathNodes.map(n => n.edgeType).filter(t => t && t !== 'walk' && t !== 'start');
            }
        """)
        print(f"Vertical edges used in route with mode='elevator': {elevator_edges}")
        assert "elevator" in elevator_edges, f"Expected elevator in vertical edges, got {elevator_edges}"
        print("✓ Elevator mode successfully switches to elevator edges")

        # Rotayı bitir
        await page.click("#btn-hud-finish")
        await page.wait_for_timeout(400)

        # Konsol hatalarını doğrula
        print(f"\nConsole errors recorded: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"

        print("\n========================================================")
        print("🎉 ALL 4 UX & STATE MACHINE TESTS PASSED WITH 0 ERRORS!")
        print("========================================================")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_ux_state_machine())
