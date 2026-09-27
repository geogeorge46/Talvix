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

class TestLogin:
    def setup_method(self, method):
        headless = os.environ.get("SELENIUM_HEADLESS", "true").lower() in ("true", "1", "yes")

        driver = None
        try:
            options = ChromeOptions()
            if headless:
                options.add_argument("--headless=new")
            options.add_argument("--window-size=1280,1024")
            driver = webdriver.Chrome(options=options)
        except Exception:
            pass

        if not driver:
            try:
                options = EdgeOptions()
                if headless:
                    options.add_argument("--headless=new")
                options.add_argument("--window-size=1280,1024")
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

    def test_login_invalid_credentials(self):
        self.driver.get("http://localhost:5173/login")
        wait = WebDriverWait(self.driver, 10)

        email_input = wait.until(EC.presence_of_element_located((By.ID, "login-email")))
        email_input.clear()
        email_input.send_keys("nonexistent_user_9999@example.com")

        password_input = self.driver.find_element(By.ID, "login-password")
        password_input.clear()
        password_input.send_keys("WrongPassword@123")

        submit_btn = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "button[type='submit']")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", submit_btn)
        time.sleep(0.5)

        try:
            submit_btn.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", submit_btn)

        time.sleep(2)
        # Check that error alert or page is still on login page
        assert "login" in self.driver.current_url
