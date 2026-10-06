import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:3000"
ARTIFACT_DIR = r"C:\Users\busra.sener\.gemini\antigravity\brain\0bc22bcb-eb9a-4b82-83e6-4140b1da011c"

def test_branding_desktop_and_assets():
    print("\n--- TEST 1: DESKTOP BRANDING & ASSET INTEGRITY ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        network_404s = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))
        page.on("response", lambda resp: network_404s.append(resp.url) if resp.status == 404 else None)

        # 1. Load Homepage
        page.goto(f"{BASE_URL}/index.html", wait_until="networkidle")
        page.wait_for_timeout(1500)

        # Check Favicon and Title
        title = page.title()
        print(f"Page Title: {title}")
        assert "nrdsor" in title, f"Expected 'nrdsor' in title, got: {title}"

        favicon_svg = page.locator('link[rel="icon"][type="image/svg+xml"]').get_attribute("href")
        favicon_png = page.locator('link[rel="icon"][type="image/png"]').get_attribute("href")
        apple_icon = page.locator('link[rel="apple-touch-icon"]').get_attribute("href")
        assert favicon_svg == "public/favicon.svg"
        assert favicon_png == "public/favicon.png"
        assert apple_icon == "public/apple-touch-icon.png"
        print("✓ Favicon, PWA & Apple Touch Icon tags verified")

        # Check Header Brand Logo
        header_logo_light = page.locator("#header-brand-logo-light")
        assert header_logo_light.is_visible(), "Header light logo should be visible in light mode"
        nat_w = header_logo_light.evaluate("img => img.naturalWidth")
        nat_h = header_logo_light.evaluate("img => img.naturalHeight")
        print(f"Header Logo Dimensions (Light): {nat_w}x{nat_h}")
        assert nat_w > 0 and nat_h > 0, f"Header logo broken: {nat_w}x{nat_h}"

        # Capture Desktop initial screenshot
        scr_desktop = os.path.join(ARTIFACT_DIR, "screenshot_nrdsor_desktop_initial.png")
        page.screenshot(path=scr_desktop)
        print(f"✓ Desktop initial screenshot saved: {scr_desktop}")

        # 2. Test Dark Mode Branding
        page.evaluate("document.documentElement.classList.add('dark')")
        page.wait_for_timeout(400)
        header_logo_dark = page.locator("#header-brand-logo-dark")
        assert header_logo_dark.is_visible(), "Header dark logo should be visible in dark mode"
        nat_w_dark = header_logo_dark.evaluate("img => img.naturalWidth")
        assert nat_w_dark > 0, f"Header dark logo broken: {nat_w_dark}"
        print(f"Header Logo Dimensions (Dark): {nat_w_dark}")

        scr_dark = os.path.join(ARTIFACT_DIR, "screenshot_nrdsor_desktop_dark.png")
        page.screenshot(path=scr_dark)
        print(f"✓ Dark mode screenshot saved: {scr_dark}")
        page.evaluate("document.documentElement.classList.remove('dark')")
        page.wait_for_timeout(200)

        # 3. Test QR Modal with nrdsor Branding
        page.evaluate("""() => {
            const store = getAllStores()[0];
            setTargetLocation(store);
            openRouteQrModal();
        }""")
        page.wait_for_timeout(600)
        qr_modal = page.locator("#route-qr-modal")
        assert qr_modal.is_visible(), "QR modal should be visible"

        qr_logo = page.locator("#qr-modal-brand-logo-light")
        assert qr_logo.is_visible(), "QR modal brand logo should be visible"
        qr_nat_w = qr_logo.evaluate("img => img.naturalWidth")
        assert qr_nat_w > 0, "QR modal logo broken"
        print(f"QR Modal Logo Dimensions: {qr_nat_w}")

        scr_qr = os.path.join(ARTIFACT_DIR, "screenshot_nrdsor_qr_modal.png")
        page.screenshot(path=scr_qr)
        print(f"✓ QR modal screenshot saved: {scr_qr}")

        # Close QR modal
        page.locator("#btn-qr-modal-close").click()
        page.wait_for_timeout(300)

        # 4. Assert zero 404s and console errors
        print(f"Network 404 count: {len(network_404s)}")
        print(f"Console error count: {len(console_errors)}")
        assert len(network_404s) == 0, f"Found 404 network responses: {network_404s}"
        assert len(console_errors) == 0, f"Found console errors: {console_errors}"
        browser.close()
        print("✓ TEST 1 PASSED!")

def test_kiosk_mode_branding():
    print("\n--- TEST 2: KIOSK MODE (?kiosk=true) BRANDING ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_errors = []
        network_404s = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))
        page.on("response", lambda resp: network_404s.append(resp.url) if resp.status == 404 else None)

        # Open in Kiosk mode
        page.goto(f"{BASE_URL}/index.html?kiosk=true", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Kiosk badges must be visible
        kiosk_map_badge = page.locator("#kiosk-brand-badge")
        assert kiosk_map_badge.is_visible(), "Kiosk map badge should be visible in kiosk mode"
        print("✓ Kiosk map badge is visible")

        kiosk_sidebar_banner = page.locator("#kiosk-sidebar-banner")
        assert kiosk_sidebar_banner.is_visible(), "Kiosk sidebar banner should be visible"
        print("✓ Kiosk sidebar banner is visible")

        # Start input should be locked to Danisma
        start_val = page.locator("#input-start-loc").input_value()
        print(f"Kiosk start location value: {start_val}")
        assert "Danışma" in start_val or "Danisma" in start_val, f"Expected Danisma in start location: {start_val}"

        scr_kiosk = os.path.join(ARTIFACT_DIR, "screenshot_nrdsor_kiosk_mode.png")
        page.screenshot(path=scr_kiosk)
        print(f"✓ Kiosk mode screenshot saved: {scr_kiosk}")

        assert len(network_404s) == 0, f"Found 404 responses in kiosk mode: {network_404s}"
        assert len(console_errors) == 0, f"Found console errors in kiosk mode: {console_errors}"
        browser.close()
        print("✓ TEST 2 PASSED!")

def test_mobile_branding_responsive():
    print("\n--- TEST 3: MOBILE (PORTRAIT) RESPONSIVE BRANDING ---")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}) # iPhone 12/13/14
        page = context.new_page()

        console_errors = []
        network_404s = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))
        page.on("response", lambda resp: network_404s.append(resp.url) if resp.status == 404 else None)

        page.goto(f"{BASE_URL}/index.html", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # In mobile peek mode, expand bottom sheet to see branding
        page.locator("#btn-sheet-toggle").click()
        page.wait_for_timeout(600)

        header_logo = page.locator("#header-brand-logo-light")
        assert header_logo.is_visible(), "Header logo should be visible in expanded sheet"
        box = header_logo.bounding_box()
        print(f"Mobile Header Logo Bounding Box: {box}")
        assert box is not None and box["width"] > 0 and box["height"] > 0
        assert box["width"] <= 150, f"Logo too wide for mobile header: {box['width']}"

        scr_mobile = os.path.join(ARTIFACT_DIR, "screenshot_nrdsor_mobile_expanded.png")
        page.screenshot(path=scr_mobile)
        print(f"✓ Mobile expanded screenshot saved: {scr_mobile}")

        assert len(network_404s) == 0, f"Found 404 responses in mobile mode: {network_404s}"
        assert len(console_errors) == 0, f"Found console errors in mobile mode: {console_errors}"
        browser.close()
        print("✓ TEST 3 PASSED!")

if __name__ == "__main__":
    test_branding_desktop_and_assets()
    test_kiosk_mode_branding()
    test_mobile_branding_responsive()
    print("\n==========================================")
    print(" ALL 3 NRDSOR BRANDING TESTS PASSED (0 ERRORS, 0 404s)!")
    print("==========================================")
