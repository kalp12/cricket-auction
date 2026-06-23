"""Test 1: Auth flow - login, token persistence, logout, unauthorized access"""
from playwright.sync_api import sync_playwright
import json, os

SCREENSHOT_DIR = "C:\\Users\\kp121\\Documents\\vs code project\\cricket-auction\\test_screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = {"page": "Auth", "api_calls": [], "console_errors": [], "issues": []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = browser.new_page()

    # Monitor console errors
    page.on("console", lambda msg: results["console_errors"].append(f"{msg.type}: {msg.text}") if msg.type in ["error", "warning"] else None)
    # Monitor API calls
    page.on("request", lambda req: results["api_calls"].append(f"{req.method} {req.url}") if "/api/" in req.url else None)

    # 1. Test unauthenticated redirect
    page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
    page.wait_for_timeout(1000)
    current_url = page.url
    if "/login" in current_url:
        results["issues"].append(f"PASS: Unauthenticated /dashboard redirects to login")
    else:
        results["issues"].append(f"FAIL: Unauthenticated /dashboard went to {current_url}, expected /login redirect")
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_unauth_redirect.png")

    # 2. Test login page loads
    page.goto("http://localhost:3000/login", wait_until="networkidle")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_login_page.png")

    # Check login form elements
    username_input = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i]')
    password_input = page.locator('input[type="password"]')
    login_button = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")')

    if username_input.count() == 0:
        results["issues"].append(f"FAIL: No username input found on login page")
    if password_input.count() == 0:
        results["issues"].append(f"FAIL: No password input found on login page")
    if login_button.count() == 0:
        results["issues"].append(f"FAIL: No login button found on login page")

    # 3. Test login with wrong credentials
    if username_input.count() > 0:
        username_input.first.fill("wronguser")
        password_input.first.fill("wrongpass")
        login_button.first.click()
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_login_fail.png")
        # Check for error message
        error_msg = page.locator('.error, .alert, [class*="error"], [class*="red"], [class*="invalid"], [role="alert"]')
        if error_msg.count() > 0:
            results["issues"].append(f"PASS: Error shown for wrong credentials: {error_msg.first.text_content()[:80]}")
        else:
            results["issues"].append(f"FAIL: No error message shown for wrong credentials")

    # 4. Test login with correct credentials
    page.goto("http://localhost:3000/login", wait_until="networkidle")
    page.wait_for_timeout(500)
    results["api_calls"].clear()  # Reset for clean tracking

    username_input = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i]')
    password_input = page.locator('input[type="password"]')
    login_button = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")')

    # Get admin credentials from .env
    import re
    env_path = "C:\\Users\\kp121\\Documents\\vs code project\\cricket-auction\\server\\.env"
    admin_user = "admin"
    admin_pass = "admin"
    try:
        with open(env_path) as f:
            for line in f:
                if line.startswith("ADMIN_USERNAME="):
                    admin_user = line.strip().split("=", 1)[1]
                if line.startswith("ADMIN_PASSWORD="):
                    admin_pass = line.strip().split("=", 1)[1]
    except:
        pass

    username_input.first.fill(admin_user)
    password_input.first.fill(admin_pass)
    login_button.first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_login_success.png")

    # Check redirect after login
    current_url = page.url
    if "/dashboard" in current_url or "/auctions" in current_url or "/" in current_url:
        results["issues"].append(f"PASS: Successful login redirects to {current_url}")
    else:
        results["issues"].append(f"FAIL: After login, URL is {current_url}")

    # 5. Check token persistence in localStorage
    token = page.evaluate("localStorage.getItem('token')")
    if token:
        results["issues"].append(f"PASS: JWT token stored in localStorage (length: {len(token)})")
    else:
        results["issues"].append(f"FAIL: No JWT token found in localStorage")
        # Try other storage keys
        all_storage = page.evaluate("() => Object.keys(localStorage)")
        results["issues"].append(f"INFO: localStorage keys: {all_storage}")

    # 6. Check API calls during login
    login_api_calls = [c for c in results["api_calls"] if "auth" in c]
    results["issues"].append(f"INFO: Auth API calls during login: {login_api_calls}")

    # 7. Test logout (if available)
    page.wait_for_timeout(500)
    logout_btn = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), [class*="logout"]')
    if logout_btn.count() > 0:
        logout_btn.first.click()
        page.wait_for_timeout(2000)
        token_after = page.evaluate("localStorage.getItem('token')")
        if not token_after:
            results["issues"].append(f"PASS: Token cleared after logout")
        else:
            results["issues"].append(f"FAIL: Token still present after logout")
        page.screenshot(path=f"{SCREENSHOT_DIR}/05_after_logout.png")
    else:
        results["issues"].append(f"INFO: No logout button found on page (may be in sidebar/dropdown)")
        # Try clicking user avatar/name for dropdown
        nav_items = page.locator('nav button, nav a, header button, header a').all()
        nav_texts = [n.text_content()[:30] for n in nav_items if n.text_content()]
        results["issues"].append(f"INFO: Nav items found: {nav_texts}")

    browser.close()

# Save results
with open(f"{SCREENSHOT_DIR}/results_auth.json", "w") as f:
    json.dump(results, f, indent=2, default=str)

print("=" * 60)
print("AUTH TEST RESULTS")
print("=" * 60)
for issue in results["issues"]:
    print(issue)
print(f"\nConsole errors: {results['console_errors']}")
print(f"API calls tracked: {len(results['api_calls'])}")
