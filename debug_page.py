from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Capture console logs
    console_messages = []
    errors = []

    def handle_console(msg):
        console_messages.append({
            'type': msg.type,
            'text': msg.text
        })

    def handle_error(error):
        errors.append(str(error))

    page.on('console', handle_console)
    page.on('pageerror', handle_error)

    # Navigate to the page with domcontentloaded instead of networkidle
    page.goto('http://localhost:5173', wait_until='domcontentloaded')

    # Wait 30 seconds for data to load
    print("Waiting 30 seconds for data to load...")
    page.wait_for_timeout(30000)

    # Take a screenshot
    page.screenshot(path='/tmp/debug_screenshot2.png', full_page=True)

    # Get page content
    content = page.content()

    # Check what's in the #root element
    root_content = page.evaluate('''() => document.getElementById("root").innerHTML''')

    print("=== Console Messages (last 20) ===")
    for msg in console_messages[-20:]:
        print(f"[{msg['type']}] {msg['text']}")

    print("\n=== Errors ===")
    for error in errors:
        print(error)

    print("\n=== Root Content (first 500 chars) ===")
    print(root_content[:500] if root_content else "(empty)")

    browser.close()
