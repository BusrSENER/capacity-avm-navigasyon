import asyncio
from playwright.async_api import async_playwright

async def test_swap_and_focus():
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

        # =====================================================================
        # 1. GÖRSEL ODAK (ACTIVE FOCUS RING) TESTİ
        # =====================================================================
        print("\n--- TEST 1: Görsel Odak (Active Focus Ring) ---")
        start_input = page.locator("#input-start-loc")
        target_input = page.locator("#input-target-loc")

        # 1.1: [📍 Nereden?] tıklandığında focus ring aktifleşmeli
        print("Clicking [📍 Nereden?]...")
        await start_input.click()
        await page.wait_for_timeout(300)

        start_has_ring = await page.evaluate("document.getElementById('input-start-loc').classList.contains('active-focus-ring')")
        target_has_ring = await page.evaluate("document.getElementById('input-target-loc').classList.contains('active-focus-ring')")
        active_slot = await page.evaluate("window.activeFocusSlot")

        print(f"Start has ring: {start_has_ring}, Target has ring: {target_has_ring}, Active slot: '{active_slot}'")
        assert start_has_ring, "Expected #input-start-loc to have .active-focus-ring"
        assert not target_has_ring, "Expected #input-target-loc NOT to have .active-focus-ring"
        assert active_slot == "start", f"Expected activeFocusSlot 'start', got '{active_slot}'"

        # Modalı kapatıp ekran görüntüsü al
        await page.click("#entrance-modal-close")
        await page.wait_for_timeout(300)
        await page.screenshot(path="screenshot_focus_ring_start.png")
        print("✓ Verified: [📍 Nereden?] has glowing indigo focus ring")

        # 1.2: [🎯 Nereye?] tıklandığında focus ring hedef kutuya geçmeli
        print("Clicking [🎯 Nereye?]...")
        await target_input.click()
        await page.wait_for_timeout(300)

        start_has_ring = await page.evaluate("document.getElementById('input-start-loc').classList.contains('active-focus-ring')")
        target_has_ring = await page.evaluate("document.getElementById('input-target-loc').classList.contains('active-focus-ring')")
        active_slot = await page.evaluate("window.activeFocusSlot")

        print(f"Start has ring: {start_has_ring}, Target has ring: {target_has_ring}, Active slot: '{active_slot}'")
        assert not start_has_ring, "Expected #input-start-loc NOT to have .active-focus-ring"
        assert target_has_ring, "Expected #input-target-loc to have .active-focus-ring"
        assert active_slot == "target", f"Expected activeFocusSlot 'target', got '{active_slot}'"

        await page.screenshot(path="screenshot_focus_ring_target.png")
        print("✓ Verified: Active focus ring seamlessly shifted to [🎯 Nereye?]")

        # =====================================================================
        # 2. TEK KUTU DOLUYKEN [⇅] TAKAS TESTİ
        # =====================================================================
        print("\n--- TEST 2: Tek Kutu Doluyken [⇅] Takas ve Odak Aktarımı ---")

        # 2.1: Haritadan Avva'yı başlangıç yap ([📍 Nereden?] = Avva, [🎯 Nereye?] = Boş)
        print("Selecting Avva on map as Start location...")
        await page.evaluate("collapseBottomSheet()")
        await page.wait_for_timeout(300)
        await page.locator(".store-polygon[data-id='store_4_2']").first.click(force=True)
        await page.wait_for_timeout(500)
        # Peek card açıldı, [📍 Buradan Başla] butonuna bas
        peek_start = page.locator("#btn-peek-start")
        if await peek_start.is_visible():
            await peek_start.click()
        else:
            await page.locator("#poi-start-btn").click()
        await page.wait_for_timeout(400)

        start_val = await start_input.input_value()
        target_val = await target_input.input_value()
        print(f"Before single swap -> Start: '{start_val}', Target: '{target_val}'")
        assert "Avva" in start_val, f"Expected 'Avva' in start, got '{start_val}'"
        assert target_val == "", f"Expected target to be empty, got '{target_val}'"

        # 2.2: [⇅] Swap butonuna bas (Yalnızca Başlangıç Doluyken)
        print("Clicking Swap [⇅] with only Start filled...")
        await page.click("#btn-swap-locations")
        await page.wait_for_timeout(400)

        new_start_val = await start_input.input_value()
        new_target_val = await target_input.input_value()
        new_active_slot = await page.evaluate("window.activeFocusSlot")
        start_has_ring = await page.evaluate("document.getElementById('input-start-loc').classList.contains('active-focus-ring')")

        print(f"After single swap -> Start: '{new_start_val}', Target: '{new_target_val}', Focus slot: '{new_active_slot}'")
        assert new_start_val == "", f"Expected start to be cleared, got '{new_start_val}'"
        assert "Avva" in new_target_val, f"Expected target to receive 'Avva', got '{new_target_val}'"
        assert new_active_slot == "start", f"Expected focus slot to shift to emptied 'start', got '{new_active_slot}'"
        assert start_has_ring, "Expected empty start input to receive glowing active focus ring"

        await page.screenshot(path="screenshot_swap_single_start_to_target.png")
        print("✓ Verified: Value transferred from Start to Target, and focus shifted to emptied Start box")

        # 2.3: Şimdi [⇅] Swap butonuna tekrar bas (Yalnızca Hedef Doluyken)
        print("Clicking Swap [⇅] again with only Target filled...")
        await page.click("#btn-swap-locations")
        await page.wait_for_timeout(400)

        rev_start_val = await start_input.input_value()
        rev_target_val = await target_input.input_value()
        rev_active_slot = await page.evaluate("window.activeFocusSlot")
        target_has_ring = await page.evaluate("document.getElementById('input-target-loc').classList.contains('active-focus-ring')")

        print(f"After second swap -> Start: '{rev_start_val}', Target: '{rev_target_val}', Focus slot: '{rev_active_slot}'")
        assert "Avva" in rev_start_val, f"Expected start to receive 'Avva', got '{rev_start_val}'"
        assert rev_target_val == "", f"Expected target to be cleared, got '{rev_target_val}'"
        assert rev_active_slot == "target", f"Expected focus slot to shift to emptied 'target', got '{rev_active_slot}'"
        assert target_has_ring, "Expected empty target input to receive glowing active focus ring"

        await page.screenshot(path="screenshot_swap_single_target_to_start.png")
        print("✓ Verified: Value transferred from Target to Start, and focus shifted to emptied Target box")

        # =====================================================================
        # 3. İKİ NOKTA DOLUYKEN VE SİMÜLASYON AKARKEN [⇅] TAKAS TESTİ
        # =====================================================================
        print("\n--- TEST 3: İki Nokta Dolu & Simülasyon Akarken [⇅] Takas ---")

        # 3.1: Hedef olarak Zara'yı seç (Start = Avva Zemin Kat, Target = Zara 1. Kat)
        print("Setting target to Zara...")
        await target_input.fill("Zara")
        await page.wait_for_timeout(400)
        auto_item = page.locator("#search-autocomplete-list .search-autocomplete-item:has-text('Zara')")
        if await auto_item.count() > 0 and await auto_item.first.is_visible():
            await auto_item.first.click()
            await page.wait_for_timeout(400)
            peek_target = page.locator("#btn-peek-target")
            if await peek_target.is_visible():
                await peek_target.click()
        else:
            await page.locator(".store-card:has-text('Zara')").first.click()
            await page.wait_for_timeout(400)
            await page.locator("#poi-action-buttons button").nth(0).click()
        await page.wait_for_timeout(800)

        # Rota oluştu mu?
        has_route = await page.evaluate("document.body.classList.contains('has-active-route')")
        assert has_route, "Active route expected"
        is_playing = await page.evaluate("window.cartSimulator.isPlaying")
        assert not is_playing, "Simulation must not start automatically (preview mode)"
        print("✓ Route created in preview mode: Avva (Floor 4) -> Zara (Floor 5)")

        # 3.2: Simülasyonu başlat
        print("Starting cart simulation...")
        await page.click("#btn-hud-sim-play")
        await page.wait_for_timeout(150)

        is_running = await page.evaluate("window.cartSimulator.isPlaying || window.cartSimulator.subProgress > 0 || window.cartSimulator.currentIndex > 0")
        assert is_running, "Simulator should be running after pressing play"
        sim_text = (await page.locator("#hud-sim-text").text_content()).strip()
        assert sim_text == "Duraklat", f"Expected 'Duraklat', got '{sim_text}'"
        print("✓ Simulation is running actively along the route")

        # 3.3: SİMÜLASYON AKARKEN [⇅] SWAP BUTONUNA BAS!
        print("\n*** PRESSING SWAP [⇅] ON HUD WHILE SIMULATION IS RUNNING ***")
        await page.click("#btn-hud-swap")
        await page.wait_for_timeout(500)

        # 3.4: Kritik Doğrulamalar:
        # A) Simülasyon derhal durduruldu mu?
        is_playing_after_swap = await page.evaluate("window.cartSimulator.isPlaying")
        print(f"Simulator isPlaying immediately after swap: {is_playing_after_swap}")
        assert not is_playing_after_swap, "CRITICAL: Simulator MUST be stopped (cancelAnimationFrame) immediately upon swap!"
        print("✓ Verified: Running simulation was stopped immediately.")

        # B) Başlangıç ve hedef takas edildi mi?
        swapped_start = await start_input.input_value()
        swapped_target = await target_input.input_value()
        print(f"Swapped Start: '{swapped_start}', Swapped Target: '{swapped_target}'")
        assert "Zara" in swapped_start, f"Expected Start to be 'Zara', got '{swapped_start}'"
        assert "Avva" in swapped_target, f"Expected Target to be 'Avva', got '{swapped_target}'"
        print("✓ Verified: Start and Target stores successfully swapped.")

        # C) Sepet yeni başlangıç koordinatına çekildi mi?
        cart_index = await page.evaluate("window.cartSimulator.currentIndex")
        cart_sub = await page.evaluate("window.cartSimulator.subProgress")
        cart_floor = await page.evaluate("window.cartSimulator.currentFloor")
        print(f"Cart state: currentIndex={cart_index}, subProgress={cart_sub}, floor={cart_floor}")
        assert cart_index == 0, f"Expected cart index 0, got {cart_index}"
        assert cart_sub == 0, f"Expected cart subProgress 0, got {cart_sub}"
        assert cart_floor == 5, f"Expected cart to be on Zara's floor (Floor 5), got {cart_floor}"
        print("✓ Verified: Cart mascot reset to beginning of new route at Zara (Floor 5).")

        # D) Rota önizleme modunda mı? HUD [▶ Başlat] gösteriyor mu?
        hud_btn_text = (await page.locator("#hud-sim-text").text_content()).strip()
        print(f"HUD Sim button text after swap: '{hud_btn_text}'")
        assert "Başlat" in hud_btn_text, f"Expected 'Başlat' in HUD button text, got '{hud_btn_text}'"
        print("✓ Verified: HUD button reset to 'Başlat' in preview mode.")

        # E) Dinamik üst başlık tersine döndü mü (yeni hedef Avva gösteriliyor mu)?
        header_title = (await page.locator("#current-floor-title").text_content()).strip()
        print(f"Header Title after swap: '{header_title}'")
        assert "Avva" in header_title, f"Expected Avva in header title after swap, got '{header_title}'"

        await page.screenshot(path="screenshot_swap_during_simulation_stopped_at_new_start.png")

        # 3.5: Yeni rotada simülasyon tekrar başlatılabilmeli
        print("Starting reversed simulation from Zara to Avva...")
        await page.click("#btn-hud-sim-play")
        await page.wait_for_timeout(150)

        is_running_reversed = await page.evaluate("window.cartSimulator.isPlaying || window.cartSimulator.subProgress > 0 || window.cartSimulator.currentIndex > 0")
        assert is_running_reversed, "Reversed simulation should start and run smoothly"
        print("✓ Verified: Reversed simulation runs successfully from Zara to Avva")

        # Rotayı bitir
        await page.click("#btn-hud-finish")
        await page.wait_for_timeout(300)

        # Konsol hatalarını doğrula
        print(f"\nConsole errors recorded: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"

        print("\n========================================================")
        print("🎉 ALL SWAP LOGIC & ACTIVE FOCUS TESTS PASSED WITH 0 ERRORS!")
        print("========================================================")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_swap_and_focus())
