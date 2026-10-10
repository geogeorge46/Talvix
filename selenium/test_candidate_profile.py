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

class TestCandidateProfile:
    def setup_method(self, method):
        headless = os.environ.get("SELENIUM_HEADLESS", "true").lower() in ("true", "1", "yes")

        driver = None
        # 1. Try Chrome
        try:
            options = ChromeOptions()
            if headless:
                options.add_argument("--headless=new")
            options.add_argument("--window-size=1280,1024")
            driver = webdriver.Chrome(options=options)
        except Exception:
            pass

        # 2. Try Edge
        if not driver:
            try:
                options = EdgeOptions()
                if headless:
                    options.add_argument("--headless=new")
                options.add_argument("--window-size=1280,1024")
                driver = webdriver.Edge(options=options)
            except Exception:
                pass

        # 3. Try Firefox
        if not driver:
            try:
                options = FirefoxOptions()
                if headless:
                    options.add_argument("-headless")
                driver = webdriver.Firefox(options=options)
            except Exception as e:
                pytest.fail(f"Could not initialize any browser driver (Chrome, Edge, Firefox): {e}")

        self.driver = driver

    def teardown_method(self, method):
        if hasattr(self, "driver") and self.driver:
            self.driver.quit()

    def test_candidate_profile_update(self):
        wait = WebDriverWait(self.driver, 15)

        # 1. Register a new candidate to guarantee fresh, isolated state
        self.driver.get("http://localhost:5173/register")
        fullname_input = wait.until(EC.presence_of_element_located((By.ID, "register-fullName")))
        fullname_input.clear()
        candidate_name = "Alex Rivera"
        fullname_input.send_keys(candidate_name)

        unique_email = f"candidate_prof_{int(time.time())}@example.com"
        email_input = self.driver.find_element(By.ID, "register-email")
        email_input.clear()
        email_input.send_keys(unique_email)

        password_input = self.driver.find_element(By.ID, "register-password")
        password_input.clear()
        password_input.send_keys("TestProfile@123")

        confirm_password_input = self.driver.find_element(By.ID, "register-confirmPassword")
        confirm_password_input.clear()
        confirm_password_input.send_keys("TestProfile@123")

        # Agree to Terms
        try:
            terms_checkbox = self.driver.find_element(By.CSS_SELECTOR, "input[name='agreeTerms']")
            if not terms_checkbox.is_selected():
                self.driver.execute_script("arguments[0].click();", terms_checkbox)
        except Exception:
            try:
                label = self.driver.find_element(By.CSS_SELECTOR, "label.tvx-choice")
                self.driver.execute_script("arguments[0].click();", label)
            except Exception:
                pass

        # Submit registration
        submit_btn = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "button[type='submit']")))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", submit_btn)
        time.sleep(0.5)
        self.driver.execute_script("arguments[0].click();", submit_btn)

        # Wait for redirect to candidate area
        wait.until(lambda d: "/candidate" in d.current_url and "/register" not in d.current_url)
        time.sleep(2)

        # 2. Navigate to Candidate Profile page
        self.driver.get("http://localhost:5173/candidate/profile")
        time.sleep(2)

        # Verify profile banner loaded with candidate name
        profile_name = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".profile-candidate-name")))
        assert candidate_name in profile_name.text, f"Expected {candidate_name} in profile header, got {profile_name.text}"

        # 3. Switch to 'Personal Info' tab
        personal_tab = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//button[contains(@class, 'profile-tab-pill') and contains(., 'Personal Info')]")
        ))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", personal_tab)
        time.sleep(0.5)
        self.driver.execute_script("arguments[0].click();", personal_tab)
        time.sleep(1)

        # 4. Fill in Personal Info fields
        new_headline = "Lead Full-Stack Developer | Python & React Specialist"
        new_bio = "Experienced engineer specializing in high-performance web systems and developer tooling."
        new_phone = "+919876543210"
        new_city = "Bengaluru"
        new_state = "Karnataka"
        new_country = "India"

        headline_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='headline']")))
        headline_input.clear()
        headline_input.send_keys(new_headline)

        bio_input = self.driver.find_element(By.CSS_SELECTOR, "textarea[name='bio']")
        bio_input.clear()
        bio_input.send_keys(new_bio)

        phone_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='phone']")
        phone_input.clear()
        phone_input.send_keys(new_phone)

        city_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='city']")
        city_input.clear()
        city_input.send_keys(new_city)

        state_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='state']")
        state_input.clear()
        state_input.send_keys(new_state)

        country_input = self.driver.find_element(By.CSS_SELECTOR, "input[name='country']")
        country_input.clear()
        country_input.send_keys(new_country)

        # Submit Personal Info form
        form = self.driver.find_element(By.ID, "profile-form-personal")
        self.driver.execute_script("arguments[0].requestSubmit();", form)
        print("Submitted Personal Info update...")
        time.sleep(3)

        # 5. Switch back to 'Overview' tab and verify updated fields reflect on the dashboard
        overview_tab = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//button[contains(@class, 'profile-tab-pill') and contains(., 'Overview')]")
        ))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", overview_tab)
        time.sleep(0.5)
        self.driver.execute_script("arguments[0].click();", overview_tab)
        time.sleep(2)

        card = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".section-card-mindease")))
        wait.until(lambda d: new_headline in card.text)
        assert new_headline in card.text, f"Expected '{new_headline}' to be displayed in overview"
        assert new_city in self.driver.page_source, f"Expected city '{new_city}' to be displayed in overview"
        assert new_country in self.driver.page_source, f"Expected country '{new_country}' to be displayed in overview"
        print("Verified Personal Info successfully reflected in Overview tab!")

        # 6. Switch to 'Skills & Portfolio' tab and add a new skill
        skills_tab = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(@class, 'profile-tab-pill') and contains(., 'Skills & Portfolio')]")
        ))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", skills_tab)
        time.sleep(0.5)
        self.driver.execute_script("arguments[0].click();", skills_tab)
        time.sleep(1)

        # Click 'Add skills'
        add_skill_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Add skills')]")
        ))
        self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", add_skill_btn)
        time.sleep(0.5)
        self.driver.execute_script("arguments[0].click();", add_skill_btn)
        time.sleep(1)

        # Fill skill form
        skill_name_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "form.candidate-editor input[name='name']")))
        skill_name_input.clear()
        skill_name_input.send_keys("TypeScript")

        experience_years_input = self.driver.find_element(By.CSS_SELECTOR, "form.candidate-editor input[name='yearsOfExperience']")
        experience_years_input.clear()
        experience_years_input.send_keys("5")

        # Submit 'Add entry'
        skill_form = self.driver.find_element(By.CSS_SELECTOR, "form.candidate-editor")
        self.driver.execute_script("arguments[0].requestSubmit();", skill_form)
        print("Submitted new skill entry...")
        time.sleep(3)

        # Verify newly added skill is listed in candidate collections
        wait.until(lambda d: "TypeScript" in d.page_source)
        assert "TypeScript" in self.driver.page_source, "Expected 'TypeScript' skill to appear in candidate skills collection"
        print("Verified skill 'TypeScript' is added to collection!")

        # 7. Navigate away to Candidate Dashboard and return to Profile to verify state persistence
        self.driver.get("http://localhost:5173/candidate")
        time.sleep(1)
        wait.until(lambda d: "/candidate" in d.current_url)

        self.driver.get("http://localhost:5173/candidate/profile")
        time.sleep(2)

        card = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".section-card-mindease")))
        wait.until(lambda d: new_headline in card.text)
        assert candidate_name in self.driver.page_source, "Candidate name must persist"
        assert new_headline in card.text, "Candidate headline must persist"
        assert new_city in self.driver.page_source, "Candidate location must persist"
        assert "TypeScript" in self.driver.page_source, "Candidate skills must persist"

        print("Successfully verified candidate profile update & persistence!")
