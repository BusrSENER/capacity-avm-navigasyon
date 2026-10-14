import asyncio
import os
import sys
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright

def start_server():
    server = HTTPServer(('127.0.0.1', 8765), SimpleHTTPRequestHandler)
    server.serve_forever()

async def run():
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)

        url = "http://127.0.0.1:8765/index.html"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded")

        # 1. Splash Screen Check
        splash = page.locator("#splash-screen")
        has_splash = await splash.is_visible()
        print(f"Splash screen visible initially: {has_splash}")

        bag_wrapper = page.locator("#splash-bag-wrapper")
        has_bag = await bag_wrapper.count() > 0
        print(f"Splash bag wrapper present: {has_bag}")

        brand_reveal = page.locator("#splash-brand-reveal")
        has_brand = await brand_reveal.count() > 0
        print(f"Splash brand reveal present: {has_brand}")

        bottom_badge = page.locator("#splash-bottom-badge")
        has_badge = await bottom_badge.count() > 0
        print(f"Splash bottom nrdsor badge present: {has_badge}")

        await page.screenshot(path="test_verify_splash.png")

        # Wait for splash to dismiss (3500ms + 800ms)
        print("Waiting for splash screen fade-out...")
        await page.wait_for_timeout(4500)

        # 2. Desktop Layout Check
        sidebar = page.locator("#sidebar-panel")
        sidebar_box = await sidebar.bounding_box()
        print(f"Desktop Sidebar box: {sidebar_box}")

        map_area = page.locator("#main-map-area")
        map_box = await map_area.bounding_box()
        print(f"Main map box: {map_box}")

        floors_bar = page.locator(".floors-pill-bar")
        floors_box = await floors_bar.bounding_box()
        print(f"Floors pill bar box: {floors_box}")

        # Store cards check
        store_cards = page.locator(".store-card")
        await page.wait_for_selector(".store-card", timeout=5000)
        count = await store_cards.count()
        print(f"Total store cards loaded: {count}")
        if count > 0:
            first_logo = page.locator(".store-card__logo").first
            logo_box = await first_logo.bounding_box()
            print(f"First store logo dimensions: {logo_box}")

        # POI Detail and Phone Call button check
        # Click a store card with phone data
        if count > 0:
            await store_cards.first.click()
            await page.wait_for_timeout(300)
            poi_detail = page.locator("#sidebar-poi-detail")
            poi_visible = await poi_detail.is_visible()
            print(f"POI detail visible after click: {poi_visible}")

            call_btn = page.locator("#poi-action-buttons a[href^='tel:']")
            has_call = await call_btn.count() > 0
            if has_call:
                href = await call_btn.first.get_attribute("href")
                print(f"Call button found with href: {href}")
            else:
                print("No call button found on first store card")

        await page.screenshot(path="test_verify_desktop.png")

        # 3. Mobile Viewport Check (390x844)
        print("\nTesting mobile layout (390x844)...")
        mobile_context = await browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        mobile_page = await mobile_context.new_page()
        mobile_page.on("pageerror", lambda err: errors.append(f"Mobile PageError: {err}"))
        mobile_page.on("console", lambda msg: errors.append(f"Mobile ConsoleError: {msg.text}") if msg.type == "error" else None)

        await mobile_page.goto(url, wait_until="domcontentloaded")
        await mobile_page.wait_for_timeout(4500)

        mob_sidebar = mobile_page.locator("#sidebar-panel")
        mob_sidebar_box = await mob_sidebar.bounding_box()
        print(f"Mobile Sidebar box: {mob_sidebar_box}")

        mob_floors = mobile_page.locator(".floors-pill-bar")
        mob_floors_box = await mob_floors.bounding_box()
        print(f"Mobile Floors bar box: {mob_floors_box}")

        await mobile_page.screenshot(path="test_verify_mobile.png")

        await browser.close()

        print(f"\nTotal Console/Page Errors: {len(errors)}")
        for err in errors:
            print(f"  - {err}")

asyncio.run(run())
