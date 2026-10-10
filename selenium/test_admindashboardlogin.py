import os
import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions

class TestAdmindashboardlogin:
    def setup_method(self, method):
        headless = os.environ.get("SELENIUM_HEADLESS", "true").lower() in ("true", "1", "yes")

        driver = None
        try:
            options = ChromeOptions()
            if headless:
                options.add_argument("--headless=new")
            options.add_argument("--window-size=1440,900")
            options.add_argument("--disable-gpu")
            options.add_argument("--no-sandbox")
            driver = webdriver.Chrome(options=options)
        except Exception:
            pass

        if not driver:
            try:
                options = EdgeOptions()
                if headless:
                    options.add_argument("--headless=new")
                options.add_argument("--window-size=1440,900")
                driver = webdriver.Edge(options=options)
            except Exception:
                pass

        if not driver:
            try:
                options = FirefoxOptions()
                if headless:
                    options.add_argument("-headless")
                driver = webdriver.Firefox(options=options)
            except Exception as e:
                pytest.fail(f"Could not initialize any browser driver: {e}")

        self.driver = driver

    def teardown_method(self, method):
        if hasattr(self, "driver") and self.driver:
            self.driver.quit()

    def test_admindashboardlogin(self):
        wait = WebDriverWait(self.driver, 15)

        # 1. Navigate to login page
        self.driver.get("http://localhost:5173/login")

        # 2. Enter admin credentials
        email_input = wait.until(EC.presence_of_element_located((By.ID, "login-email")))
        email_input.clear()
        email_input.send_keys("admin@talvix.local")

        password_input = self.driver.find_element(By.ID, "login-password")
        password_input.clear()
        password_input.send_keys("Admin@12345")

        # 3. Submit login form
        submit_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", submit_btn)
        time.sleep(0.5)

        try:
            submit_btn.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", submit_btn)

        # 4. Wait for redirect to admin workspace
        wait.until(EC.url_contains("/admin"))
        assert "/admin" in self.driver.current_url, f"Expected '/admin' in URL, got {self.driver.current_url}"

        # 5. Verify admin overview / command center elements
        dashboard = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".sys-page, main")))
        assert dashboard is not None

        # Confirm admin command center text or KPI grid is visible
        page_text = self.driver.page_source
        assert any(
            phrase in page_text
            for phrase in ["Platform Command Center", "System Governance", "Key Performance Indicators", "Total Users"]
        ), "Admin dashboard content not found on page"
