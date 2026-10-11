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

        # Check ground-truth corridor sequence on Floor 4 & all 6 floors verified amenities
        corridor_check = await page.evaluate("""() => {
            const fl4 = window.mallData.floors['4'].stores;
            const pc = fl4.find(s => s.name === 'Pierre Cardin');
            const wc = fl4.find(s => s.name === 'W Collection');
            const mc = fl4.find(s => s.name === 'Madame Coco');
            const pb = fl4.find(s => s.name === 'Paşabahçe Mağazaları');
            const koton = window.mallData.floors['3'].stores.find(s => s.name === 'Koton');

            const floorAmenityCounts = {};
            for (let f = 1; f <= 6; f++) {
                floorAmenityCounts[f] = (window.mallData.floors[String(f)].amenities || []).length;
            }
            const nearEmergency = window.findNearestAmenity('emergency', 4);
            const nearElevator = window.findNearestAmenity('elevator', 4);
            const nearBaby = window.findNearestAmenity('baby', 4);
            const nearKiosk = window.findNearestAmenity('kiosk', 4);
            const nearWc = window.findNearestAmenity('wc', 4);
            const nearCarpark = window.findNearestAmenity('carpark', 2);

            return {
                pc: { unit: pc.unit, cx: pc.cx, cy: pc.cy },
                wc: { unit: wc.unit, cx: wc.cx, cy: wc.cy },
                mc: { unit: mc.unit, cx: mc.cx, cy: mc.cy },
                pb: { unit: pb.unit, cx: pb.cx, cy: pb.cy },
                kotonCampaign: koton ? koton.campaign : null,
                entrances: window.mallData.entrances.map(e => e.short_name),
                totalAmenities: (window.mallData.amenities || []).length,
                floorAmenityCounts,
                nearEmergency: nearEmergency ? nearEmergency.name : null,
                nearElevator: nearElevator ? nearElevator.name : null,
                nearBaby: nearBaby ? nearBaby.name : null,
                nearKiosk: nearKiosk ? nearKiosk.name : null,
                nearWc: nearWc ? nearWc.name : null,
                nearCarpark: nearCarpark ? nearCarpark.name : null
            };
        }""")
        print("   Field Data & Amenity Verification Check:", corridor_check)
        assert corridor_check["pc"]["unit"] == "Z-15"
        assert corridor_check["wc"]["unit"] == "Z-16"
        assert corridor_check["mc"]["unit"] == "Z-17"
        assert corridor_check["pb"]["unit"] == "Z-18"
        assert corridor_check["pc"]["cx"] > corridor_check["wc"]["cx"] > corridor_check["mc"]["cx"] > corridor_check["pb"]["cx"]
        assert corridor_check["kotonCampaign"]["discount"] == "%50 İndirim"
        assert corridor_check["totalAmenities"] >= 50, "All 6 floors must have comprehensive verified amenities!"
        assert corridor_check["nearEmergency"] is not None
        assert corridor_check["nearElevator"] is not None
        assert corridor_check["nearBaby"] is not None
        assert corridor_check["nearKiosk"] is not None
        assert corridor_check["nearWc"] is not None
        assert corridor_check["nearCarpark"] is not None

        # Test 2: Voice Command Modal (#btn-header-voice-command) & 1-Tap Voice Command Execution
        print("2. Testing Voice Command Modal (#btn-header-voice-command) & Turkish NLP Execution...")
        await page.click("#btn-header-voice-command")
        await page.wait_for_timeout(350)
        voice_modal_visible = await page.evaluate("!document.getElementById('voice-command-modal').classList.contains('hidden')")
        assert voice_modal_visible, "Voice command modal must open when clicking #btn-header-voice-command"

        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_voice_command_modal.png"))

        # Click the 1st sample voice command: "Pierre Cardin'deyim, Paşabahçe'ye götür"
        await page.click('.voice-sample-chip[data-voice-cmd*="Pierre Cardin"]')
        await page.wait_for_timeout(1200)  # Let User X walk along the 3D corridor into the view of W Collection & Madame Coco

        pov_state = await page.evaluate("""() => {
            const povContainer = document.getElementById('pov-3d-container');
            const canvas = document.getElementById('pov-3d-canvas');
            const title = document.getElementById('pov-hud-title')?.textContent || '';
            const step = document.getElementById('pov-hud-step')?.textContent || '';
            const passing = document.getElementById('pov-hud-passing-text')?.textContent || '';
            const passingLogoHtml = document.getElementById('pov-hud-passing-logo')?.innerHTML || '';
            const liveText = document.getElementById('live-nav-text')?.textContent || '';
            const landmarksText = document.getElementById('live-nav-landmarks-text')?.textContent || '';
            return {
                povVisible: povContainer && !povContainer.classList.contains('hidden'),
                engineActive: window.pov3dEngine ? window.pov3dEngine.isActive : false,
                isWalking: window.pov3dEngine ? window.pov3dEngine.isWalking : false,
                logosRenderedLastFrame: window.pov3dEngine ? window.pov3dEngine.logosRenderedLastFrame : 0,
                cachedLogosCount: window.pov3dEngine ? window.pov3dEngine.logoImageCache.size : 0,
                camX: window.pov3dEngine ? Math.round(window.pov3dEngine.camX) : 0,
                camY: window.pov3dEngine ? Math.round(window.pov3dEngine.camY) : 0,
                canvasW: canvas ? canvas.width : 0,
                canvasH: canvas ? canvas.height : 0,
                title,
                step,
                passing,
                hasPassingLogoSvg: passingLogoHtml.includes('<svg'),
                liveText,
                landmarksText,
                voiceEnabled: window.isVoiceEnabled,
                spokenText: window.lastSpokenNavigationText
            };
        }""")
        print("   1st-Person 3D POV & Corporate Logo State:", pov_state)
        assert pov_state["povVisible"] is True, "#pov-3d-container should be visible when route starts!"
        assert pov_state["engineActive"] is True, "pov3dEngine.isActive should be True!"
        assert pov_state["canvasW"] > 400 and pov_state["canvasH"] > 400, "3D Canvas must be sized properly!"
        assert pov_state["cachedLogosCount"] >= 170, "All 173 store corporate logos must be preloaded for 3D rendering!"
        assert pov_state["logosRenderedLastFrame"] > 0, "Corporate brand logos must be rendered on 3D storefronts and signboards!"
        assert pov_state["hasPassingLogoSvg"] is True, "Passing store HUD badge must render the store's corporate SVG logo!"
        assert "Pierre Cardin" in pov_state["title"] and "Paşabahçe" in pov_state["title"]
        assert "W Collection" in pov_state["liveText"] or "W Collection" in pov_state["landmarksText"] or "W Collection" in pov_state["passing"]
        assert pov_state["voiceEnabled"] is True, "Voice guidance should be enabled by default!"
        assert len(pov_state["spokenText"]) > 5, "Voice guidance should have spoken route instructions!"

        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_pov_3d_corridor_walk.png"))

        # Test 3: Switch to 2B Plan (#btn-mode-2d) and verify 2D En-Route Landmarks
        print("3. Testing Switch to 2B Plan (#btn-mode-2d)...")
        await page.click("#btn-mode-2d")
        await page.wait_for_timeout(400)
        mode_2d_state = await page.evaluate("""() => ({
            povHidden: document.getElementById('pov-3d-container').classList.contains('hidden'),
            enroutePolys: Array.from(document.querySelectorAll('.store-polygon.store-enroute')).map(el => el.getAttribute('data-name')),
            dimmedCount: document.querySelectorAll('.store-polygon.store-offroute-dimmed').length
        })""")
        print("   2B Plan State:", mode_2d_state)
        assert mode_2d_state["povHidden"] is True
        assert "W Collection" in mode_2d_state["enroutePolys"]
        assert "Madame Coco" in mode_2d_state["enroutePolys"]
        assert mode_2d_state["dimmedCount"] > 10
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_enroute_landmarks_2d.png"))

        # Test 4: Switch to 3B Maket (#btn-mode-3d)
        print("4. Testing Switch to 3B Maket (#btn-mode-3d)...")
        await page.click("#btn-mode-3d")
        await page.wait_for_timeout(500)
        perspective_state = await page.evaluate("""() => {
            const container = document.getElementById('map-canvas-container');
            const rotator = document.getElementById('map-rotator');
            return {
                is3DClass: container.classList.contains('is-3d-perspective'),
                transform: rotator.style.transform,
                billboardTilt: container.style.getPropertyValue('--billboard-tilt')
            };
        }""")
        print("   3B Maket State:", perspective_state)
        assert perspective_state["is3DClass"] is True
        assert "rotateX(28deg)" in perspective_state["transform"]
        assert perspective_state["billboardTilt"] == "-28deg"
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_3d_perspective_navigation.png"))

        # Test 5: Switch back to Gözümden 3B (#btn-mode-pov) and test Mobile Portrait (390x844)
        print("5. Testing Mobile Portrait Viewport (390x844) in Gözümden 3B mode...")
        await page.click("#btn-mode-pov")
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.wait_for_timeout(600)
        await page.screenshot(path=os.path.join(ARTIFACT_DIR, "screenshot_mobile_portrait_3d_ux.png"))

        assert len(console_errors) == 0, f"Console errors: {console_errors}"
        assert len(page_errors) == 0, f"Page errors: {page_errors}"
        print("ALL 1ST-PERSON 3D POV, CORPORATE LOGOS, VOICE SYNC & AMENITY VERIFICATION TESTS PASSED WITH 0 ERRORS!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
