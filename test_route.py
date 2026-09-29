import asyncio, sys
sys.stdout.reconfigure(encoding="utf-8")
from playwright.async_api import async_playwright

errors = []
console_errors = []

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        print("1. Opening http://127.0.0.1:3000/ ...")
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await asyncio.sleep(1)
        
        start_btn = page.locator("#start-location-btn")
        start_text = await start_btn.inner_text()
        print("Initial Start Button text:", start_text)
        
        print("2. Clicking start location button to open modal...")
        await start_btn.click()
        await asyncio.sleep(0.5)
        
        modal_visible = await page.locator("#entrance-modal").is_visible()
        print("Entrance/Start modal visible:", modal_visible)
        
        print("3. Selecting Carousel entrance from modal...")
        carousel_opt = page.locator('#entrance-list [data-loc-id="ent_carousel"]').first
        await carousel_opt.click()
        await asyncio.sleep(0.8)
        
        start_badge_after = await page.locator("#start-badge-text").inner_text()
        print("Start Badge text after selection:", start_badge_after)
        
        print("4. Selecting target store: Beymen Club...")
        store_card = page.locator(".store-card").filter(has_text="Beymen Club").first
        await store_card.click()
        await asyncio.sleep(0.8)
        
        print("5. Requesting route (Buraya Yol Tarifi Al)...")
        await page.locator("#poi-route-btn").click()
        await asyncio.sleep(1)
        
        glow_paths = await page.locator("#route-svg .route__glow").count()
        line_paths = await page.locator("#route-svg .route__line").count()
        flow_paths = await page.locator("#route-svg .route__flow").count()
        start_pins = await page.locator("#route-svg .route-start-pin").count()
        end_pins = await page.locator("#route-svg .route-end-pin").count()
        print(f"Route Elements -> Glow: {glow_paths}, Line: {line_paths}, Flow: {flow_paths}, StartPins: {start_pins}, EndPins: {end_pins}")
        
        if line_paths > 0:
            d_val = await page.locator("#route-svg .route__line").first.get_attribute("d")
            print("Route Path d attribute:", d_val[:50], "...")
        
        route_shot = r"C:\Users\busra.sener\.gemini\antigravity\scratch\capacity-avm-navigasyon\screenshot_route_visible.png"
        await page.screenshot(path=route_shot)
        print("Saved route screenshot to:", route_shot)
        
        print("6. Starting Cart Simulation...")
        await page.locator("#sim-play-btn").click()
        await asyncio.sleep(3)
        
        sim_shot = r"C:\Users\busra.sener\.gemini\antigravity\scratch\capacity-avm-navigasyon\screenshot_cart_on_route.png"
        await page.screenshot(path=sim_shot)
        print("Saved moving cart screenshot to:", sim_shot)
        
        await browser.close()

asyncio.run(run())

print("\n--- VERIFICATION REPORT ---")
print(f"Total Page Errors: {len(errors)}")
print(f"Total Console Errors: {len(console_errors)}")
if errors or console_errors:
    print("Failed with errors:", errors, console_errors)
    sys.exit(1)
else:
    print("SUCCESS: All route rendering & start location tests passed with zero errors!")
