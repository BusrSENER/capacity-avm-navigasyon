import asyncio
import os
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run_consistency_tests():
    console_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # =====================================================================
        # TEST 1: MASAÜSTÜ GÖRÜNÜM (1280x800) - DESKTOP UX & GHOST TEXT FIX
        # =====================================================================
        print("\n--- TEST 1: Masaüstü Görünüm (1280x800) ---")
        desktop_context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await desktop_context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_selector("#map-canvas-container svg", timeout=10000)
        await page.wait_for_timeout(700) # Allow splash fade-out

        # 1.1: Tommy Hilfiger Rozet & Logo Standartlaşması Denetimi
        print("Checking Tommy Hilfiger marker structure...")
        th_marker = page.locator(".logo-tile-marker[data-store-id='store_4_39']")
        assert await th_marker.count() > 0, "Tommy Hilfiger marker must be present on Floor 4"

        # Anchor sınıfı var mı?
        th_classes = await th_marker.get_attribute("class") or ""
        print(f"Tommy Hilfiger marker classes: {th_classes}")
        assert "is-anchor" in th_classes, "Tommy Hilfiger must have .is-anchor class like Massimo Dutti and Beymen Club"

        # Koordinat denetimi: cx=610, cy=230
        th_style = await th_marker.get_attribute("style") or ""
        print(f"Tommy Hilfiger marker style: {th_style}")
        assert "left: 610px" in th_style and "top: 230px" in th_style, f"Tommy Hilfiger must be centered at cx=610, cy=230, got: {th_style}"

        # Standart beyaz etiket rozeti (marker-name-label)
        th_label = th_marker.locator(".marker-name-label")
        assert await th_label.count() > 0, "Tommy Hilfiger must have .marker-name-label"
        label_text = (await th_label.inner_text()).strip()
        print(f"Tommy Hilfiger label text: '{label_text}'")
        assert "Tommy Hilfiger" in label_text, f"Label text must contain 'Tommy Hilfiger', got: '{label_text}'"

        # Vektörel logo kontrolü (lacivert, beyaz, kırmızı flag renkleri)
        logo_svg = await th_marker.locator(".logo-tile").inner_html()
        assert "#001744" in logo_svg and "#cc0c2f" in logo_svg, "Tommy Hilfiger logo must contain signature brand flag vector SVG"
        print("PASS: Tommy Hilfiger rozeti ve logosu komşu anchor mağazalarla standartlaştırıldı.")

        # 1.2: SVG Harita Zeminindeki Hayalet Metinlerin Gizlendiğinin Denetimi (Ghost Text Fix)
        print("Checking ghost text fix in SVG layer...")
        ghost_texts_visible = await page.evaluate("""() => {
            const texts = document.querySelectorAll('#svg-layer .store-polygon text');
            let visibleCount = 0;
            texts.forEach(t => {
                const style = window.getComputedStyle(t);
                if (style.display !== 'none' && style.opacity !== '0' && style.visibility !== 'hidden') {
                    visibleCount++;
                }
            });
            return {
                totalStoreTexts: texts.length,
                visibleCount: visibleCount
            };
        }""")
        print(f"SVG store texts: total={ghost_texts_visible['totalStoreTexts']}, visible={ghost_texts_visible['visibleCount']}")
        assert ghost_texts_visible['visibleCount'] == 0, f"Expected 0 ghost texts in SVG, but found {ghost_texts_visible['visibleCount']} visible"
        print("PASS: SVG zeminindeki eski statik mağaza metinleri tamamen gizlendi.")

        # 1.3: Masaüstünde Tommy Hilfiger Seçimi (Desktop UX)
        print("Clicking Tommy Hilfiger on desktop...")
        await th_marker.click()
        await page.wait_for_timeout(500)

        # Sol Sidebar POI Paneli açıldı mı?
        poi_panel = page.locator("#sidebar-poi-detail")
        assert await poi_panel.is_visible(), "Expected left sidebar #sidebar-poi-detail to be visible on desktop"
        poi_name = await page.locator("#poi-name").inner_text()
        print(f"Sidebar POI Name: '{poi_name}'")
        assert "Tommy Hilfiger" in poi_name, f"Expected POI name to be Tommy Hilfiger, got: {poi_name}"

        # MASAÜSTÜNDE PEEK KART KESİNLİKLE GÖRÜNMEMELİ!
        peek_card = page.locator("#poi-peek-card")
        peek_display = await page.evaluate("""() => {
            const card = document.getElementById('poi-peek-card');
            if (!card) return 'null';
            return window.getComputedStyle(card).display;
        }""")
        print(f"Desktop #poi-peek-card computed display: {peek_display}")
        assert peek_display == "none", f"Expected #poi-peek-card display to be 'none' on desktop, got: {peek_display}"
        assert not await peek_card.is_visible(), "#poi-peek-card must not be visible on desktop!"
        print("PASS: Masaüstünde #poi-peek-card kesinlikle görünmüyor; sol sidebar açıldı.")

        # Ekran görüntüsü kaydet
        desktop_screenshot = os.path.join(ARTIFACTS_DIR, "screenshot_desktop_tommy_hilfiger_selected.png")
        await page.screenshot(path=desktop_screenshot)
        print(f"Saved desktop screenshot: {desktop_screenshot}")
        await desktop_context.close()

        # =====================================================================
        # TEST 2: MOBİL GÖRÜNÜM (390x844) - MOBILE PEEK CARD UX
        # =====================================================================
        print("\n--- TEST 2: Mobil Görünüm (390x844) ---")
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

        # Mobilde Tommy Hilfiger seç
        print("Selecting Tommy Hilfiger on mobile...")
        await mobile_page.evaluate("""() => {
            const all = getAllMallStores();
            const th = all.find(s => s.name === 'Tommy Hilfiger' && s.floor === 4);
            if (th) selectStore(th);
        }""")
        await mobile_page.wait_for_timeout(500)

        # Mobilde #poi-peek-card AÇILMALI!
        m_peek = mobile_page.locator("#poi-peek-card")
        assert await m_peek.is_visible(), "Expected #poi-peek-card to be visible on mobile!"
        m_peek_name = await mobile_page.locator("#peek-store-name").inner_text()
        print(f"Mobile Peek Card Store Name: '{m_peek_name}'")
        assert "Tommy Hilfiger" in m_peek_name, f"Expected peek card name Tommy Hilfiger, got: {m_peek_name}"

        # Alt çekmece ekranı kaplamamalı
        sidebar_classes = await mobile_page.locator("#sidebar-panel").get_attribute("class") or ""
        assert "is-expanded" not in sidebar_classes, "Sidebar bottom sheet must not expand over map when peek card opens"
        print("PASS: Mobilde #poi-peek-card beklendiği gibi açıldı, alt çekmece haritayı kapatmadı.")

        # Ekran görüntüsü kaydet
        mobile_screenshot = os.path.join(ARTIFACTS_DIR, "screenshot_mobile_tommy_hilfiger_peek.png")
        await mobile_page.screenshot(path=mobile_screenshot)
        print(f"Saved mobile screenshot: {mobile_screenshot}")
        await mobile_context.close()

        # =====================================================================
        # TEST 3: SIFIR KONSOL HATASI DENETİMİ
        # =====================================================================
        print("\n--- TEST 3: Sıfır Konsol Hatası Denetimi ---")
        print(f"Console errors: {console_errors}")
        assert len(console_errors) == 0, f"Console errors detected: {console_errors}"
        print("PASS: 0 console errors detected.")

        print("\n=======================================================")
        print("🎉 ALL DESKTOP / MOBILE CONSISTENCY TESTS PASSED (100%)!")
        print("=======================================================")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_consistency_tests())
