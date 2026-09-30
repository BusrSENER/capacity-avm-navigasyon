import asyncio
from playwright.async_api import async_playwright

async def run_peek_and_autocomplete_tests():
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

        print("Navigating to http://127.0.0.1:3000/ ...")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_selector("#map-canvas-container", timeout=10000)
        await page.wait_for_timeout(1000)

        # =====================================================================
        # TEST 1: GLOBAL ARAMA & AUTOCOMPLETE DROPDOWN
        # =====================================================================
        print("\n--- TEST 1: Global Arama & Autocomplete Dropdown ---")
        target_input = page.locator("#input-target-loc")
        
        # 1.1: [🎯 Nereye?] kutusuna "Gratis" yaz
        print("Typing 'Gratis' into [🎯 Nereye?]...")
        await target_input.click()
        await target_input.fill("Gratis")
        await page.wait_for_timeout(400)

        auto_list = page.locator("#search-autocomplete-list")
        is_visible = await auto_list.is_visible()
        print(f"Autocomplete list visible: {is_visible}")
        assert is_visible, "Expected #search-autocomplete-list to be visible when typing"

        # Listede Gratis öğesi ve kat bilgisi (1. Kat) var mı?
        gratis_item = auto_list.locator(".search-autocomplete-item:has-text('Gratis')")
        gratis_count = await gratis_item.count()
        print(f"Gratis items found in dropdown: {gratis_count}")
        assert gratis_count > 0, "Expected at least 1 Gratis item in autocomplete dropdown"

        gratis_text = await gratis_item.first.inner_text()
        print(f"Gratis item text content:\n{gratis_text}")
        assert "1. Kat" in gratis_text or "Kat" in gratis_text, f"Expected floor badge in item, got: {gratis_text}"

        # 1.2: Farklı kattaki mağazayı seç (Gratis: 1. Kat / Floor 5)
        # Mevcut kat: 4 (Zemin). Seçim sonrası otomatik olarak Kat 5'e geçmeli ve peek card açılmalı!
        print("Selecting Gratis from autocomplete list...")
        await gratis_item.first.click()
        await page.wait_for_timeout(800)

        current_floor = await page.evaluate("window.mallMap.currentFloor")
        print(f"Current floor after selection: {current_floor}")
        assert current_floor == 5, f"Expected map floor to switch to 5 (1. Kat), got {current_floor}"

        # =====================================================================
        # TEST 2: KOMPAKT MAĞAZA KARTI (PEEK MODE - 130px)
        # =====================================================================
        print("\n--- TEST 2: Kompakt Mağaza Kartı (Peek Mode - 130px) ---")
        peek_card = page.locator("#poi-peek-card")
        peek_visible = await peek_card.is_visible()
        print(f"Peek card visible: {peek_visible}")
        assert peek_visible, "Expected #poi-peek-card to be visible"

        # Kart boyutlarını doğrula (<= 150px)
        box = await peek_card.bounding_box()
        print(f"Peek card bounding box: width={box['width']}, height={box['height']}, y={box['y']}")
        assert box['height'] <= 150, f"Expected peek card height <= 150px, but got {box['height']}px"

        # Kart içeriğini doğrula: Mağaza Adı, Kategori, Landmark, Butonlar
        peek_name = await page.locator("#peek-store-name").inner_text()
        peek_landmark = await page.locator("#peek-landmark-text").inner_text()
        print(f"Peek card store: '{peek_name}', Landmark: '{peek_landmark}'")
        assert "Gratis" in peek_name, f"Expected Gratis in peek name, got '{peek_name}'"
        assert "1. Kat" in peek_landmark, f"Expected 1. Kat in landmark text, got '{peek_landmark}'"

        # Ekran görüntüsü al
        await page.screenshot(path="screenshot_peek_card_mobile.png")
        print("Screenshot saved: screenshot_peek_card_mobile.png")

        # 2.2: Haritanın boş zeminine dokunulduğunda kartın kapanması
        print("Tapping empty map area to verify peek card dismissal...")
        # (130, 150) koridorda boş zemin üzerindedir
        await page.mouse.click(130, 150)
        await page.wait_for_timeout(400)

        peek_visible_after = await peek_card.is_visible()
        print(f"Peek card visible after empty tap: {peek_visible_after}")
        assert not peek_visible_after, "Expected #poi-peek-card to close on empty map tap"

        # 2.3: Haritadan mağaza poligonuna tıklandığında alt çekmecenin KESİNLİKLE açılmadığını,
        # yalnızca peek card'ın açıldığını doğrula
        print("Clicking a store polygon on map (Atasay / Floor 4)...")
        await page.evaluate("() => { window.mallMap.loadFloor(4); }")
        await page.wait_for_timeout(500)
        
        # Click Atasay polygon on map
        await page.evaluate("""() => {
            const poly = document.querySelector('[data-id=\"store_4_1\"]') || document.querySelector('#store_4_1');
            if (poly) poly.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }""")
        await page.wait_for_timeout(500)

        # Alt çekmecenin genişletilmediğini doğrula
        sheet_expanded = await page.evaluate("document.getElementById('sidebar-panel').classList.contains('is-expanded')")
        print(f"Sidebar expanded on store click: {sheet_expanded}")
        assert not sheet_expanded, "Expected sidebar-panel NOT to expand on store click (Must stay in Peek mode!)"

        # Peek kartın açıldığını doğrula
        peek_now = await peek_card.is_visible()
        box_now = await peek_card.bounding_box()
        print(f"Peek card visible: {peek_now}, height: {box_now['height']}px")
        assert peek_now, "Expected #poi-peek-card to open on store click"
        assert box_now['height'] <= 150, f"Expected height <= 150px, got {box_now['height']}"

        # =====================================================================
        # TEST 3: HUD & FOOTER ÇAKIŞMASINI TEMİZLEME
        # =====================================================================
        print("\n--- TEST 3: HUD & Footer Çakışmasını Temizleme ---")
        floating_toggle = page.locator("#floating-view-toggle")
        
        # Rota öncesi yüzen buton görünür olmalı
        toggle_visible_before = await floating_toggle.is_visible()
        print(f"Floating view toggle visible before route: {toggle_visible_before}")
        assert toggle_visible_before, "Expected #floating-view-toggle to be visible before route"

        # Vakko ➔ Zara rotası oluştur
        print("Setting up route: Vakko (Floor 4) -> Zara (Floor 5)...")
        await page.evaluate("""() => {
            const all = getAllMallStores();
            const s = all.find(x => x.name.toLowerCase().includes('vakko'));
            const t = all.find(x => x.name.toLowerCase().includes('zara'));
            setStartLocation(s);
            setTargetLocation(t);
        }""")
        await page.wait_for_timeout(800)

        # Rota başlayınca HUD bar aktifleşmeli, yüzen buton gizlenmeli!
        hud_bar = page.locator("#nav-hud-bar")
        hud_active = await hud_bar.is_visible()
        toggle_hidden = await floating_toggle.is_hidden()
        print(f"HUD Bar visible: {hud_active}, Floating Toggle hidden: {toggle_hidden}")
        assert hud_active, "Expected #nav-hud-bar to be visible"
        assert toggle_hidden, "Expected #floating-view-toggle to be HIDDEN during active route!"

        # Ekran görüntüsü al
        await page.screenshot(path="screenshot_hud_no_floating_clutter.png")
        print("Screenshot saved: screenshot_hud_no_floating_clutter.png")

        # Rotayı bitirince yüzen buton geri gelmeli
        print("Finishing route via HUD Finish button...")
        await page.locator("#btn-hud-finish").click()
        await page.wait_for_timeout(500)

        toggle_visible_after = await floating_toggle.is_visible()
        hud_hidden_after = await hud_bar.is_hidden()
        print(f"Floating toggle restored: {toggle_visible_after}, HUD bar hidden: {hud_hidden_after}")
        assert toggle_visible_after, "Expected #floating-view-toggle to return after route is finished"

        # =====================================================================
        # KONSOL HATALARI KONTROLÜ
        # =====================================================================
        print(f"\nTotal console errors: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found {len(console_errors)} console errors"

        await browser.close()
        print("\n========================================================")
        print("🎉 ALL PEEK MODE, AUTOCOMPLETE & HUD CLEANUP TESTS PASSED!")
        print("========================================================")

if __name__ == '__main__':
    asyncio.run(run_peek_and_autocomplete_tests())
