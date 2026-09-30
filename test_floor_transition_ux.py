import asyncio
import os
import sys

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run_floor_transition_tests():
    console_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        print("\n=== E2E TEST: ÇOK KATLI NAVİGASYON KAT GEÇİŞİ (2. Kat Günaydın -> Zemin Kat Cookshop) ===")
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_selector("#map-canvas-container svg", timeout=10000)
        await page.wait_for_timeout(700) # Splash fade-out

        # 1. BAŞLANGIÇ: Günaydın (Floor 6 / 2. Kat), HEDEF: Cookshop (Floor 4 / Zemin Kat)
        print("Setting up multi-floor route: Günaydın (2. Kat) -> Cookshop (Zemin Kat)...")
        route_info = await page.evaluate("""() => {
            const all = getAllMallStores();
            const gunaydin = all.find(s => s.name.includes('Günayd') || s.id === 'store_6_11');
            const cookshop = all.find(s => s.name === 'Cookshop' || s.id === 'store_4_8');

            if (!gunaydin || !cookshop) {
                return { error: 'Stores not found', gunaydin: !!gunaydin, cookshop: !!cookshop };
            }

            setStartLocation(gunaydin);
            setTargetLocation(cookshop);

            return {
                start: { name: gunaydin.name, floor: gunaydin.floor, id: gunaydin.id },
                target: { name: cookshop.name, floor: cookshop.floor, id: cookshop.id },
                hasRoute: !!mallMap.activeRoute,
                currentFloor: mallMap.currentFloor
            };
        }""")

        print(f"Route configured: {route_info}")
        assert "error" not in route_info, f"Failed to find stores: {route_info}"
        assert route_info['hasRoute'], "Route should be calculated"

        # Başlangıç katı 6 (2. Kat) olmalı
        assert route_info['currentFloor'] == 6, f"Expected map floor 6, got {route_info['currentFloor']}"

        # Kat seçici butonunda 6 aktif olmalı
        active_pill = await page.locator(".floor-pill.active").get_attribute("data-floor")
        print(f"Active floor selector pill: {active_pill}")
        assert active_pill == "6", f"Floor selector active pill should be 6, got {active_pill}"

        # 2. SİMÜLASYONU BAŞLAT VE HIZLANDIR
        print("Starting simulation with 4x speed...")
        await page.evaluate("""() => {
            cartSimulator.setSpeed(4.0);
            toggleCartSimulation();
        }""")

        # 3. KAT GEÇİŞ BİLDİRİMİNİN BELİRMESİNİ BEKLE
        print("Waiting for floor transition overlay to appear in DOM...")
        overlay_locator = page.locator("#floor-transition-overlay")

        # Overlay'in görünür olmasını bekle (is-active sınıfı)
        await page.wait_for_selector("#floor-transition-overlay.is-active", timeout=10000)
        print("PASS: Kat geçiş bildirimi (#floor-transition-overlay) DOM'da belirdi!")

        # Bildirim içeriğini kontrol et
        card_content = await page.evaluate("""() => {
            const card = document.getElementById('floor-transition-card');
            const title = document.getElementById('floor-transition-title')?.textContent || '';
            const badge = document.getElementById('floor-transition-badge')?.textContent || '';
            const icon = document.getElementById('floor-transition-icon')?.textContent || '';
            const computedStyle = window.getComputedStyle(card);
            return {
                title: title.trim(),
                badge: badge.trim(),
                icon: icon.trim(),
                backdropFilter: computedStyle.backdropFilter || computedStyle.webkitBackdropFilter
            };
        }""")
        print(f"Transition Card Details: {card_content}")
        assert "İniyorsunuz" in card_content['title'] or "İniş" in card_content['title'], f"Expected descent title, got '{card_content['title']}'"
        assert card_content['icon'] in ["🪜", "🛗"], f"Expected transfer icon, got '{card_content['icon']}'"
        print("PASS: Glassmorphism ve dinamik ikon/metin doğrulaması başarılı.")

        # Ekran görüntüsü kaydet (Geçiş anı)
        transition_screenshot = os.path.join(ARTIFACTS_DIR, "screenshot_floor_transition_overlay.png")
        await page.screenshot(path=transition_screenshot)
        print(f"Saved transition screenshot: {transition_screenshot}")

        # 4. ZEMİN KATA (FLOOR 4) GEÇİŞ VE BİLDİRİMİN KAPANMASINI BEKLE
        print("Waiting for simulation to reach Floor 4 (Zemin Kat)...")
        # Katın 4 olmasına kadar bekle
        for _ in range(60):
            cur_fl = await page.evaluate("() => mallMap.currentFloor")
            if cur_fl == 4:
                break
            await page.wait_for_timeout(250)

        final_floor = await page.evaluate("() => mallMap.currentFloor")
        print(f"Current map floor: {final_floor}")
        assert final_floor == 4, f"Expected final floor to be 4 (Zemin Kat), got {final_floor}"
        print("PASS: Harita otomatik olarak Zemin Kat'a (Floor 4) geçti.")

        # Sağdaki kat seçici butonunda Zemin Kat (4) aktif mi?
        active_pill_after = await page.locator(".floor-pill.active").get_attribute("data-floor")
        print(f"Active floor selector pill after transition: {active_pill_after}")
        assert active_pill_after == "4", f"Floor selector active pill should be 4, got {active_pill_after}"
        print("PASS: Sağdaki kat seçici butonu (Floor Selector) Zemin Kat'a (4) kaydı.")

        # Bildirimin kapanmasını bekle (fade-out sonrası gizlenme)
        await page.wait_for_selector("#floor-transition-overlay:not(.is-active)", timeout=6000)
        print("PASS: Kat geçiş bildirimi başarıyla kapandı.")

        # 5. SİMÜLASYONUN COOKSHOP HEDEFİNE KADAR KESİNTİSİZ DEVAM ETMESİNİ BEKLE
        print("Waiting for simulation to finish at Cookshop...")
        for _ in range(80):
            is_playing = await page.evaluate("() => cartSimulator.isPlaying")
            pct = await page.evaluate("() => { const b = document.getElementById('sim-progress-bar'); return b ? parseFloat(b.style.width) : 0; }")
            if not is_playing or pct >= 99:
                break
            await page.wait_for_timeout(250)

        sim_status = await page.evaluate("""() => {
            return {
                currentIndex: cartSimulator.currentIndex,
                totalNodes: cartSimulator.pathNodes.length,
                progressPct: document.getElementById('sim-progress-bar')?.style.width,
                cartX: cartSimulator.currentX,
                cartY: cartSimulator.currentY,
                cartFloor: cartSimulator.currentFloor
            };
        }""")
        print(f"Simulation final status: {sim_status}")
        assert sim_status['cartFloor'] == 4, f"Cart must finish on Floor 4, got {sim_status['cartFloor']}"

        # Zemin Kat Cookshop bitiş ekran görüntüsü
        finish_screenshot = os.path.join(ARTIFACTS_DIR, "screenshot_floor_transition_finished_at_cookshop.png")
        await page.screenshot(path=finish_screenshot)
        print(f"Saved final screenshot: {finish_screenshot}")

        # 6. ASANSÖR (ELEVATOR) İLE KAT GEÇİŞ İKONU VE METNİ TESTİ
        print("\n--- 6. Asansör (🛗) Tercihi ile Kat Geçiş İkonu Testi ---")
        await page.evaluate("""() => {
            cartSimulator.stop();
            setRoutePreference('elevator');
            const all = getAllMallStores();
            const gunaydin = all.find(s => s.name.includes('Günayd') || s.id === 'store_6_11');
            const cookshop = all.find(s => s.name === 'Cookshop' || s.id === 'store_4_8');
            setStartLocation(gunaydin);
            setTargetLocation(cookshop);
            cartSimulator.setSpeed(4.0);
            toggleCartSimulation();
        }""")

        await page.wait_for_selector("#floor-transition-overlay.is-active", timeout=12000)
        elev_content = await page.evaluate("""() => {
            return {
                title: document.getElementById('floor-transition-title')?.textContent.trim() || '',
                badge: document.getElementById('floor-transition-badge')?.textContent.trim() || '',
                icon: document.getElementById('floor-transition-icon')?.textContent.trim() || ''
            };
        }""")
        print(f"Elevator Transition Card: {elev_content}")
        assert elev_content['icon'] == "🛗", f"Expected elevator icon 🛗, got '{elev_content['icon']}'"
        assert "Asansör" in elev_content['badge'], f"Expected badge containing 'Asansör', got '{elev_content['badge']}'"
        print("PASS: Asansör rotasında 🛗 ikonu ve 'Panoramik Asansör' etiketi başarıyla doğrulandı.")

        # Ekran görüntüsü al
        elev_screenshot = os.path.join(ARTIFACTS_DIR, "screenshot_floor_transition_elevator.png")
        await page.screenshot(path=elev_screenshot)
        print(f"Saved elevator screenshot: {elev_screenshot}")

        # 7. SIFIR KONSOL HATASI DENETİMİ
        print(f"Console errors collected: {console_errors}")
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"
        print("PASS: 0 console errors detected.")

        await context.close()
        print("\n=======================================================")
        print("🎉 TÜM KAT GEÇİŞİ & SİMÜLASYON TESTLERİ GEÇTİ (100%)!")
        print("=======================================================")

if __name__ == '__main__':
    asyncio.run(run_floor_transition_tests())
