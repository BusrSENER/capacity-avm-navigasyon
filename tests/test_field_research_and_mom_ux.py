import asyncio
import os
import sys
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding="utf-8")

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        console_errors = []
        page_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        print("1. Navigating to http://localhost:3000 ...")
        await page.goto("http://localhost:3000", wait_until="networkidle")
        await page.wait_for_timeout(2400)  # Wait for splash fade-out

        # Check ground-truth corridor sequence on Floor 4: Pierre Cardin -> W Collection -> Madame Coco -> Paşabahçe Mağazaları
        corridor_check = await page.evaluate("""() => {
            const fl4 = window.mallData.floors['4'].stores;
            const pc = fl4.find(s => s.name === 'Pierre Cardin');
            const wc = fl4.find(s => s.name === 'W Collection');
            const mc = fl4.find(s => s.name === 'Madame Coco');
            const pb = fl4.find(s => s.name === 'Paşabahçe Mağazaları');
            const koton = window.mallData.floors['3'].stores.find(s => s.name === 'Koton');
            return {
                pc: { unit: pc.unit, cx: pc.cx, cy: pc.cy },
                wc: { unit: wc.unit, cx: wc.cx, cy: wc.cy },
                mc: { unit: mc.unit, cx: mc.cx, cy: mc.cy },
                pb: { unit: pb.unit, cx: pb.cx, cy: pb.cy },
                kotonCampaign: koton ? koton.campaign : null,
                entrances: window.mallData.entrances.map(e => e.short_name)
            };
        }""")
        print("   Field Data Check:", corridor_check)
        assert corridor_check["pc"]["unit"] == "Z-15"
        assert corridor_check["wc"]["unit"] == "Z-16"
        assert corridor_check["mc"]["unit"] == "Z-17"
        assert corridor_check["pb"]["unit"] == "Z-18"
        assert corridor_check["pc"]["cx"] > corridor_check["wc"]["cx"] > corridor_check["mc"]["cx"] > corridor_check["pb"]["cx"]
        assert corridor_check["kotonCampaign"]["discount"] == "%50 İndirim"

        # Test 2: 1-Tap Self-Pinning button (#btn-header-pin-here)
        print("2. Testing 1-Tap Self-Pinning (#btn-header-pin-here)...")
        await page.click("#btn-header-pin-here")
        await page.wait_for_timeout(300)
        modal_visible = await page.evaluate("!document.getElementById('entrance-modal').classList.contains('hidden')")
        assert modal_visible, "Entrance self-pinning modal should open on clicking #btn-header-pin-here"
        await page.click("#entrance-modal-close")
        await page.wait_for_timeout(200)

        # Test 3: Route from Pierre Cardin (Z-15) to Paşabahçe Mağazaları (Z-18) -> En-Route Landmarks
        print("3. Testing En-Route Landmark Navigation (Pierre Cardin -> Paşabahçe Mağazaları)...")
        route_info = await page.evaluate("""() => {
            const fl4 = window.mallData.floors['4'].stores;
            const pc = fl4.find(s => s.name === 'Pierre Cardin');
            const pb = fl4.find(s => s.name === 'Paşabahçe Mağazaları');
            window.setStartLocation(pc);
            window.setTargetLocation(pb);
            const liveText = document.getElementById('live-nav-text')?.textContent || '';
            const landmarksText = document.getElementById('live-nav-landmarks-text')?.textContent || '';
            const enroutePolys = Array.from(document.querySelectorAll('.store-polygon.store-enroute')).map(el => el.getAttribute('data-name'));
            const dimmedCount = document.querySelectorAll('.store-polygon.store-offroute-dimmed').length;
            return {
                liveText,
                landmarksText,
                enroutePolys,
                dimmedCount
            };
        }""")
        print("   Route Info:", route_info)
        assert "W Collection" in route_info["liveText"] or "W Collection" in route_info["landmarksText"], "W Collection must appear as an en-route landmark!"
        assert "Madame Coco" in route_info["liveText"] or "Madame Coco" in route_info["landmarksText"], "Madame Coco must appear as an en-route landmark!"
        assert "W Collection" in route_info["enroutePolys"]
        assert "Madame Coco" in route_info["enroutePolys"]
        assert route_info["dimmedCount"] > 10, "Unrelated off-route stores should be softly dimmed!"

        await page.wait_for_timeout(600)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_enroute_landmarks_2d.png"))

        # Test 4: Turkish Voice Navigation Toggle (#btn-voice-toggle)
        print("4. Testing Turkish Voice Navigation Toggle (#btn-voice-toggle)...")
        await page.click("#btn-voice-toggle")
        await page.wait_for_timeout(300)
        voice_state = await page.evaluate("""() => ({
            enabled: window.isVoiceEnabled,
            spokenText: window.lastSpokenNavigationText,
            label: document.getElementById('voice-toggle-label')?.textContent
        })""")
        print("   Voice State:", voice_state)
        assert voice_state["enabled"] is True
        assert voice_state["label"] == "Sesli Açık"
        assert len(voice_state["spokenText"]) > 5

        # Test 5: 2.5D / 3D Architectural Perspective Toggle (#btn-3d-toggle)
        print("5. Testing 3D Architectural Perspective Toggle (#btn-3d-toggle)...")
        await page.click("#btn-3d-toggle")
        await page.wait_for_timeout(500)
        perspective_state = await page.evaluate("""() => {
            const container = document.getElementById('map-canvas-container');
            const rotator = document.getElementById('map-rotator');
            const btn = document.getElementById('btn-3d-toggle');
            return {
                is3DClass: container.classList.contains('is-3d-perspective'),
                btnActive: btn.classList.contains('is-active'),
                transform: rotator.style.transform,
                billboardTilt: container.style.getPropertyValue('--billboard-tilt')
            };
        }""")
        print("   3D Perspective State:", perspective_state)
        assert perspective_state["is3DClass"] is True
        assert perspective_state["btnActive"] is True
        assert "rotateX(28deg)" in perspective_state["transform"]
        assert perspective_state["billboardTilt"] == "-28deg"

        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_3d_perspective_navigation.png"))

        # Test 6: Mobile Portrait Viewport (390x844) ergonomics & 3D + Landmark HUD
        print("6. Testing Mobile Portrait Viewport (390x844)...")
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(500)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_portrait_3d_ux.png"))

        assert len(console_errors) == 0, f"Console errors: {console_errors}"
        assert len(page_errors) == 0, f"Page errors: {page_errors}"
        print("ALL FIELD RESEARCH & MOM-TEST UX CHECKS PASSED WITH 0 ERRORS!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
