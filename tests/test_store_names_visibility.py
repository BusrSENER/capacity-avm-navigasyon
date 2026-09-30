import asyncio
import os
from playwright.async_api import async_playwright

ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        console_errors = []
        def handle_console(msg):
            if msg.type == 'error':
                console_errors.append(msg.text)

        # 1. Desktop Test (1280x800)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()
        page.on("console", handle_console)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        print("Navigating to http://127.0.0.1:3000...")
        await page.goto("http://127.0.0.1:3000", wait_until="networkidle")

        # Dismiss splash screen if visible
        try:
            await page.wait_for_selector("#splash-screen", state="detached", timeout=3000)
        except Exception:
            pass

        await page.wait_for_selector("#room_4_13", timeout=5000)

        # 2. Check Faik Sönmez text visibility and style
        faik_txt = page.locator("#room_4_13 text")
        assert await faik_txt.count() > 0, "Faik Sönmez text element not found!"
        faik_text_content = (await faik_txt.text_content()).strip()
        print(f"Faik Sönmez text content: '{faik_text_content}'")
        assert "Faik" in faik_text_content and "S" in faik_text_content, f"Unexpected text: {faik_text_content}"

        faik_style = await faik_txt.evaluate("""el => {
            const cs = window.getComputedStyle(el);
            return {
                display: cs.display,
                visibility: cs.visibility,
                opacity: cs.opacity,
                fill: cs.fill,
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight
            };
        }""")
        print(f"Faik Sönmez computed style: {faik_style}")
        assert faik_style["display"] != "none", "Faik Sönmez text must NOT have display: none!"
        assert faik_style["visibility"] == "visible", "Faik Sönmez text must be visible!"
        assert float(faik_style["opacity"]) >= 0.9, "Faik Sönmez text opacity must be 1!"
        assert "13px" in faik_style["fontSize"] or "12px" in faik_style["fontSize"], f"Expected 12-14px font, got {faik_style['fontSize']}"

        # 3. Check Twist text visibility and style
        twist_txt = page.locator("#room_4_41 text")
        assert await twist_txt.count() > 0, "Twist text element not found!"
        twist_text_content = (await twist_txt.text_content()).strip()
        print(f"Twist text content: '{twist_text_content}'")
        assert "Twist" in twist_text_content, f"Unexpected text: {twist_text_content}"
        twist_style = await twist_txt.evaluate("el => window.getComputedStyle(el).display")
        assert twist_style != "none", "Twist text must NOT have display: none!"

        # 4. Check Anchor stores on Floor 4 (Tommy Hilfiger, Vakko, Marks&Spencer, Beymen Club) have SVG text hidden
        for anchor_id in ["#room_4_39", "#room_4_42", "#room_4_23", "#room_4_3"]:
            txt = page.locator(f"{anchor_id} text")
            if await txt.count() > 0:
                display_val = await txt.evaluate("el => window.getComputedStyle(el).display")
                print(f"Anchor {anchor_id} text display: {display_val}")
                assert display_val == "none", f"Anchor {anchor_id} text should have display: none!"
            # Also verify anchor badge is present
            badge = page.locator(f".logo-tile-marker[data-store-id='{anchor_id.replace('#room_', 'store_')}']")
            assert await badge.count() > 0, f"Anchor badge for {anchor_id} should exist!"

        # 5. Test clicking Faik Sönmez directly on desktop
        print("Clicking Faik Sönmez store...")
        await page.locator("#room_4_13").click()
        await page.wait_for_timeout(400)

        # Verify selected store class and sidebar detail
        poly_classes = await page.locator("#room_4_13").get_attribute("class")
        assert "store-selected" in poly_classes or "store-highlight" in poly_classes, f"Store not highlighted: {poly_classes}"

        sidebar_title = await page.locator("#poi-name").text_content()
        print(f"Sidebar selected store name: '{sidebar_title.strip()}'")
        assert "Faik" in sidebar_title, f"Sidebar should display Faik Sönmez, got '{sidebar_title}'"

        # Screenshot Desktop
        desktop_ss = os.path.join(ARTIFACT_DIR, "screenshot_desktop_faik_sonmez_labels.png")
        await page.screenshot(path=desktop_ss)
        print(f"Saved desktop screenshot: {desktop_ss}")

        # 6. Test Dark Mode
        print("Testing dark mode text fill...")
        await page.evaluate("() => document.documentElement.classList.add('dark')")
        await page.wait_for_timeout(300)
        dark_fill = await faik_txt.evaluate("el => window.getComputedStyle(el).fill")
        print(f"Dark mode Faik Sönmez fill: {dark_fill}")
        assert "241" in dark_fill or "245" in dark_fill or "249" in dark_fill or "255" in dark_fill, f"Dark mode fill should be light slate, got {dark_fill}"

        dark_ss = os.path.join(ARTIFACT_DIR, "screenshot_dark_mode_store_labels.png")
        await page.screenshot(path=dark_ss)
        print(f"Saved dark mode screenshot: {dark_ss}")

        await page.evaluate("() => document.documentElement.classList.remove('dark')")
        await context.close()

        # 7. Mobile Viewport Test (390x844 iPhone 12/13/14)
        m_context = await browser.new_context(viewport={"width": 390, "height": 844})
        m_page = await m_context.new_page()
        m_page.on("console", handle_console)
        m_page.on("pageerror", lambda err: console_errors.append(str(err)))

        await m_page.goto("http://127.0.0.1:3000", wait_until="networkidle")
        try:
            await m_page.wait_for_selector("#splash-screen", state="detached", timeout=3000)
        except Exception:
            pass

        await m_page.wait_for_selector("#room_4_13", timeout=5000)

        # Mobile click on Faik Sönmez text
        print("Clicking Faik Sönmez on mobile...")
        await m_page.locator("#room_4_13 text").click()
        await m_page.wait_for_timeout(400)

        peek_card = m_page.locator("#poi-peek-card")
        assert await peek_card.is_visible(), "Mobile peek card should be visible after clicking Faik Sönmez!"
        peek_title = await m_page.locator("#peek-store-name").text_content()
        print(f"Mobile peek card title: '{peek_title.strip()}'")
        assert "Faik" in peek_title, f"Peek card should show Faik Sönmez, got '{peek_title}'"

        mobile_ss = os.path.join(ARTIFACT_DIR, "screenshot_mobile_faik_sonmez_peek.png")
        await m_page.screenshot(path=mobile_ss)
        print(f"Saved mobile screenshot: {mobile_ss}")

        # 8. Check other floors (Floor 3)
        print("Testing Floor 3 store labels...")
        await m_page.evaluate("() => window.mallMap && window.mallMap.loadFloor(3)")
        await m_page.wait_for_timeout(800)
        await m_page.wait_for_selector("#room_3_28", timeout=5000)

        # LCWaikiki (room_3_28) is anchor -> text hidden
        lcw_txt_display = await m_page.locator("#room_3_28 text").evaluate("el => window.getComputedStyle(el).display")
        print(f"Floor 3 LCWaikiki text display: {lcw_txt_display}")
        assert lcw_txt_display == "none", "LCWaikiki text should be hidden (anchor)"

        # Check standard store on Floor 3, e.g. room_3_1
        fl3_poly = m_page.locator(".store-polygon:not(.is-anchor)").first
        fl3_txt = fl3_poly.locator("text")
        if await fl3_txt.count() > 0:
            fl3_disp = await fl3_txt.evaluate("el => window.getComputedStyle(el).display")
            print(f"Floor 3 standard store text display: {fl3_disp}")
            assert fl3_disp != "none", "Standard store text on floor 3 must be visible!"

        await m_context.close()
        await browser.close()

        # Check console errors
        print(f"Total console errors encountered: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"
        print("ALL TESTS PASSED SUCCESSFULLY with 0 CONSOLE ERRORS!")

if __name__ == "__main__":
    asyncio.run(run())
