import asyncio
import os
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run_store_selection_tests():
    console_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # =====================================================================
        # TEST 1: MASAÜSTÜ (1280x800) - SELECTSTORE & POINTER-EVENTS
        # =====================================================================
        print("\n=== TEST 1: MASAÜSTÜ GÖRÜNÜM (1280x800) ===")
        desktop_context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await desktop_context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_selector("#map-canvas-container svg", timeout=10000)
        await page.wait_for_timeout(700) # Splash fade-out

        # 1.1: ROZET METİN ETİKETİNE (.marker-name-label) TIKLAMA TESTİ
        print("\n--- 1.1: Tommy Hilfiger Rozet Metin Etiketine (.marker-name-label) Tıklama ---")
        th_label = page.locator(".logo-tile-marker[data-store-id='store_4_39'] .marker-name-label")
        assert await th_label.count() > 0, "Tommy Hilfiger .marker-name-label bulunamadı!"

        # Etiketin tıklanabilir olduğunu doğrula (pointer-events != none)
        label_pointer_events = await th_label.evaluate("el => window.getComputedStyle(el).pointerEvents")
        print(f"Computed pointer-events on .marker-name-label: {label_pointer_events}")
        assert label_pointer_events != "none", f"Expected pointer-events to not be none, got {label_pointer_events}"

        # Rozet metnine tıkla
        await th_label.click(force=True)
        await page.wait_for_timeout(500)

        # Sol kenar çubuğundaki POI Detay Paneli (#sidebar-poi-detail) açıldı mı?
        poi_panel = page.locator("#sidebar-poi-detail")
        assert await poi_panel.is_visible(), "Masaüstünde Tommy Hilfiger rozetine tıklandığında #sidebar-poi-detail görünür olmalı!"
        poi_name = (await page.locator("#poi-name").inner_text()).strip()
        print(f"Sidebar POI Name: '{poi_name}'")
        assert "Tommy Hilfiger" in poi_name, f"Expected 'Tommy Hilfiger', got '{poi_name}'"

        # SVG poligonunda aktif seçim vurgusu (.store-selected / stroke: #0284c7) var mı?
        poly_check = await page.evaluate("""() => {
            const poly = document.querySelector('#room_4_39') || document.querySelector('[data-id="store_4_39"]');
            if (!poly) return { found: false };
            const rect = poly.querySelector('rect');
            return {
                found: true,
                classes: poly.getAttribute('class') || '',
                polyStroke: poly.style.stroke,
                rectStroke: rect ? rect.style.stroke : '',
                computedStroke: window.getComputedStyle(rect || poly).stroke
            };
        }""")
        print(f"Polygon check after label click: {poly_check}")
        assert poly_check['found'], "Tommy Hilfiger SVG poligonu bulunamadı!"
        assert "store-selected" in poly_check['classes'], f"Poligonda .store-selected sınıfı olmalı: {poly_check['classes']}"

        # Mouse harita dışına çıktığında vurgu kayboluyor mu? (Mouseleave regression testi)
        await page.mouse.move(0, 0)
        await page.wait_for_timeout(200)
        poly_after_leave = await page.evaluate("""() => {
            const poly = document.querySelector('#room_4_39') || document.querySelector('[data-id="store_4_39"]');
            return poly.classList.contains('store-selected') && poly.classList.contains('store-highlight');
        }""")
        assert poly_after_leave, "Mouse ayrıldığında seçili mağazanın vurgusu KORUNMALI (mouseleave silmemeli)!"
        print("PASS: Rozet etiketine tıklandığında mağaza seçildi, sidebar açıldı ve vurgu korundu.")

        # Masaüstünde Peek Kartın kapalı olduğunu doğrula
        peek_display = await page.evaluate("() => window.getComputedStyle(document.getElementById('poi-peek-card')).display")
        assert peek_display == "none", f"Masaüstünde #poi-peek-card gizli olmalı, got {peek_display}"

        # 1.2: GERİ BUTONU İLE KAPATMA VE SVG POLİGONUNA DOĞRUDAN TIKLAMA
        print("\n--- 1.2: Doğrudan SVG Poligonuna (#room_4_39) Tıklama ---")
        await page.locator("#poi-back-btn").click()
        await page.wait_for_timeout(300)
        assert not await poi_panel.is_visible(), "Geri butonuna basıldığında POI paneli kapanmalı!"

        # Şimdi doğrudan SVG poligonuna tıkla
        poly_rect = page.locator("#room_4_39 rect")
        await poly_rect.click(force=True)
        await page.wait_for_timeout(500)

        assert await poi_panel.is_visible(), "Doğrudan SVG poligonuna tıklandığında #sidebar-poi-detail açılmalı!"
        poi_name_2 = (await page.locator("#poi-name").inner_text()).strip()
        assert "Tommy Hilfiger" in poi_name_2, f"Expected 'Tommy Hilfiger', got '{poi_name_2}'"
        print("PASS: Doğrudan SVG poligonuna (#room_4_39) tıklandığında da mağaza başarıyla seçildi.")

        # Ekran görüntüsü al
        desktop_img = os.path.join(ARTIFACTS_DIR, "screenshot_desktop_tommy_hilfiger_selected.png")
        await page.screenshot(path=desktop_img)
        print(f"Saved desktop screenshot: {desktop_img}")
        await desktop_context.close()

        # =====================================================================
        # TEST 2: MOBİL (390x844) - PEEK CARD & HARİTA ETKİLEŞİMİ
        # =====================================================================
        print("\n=== TEST 2: MOBİL GÖRÜNÜM (390x844) ===")
        mobile_context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            is_mobile=True,
            has_touch=True
        )
        mobile_page = await mobile_context.new_page()

        mobile_page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        mobile_page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        await mobile_page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await mobile_page.wait_for_selector("#map-canvas-container svg", timeout=10000)
        await mobile_page.wait_for_timeout(700)

        # Mobilde Tommy Hilfiger rozetine dokun
        print("Tapping Tommy Hilfiger marker on mobile...")
        m_marker = mobile_page.locator(".logo-tile-marker[data-store-id='store_4_39']")
        await m_marker.click(force=True)
        await mobile_page.wait_for_timeout(500)

        # Mobilde #poi-peek-card açılmalı
        m_peek = mobile_page.locator("#poi-peek-card")
        assert await m_peek.is_visible(), "Mobilde mağazaya dokunulduğunda #poi-peek-card görünür olmalı!"
        m_name = (await mobile_page.locator("#peek-store-name").inner_text()).strip()
        print(f"Mobile Peek Name: '{m_name}'")
        assert "Tommy Hilfiger" in m_name, f"Expected 'Tommy Hilfiger', got '{m_name}'"

        # Peek kart butonlarının mevcut olduğunu doğrula
        assert await mobile_page.locator("#btn-peek-start").is_visible(), "Peek kartta [Buradan Başla] butonu olmalı"
        assert await mobile_page.locator("#btn-peek-target").is_visible(), "Peek kartta [Hedef Yap] butonu olmalı"

        # Alt çekmecenin (%85) açılmadığını, peek modunda kaldığını doğrula
        is_expanded = await mobile_page.evaluate("""() => {
            const sheet = document.getElementById('sidebar-panel');
            return sheet ? sheet.classList.contains('is-expanded') : false;
        }""")
        assert not is_expanded, "Mobilde mağaza seçildiğinde alt çekmece genişlememeli (%85 kaplamamalı)!"
        print("PASS: Mobilde Tommy Hilfiger seçildiğinde kompakt peek kartı açıldı, alt çekmece haritayı kapatmadı.")

        # Ekran görüntüsü al
        mobile_img = os.path.join(ARTIFACTS_DIR, "screenshot_mobile_tommy_hilfiger_peek.png")
        await mobile_page.screenshot(path=mobile_img)
        print(f"Saved mobile screenshot: {mobile_img}")
        await mobile_context.close()

        # =====================================================================
        # TEST 3: SIFIR KONSOL HATASI DENETİMİ
        # =====================================================================
        print("\n=== TEST 3: SIFIR KONSOL HATASI DENETİMİ ===")
        print(f"Console errors collected: {console_errors}")
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"
        print("PASS: 0 console errors detected.")

        print("\n=======================================================")
        print("🎉 TÜM MAĞAZA SEÇİM & POINTER-EVENTS TESTLERİ GEÇTİ (100%)!")
        print("=======================================================")

if __name__ == '__main__':
    asyncio.run(run_store_selection_tests())
