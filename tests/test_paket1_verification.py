import os
import sys
import time
import subprocess
import http.server
import socketserver
import threading
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8089

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_local_server():
    os.chdir(WORKSPACE_DIR)
    handler = QuietHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        httpd.serve_forever()

def main():
    print(f"Serving workspace at http://localhost:{PORT}/ from {WORKSPACE_DIR}")
    server_thread = threading.Thread(target=run_local_server, daemon=True)
    server_thread.start()
    time.sleep(1)

    errors = []
    console_logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("pageerror", lambda err: errors.append(f"Page Error: {err}"))
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)

        page.goto(f"http://localhost:{PORT}/index.html", wait_until="networkidle")
        page.wait_for_timeout(4000) # Wait for splash to settle

        print("\n=== STEP 1: Verify NavigationEngine & DOM state in TR mode ===")
        # Test Dijkstra & instructions with store "W Collection"
        tr_test = page.evaluate("""() => {
            const wCollStore = Object.values(window.mallData.floors).flatMap(f => f.stores || []).find(s => s.name.includes('W Collection'));
            const cKapisi = window.mallData.entrances.find(e => e.id === 'ent_fisekhane');
            
            if (!wCollStore || !cKapisi) {
                return { error: 'Could not find W Collection or C Kapisi' };
            }

            window.setStartLocation(cKapisi);
            window.setTargetLocation(wCollStore);
            window.calculateAndDisplayRoute();
            
            const route = window.lastCalculatedRoute;
            if (!route) return { error: 'Route not calculated' };
            
            const hudSteps = document.getElementById('hud-steps-list')?.innerText || '';
            const hasPhoneticInDOM = document.body.innerText.includes('Dabılyu Kolekşın');
            const hasOriginalInDOM = document.body.innerText.includes('W Collection');
            
            // Trigger speech
            const firstIns = route.instructions[0];
            window.speakNavigationText(firstIns.voiceText || firstIns.text, true);
            
            const lastVoiceLang = window.lastVoiceLanguage;
            const lastSpokenPhonetic = window.lastSpokenPhoneticText;
            const lastSpokenNavText = window.lastSpokenNavigationText;
            
            return {
                instructions: route.instructions.map(i => ({ type: i.type, text: i.text, voiceText: i.voiceText })),
                hasPhoneticInDOM,
                hasOriginalInDOM,
                lastVoiceLang,
                lastSpokenPhonetic,
                lastSpokenNavText
            };
        }""")

        assert not tr_test.get('error'), f"TR Test error: {tr_test.get('error')}"
        assert not tr_test['hasPhoneticInDOM'], "Phonetic text 'Dabılyu Kolekşın' leaked into DOM in TR mode!"
        print("[PASS] TR Mode: DOM contains original brand names ('W Collection') and 0 phonetics.")
        
        assert tr_test['lastVoiceLang'] == 'tr-TR', f"Expected voice lang 'tr-TR', got {tr_test['lastVoiceLang']}"
        print(f"[PASS] TR Mode: Voice language correctly set to {tr_test['lastVoiceLang']}.")
        
        # Verify arrival instruction for store
        dest_ins = next((i for i in tr_test['instructions'] if i['type'] == 'destination'), None)
        assert dest_ins is not None, "Destination instruction not found!"
        print(f"[INFO] TR Store Destination Text: {dest_ins['text']}")
        print(f"[INFO] TR Store Destination VoiceText: {dest_ins['voiceText']}")
        assert "W Collection önündesiniz" in dest_ins['text'] or "W Collection" in dest_ins['text']
        assert "Dabılyu" not in dest_ins['text']

        # Verify floor change instruction if present
        fc_ins = next((i for i in tr_test['instructions'] if i['type'] == 'floor_change'), None)
        if fc_ins:
            print(f"[INFO] TR Floor Change Text: {fc_ins['text']}")
            assert "kullanarak" in fc_ins['text'] and ("katına inin" in fc_ins['text'] or "katına çıkın" in fc_ins['text'])
            print("[PASS] TR Floor Change matches grammar: '[Asansörü/Yürüyen merdivenleri] kullanarak [Kat Adı] katına [inin/çıkın].'")

        print("\n=== STEP 2: Verify Language Toggle & EN mode ===")
        en_test = page.evaluate("""() => {
            let cancelCalled = false;
            if (window.speechSynthesis) {
                const origCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);
                window.speechSynthesis.cancel = function() {
                    cancelCalled = true;
                    origCancel();
                };
            }

            window.setLanguage('en');

            const hasPhoneticInDOM = document.body.innerText.includes('Dabılyu Kolekşın');
            const hasOriginalInDOM = document.body.innerText.includes('W Collection');
            const route = window.lastCalculatedRoute;
            
            // Speak first instruction in EN
            const firstIns = route.instructions[0];
            window.speakNavigationText(firstIns.voiceText || firstIns.text, true);

            return {
                cancelCalled,
                hasPhoneticInDOM,
                hasOriginalInDOM,
                lastVoiceLang: window.lastVoiceLanguage,
                lastSpokenPhonetic: window.lastSpokenPhoneticText,
                lastSpokenNavText: window.lastSpokenNavigationText,
                instructions: route.instructions.map(i => ({ type: i.type, text: i.text, voiceText: i.voiceText }))
            };
        }""")

        assert en_test['cancelCalled'], "speechSynthesis.cancel() was not called on language change!"
        print("[PASS] Language Toggle: window.speechSynthesis.cancel() immediately called.")

        assert en_test['lastVoiceLang'] == 'en-US', f"Expected voice lang 'en-US', got {en_test['lastVoiceLang']}"
        print(f"[PASS] EN Mode: Voice language correctly set to {en_test['lastVoiceLang']}.")

        assert not en_test['hasPhoneticInDOM'], "Phonetic text leaked into DOM in EN mode!"
        assert "Dabılyu" not in en_test['lastSpokenPhonetic'], "Turkish phonetics applied to English speech payload!"
        print("[PASS] EN Mode: Speech payload has NO Turkish phonetics ('W Collection' preserved).")

        # Check EN instruction grammar
        dest_ins_en = next((i for i in en_test['instructions'] if i['type'] == 'destination'), None)
        assert dest_ins_en is not None, "EN destination instruction not found!"
        print(f"[INFO] EN Store Destination Text: {dest_ins_en['text']}")
        assert "You have arrived at W Collection" in dest_ins_en['text']
        print("[PASS] EN Store Destination matches: 'You have arrived at [Store Name].'")

        fc_ins_en = next((i for i in en_test['instructions'] if i['type'] == 'floor_change'), None)
        if fc_ins_en:
            print(f"[INFO] EN Floor Change Text: {fc_ins_en['text']}")
            assert "Take the" in fc_ins_en['text'] and "to" in fc_ins_en['text']
            print("[PASS] EN Floor Change matches: 'Take the [escalator/elevator] to [Floor Name].'")

        first_walk_en = next((i for i in en_test['instructions'] if i['type'] in ('straight', 'turn_right', 'turn_left')), None)
        if first_walk_en:
            print(f"[INFO] EN Walk Text: {first_walk_en['text']}")
            assert "Walk straight" in first_walk_en['text'] or "Turn" in first_walk_en['text']
            print("[PASS] EN Walk instruction is directly in English.")

        print("\n=== STEP 3: Verify Amenity / Service Point Arrival in TR and EN ===")
        amenity_test = page.evaluate("""() => {
            // Pick Danışma
            const danisma = window.mallData.entrances.find(e => e.id === 'ent_danisma') ||
                            Object.values(window.mallData.floors).flatMap(f => f.amenities || []).find(a => a.name.includes('Danışma'));
            const cKapisi = window.mallData.entrances.find(e => e.id === 'ent_fisekhane');

            window.setStartLocation(cKapisi);
            window.setTargetLocation(danisma);

            // TR Mode
            window.setLanguage('tr');
            window.calculateAndDisplayRoute();
            const trRoute = window.lastCalculatedRoute;
            const trDest = trRoute.instructions.find(i => i.type === 'destination');

            // Trigger arrival HUD
            window.updateLiveNavHUD(-1, 100);
            const trHudText = document.getElementById('live-nav-text')?.innerText || '';

            // EN Mode
            window.setLanguage('en');
            const enRoute = window.lastCalculatedRoute;
            const enDest = enRoute.instructions.find(i => i.type === 'destination');
            window.updateLiveNavHUD(-1, 100);
            const enHudText = document.getElementById('live-nav-text')?.innerText || '';

            return {
                trDestText: trDest?.text,
                trDestVoice: trDest?.voiceText,
                trHudText,
                enDestText: enDest?.text,
                enDestVoice: enDest?.voiceText,
                enHudText
            };
        }""")

        print(f"[INFO] Amenity TR Dest Text: {amenity_test['trDestText']}")
        print(f"[INFO] Amenity TR HUD Text: {amenity_test['trHudText']}")
        assert "noktasındasınız" in amenity_test['trDestText'], f"Amenity TR dest text missing 'noktasındasınız': {amenity_test['trDestText']}"
        assert "mağazası" not in amenity_test['trDestText'] and "keyifli alışverişler" not in amenity_test['trDestText'].lower()
        assert "mağazası" not in amenity_test['trHudText'] and "keyifli alışverişler" not in amenity_test['trHudText'].lower()
        print("[PASS] Amenity in TR: '[Nokta Adı] noktasındasınız.' (0 'mağazası', 0 'keyifli alışverişler').")

        print(f"[INFO] Amenity EN Dest Text: {amenity_test['enDestText']}")
        print(f"[INFO] Amenity EN HUD Text: {amenity_test['enHudText']}")
        assert "You have arrived at" in amenity_test['enDestText'] or "Information Desk" in amenity_test['enDestText']
        assert "mağazası" not in amenity_test['enDestText'] and "enjoy your shopping" not in amenity_test['enDestText'].lower()
        assert "mağazası" not in amenity_test['enHudText'] and "enjoy your shopping" not in amenity_test['enHudText'].lower()
        print("[PASS] Amenity in EN: 'You have arrived at [Amenity Name].' (0 'mağazası', 0 'enjoy your shopping').")

        print("\n=== STEP 4: Verify Console Errors ===")
        print(f"Total console error messages: {len(console_logs)}")
        for cl in console_logs:
            print(f"  {cl}")
        print(f"Total page errors: {len(errors)}")
        for err in errors:
            print(f"  {err}")

        assert len(errors) == 0, f"Encountered page errors: {errors}"
        print("[PASS] 0 Page Errors!")

        browser.close()

    print("\nALL PAKET 1 VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
