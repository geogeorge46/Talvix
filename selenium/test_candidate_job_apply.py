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

class TestCandidateJobApply:
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

    def test_candidate_job_apply(self):
        wait = WebDriverWait(self.driver, 15)

        # 1. Register a new candidate to guarantee fresh, unapplied state
        self.driver.get("http://localhost:5173/register")
        fullname_input = wait.until(EC.presence_of_element_located((By.ID, "register-fullName")))
        fullname_input.clear()
        fullname_input.send_keys("Candidate Selenium Tester")

        unique_email = f"candidate_selenium_{int(time.time())}@example.com"
        email_input = self.driver.find_element(By.ID, "register-email")
        email_input.clear()
        email_input.send_keys(unique_email)

        password_input = self.driver.find_element(By.ID, "register-password")
        password_input.clear()
        password_input.send_keys("TestCandidate@123")

        confirm_password_input = self.driver.find_element(By.ID, "register-confirmPassword")
        confirm_password_input.clear()
        confirm_password_input.send_keys("TestCandidate@123")

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

        # Click Register submit button
        submit_btn = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "button[type='submit']")))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", submit_btn)
        time.sleep(0.5)
        try:
            submit_btn.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", submit_btn)

        # Wait for redirect to candidate dashboard
        wait.until(lambda d: "/candidate" in d.current_url and "/register" not in d.current_url)
        time.sleep(2)

        # 2. Navigate to Jobs search page
        self.driver.get("http://localhost:5173/candidate/jobs")
        time.sleep(2)

        # Wait for job list or job items
        job_links = wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "ul.candidate-job-list li h2 a")
        ))
        assert len(job_links) > 0, "No jobs available to apply for"

        selected_job_title = job_links[0].text.strip()
        selected_job_href = job_links[0].get_attribute("href")
        print(f"Applying for job: '{selected_job_title}' at {selected_job_href}")

        # Navigate to job detail page
        self.driver.get(selected_job_href)
        time.sleep(2)

        # Verify job page loaded
        job_heading = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".candidate-page h1, .candidate-page header")))
        assert job_heading.is_displayed()

        # 3. Check if resume upload is required
        resume_inputs = self.driver.find_elements(By.CSS_SELECTOR, ".od-upload input[type='file'], input[type='file']")
        if resume_inputs:
            resume_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "sample_resume.pdf"))
            assert os.path.exists(resume_file_path), f"Sample resume not found at {resume_file_path}"
            
            resume_input = resume_inputs[0]
            resume_input.send_keys(resume_file_path)
            time.sleep(1)

            # Click Upload button
            upload_buttons = self.driver.find_elements(By.XPATH, "//div[contains(@class, 'od-upload')]//button[contains(., 'Upload')]")
            if upload_buttons:
                self.driver.execute_script("arguments[0].scrollIntoView(true);", upload_buttons[0])
                time.sleep(0.5)
                self.driver.execute_script("arguments[0].click();", upload_buttons[0])
                print("Uploaded resume attachment, waiting for processing...")
                # Wait for upload to complete and button to be enabled
                time.sleep(4)

        # 4. Fill Cover Letter
        cover_letters = self.driver.find_elements(By.CSS_SELECTOR, "textarea")
        if cover_letters:
            self.driver.execute_script("arguments[0].scrollIntoView(true);", cover_letters[0])
            cover_letters[0].clear()
            cover_letters[0].send_keys("I am excited to apply for this job. My skills and experience are a great match for this role.")

        # 5. Click Apply now button
        apply_button = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[@type='submit' and (contains(., 'Apply now') or contains(., 'Apply'))]")
        ))
        self.driver.execute_script("arguments[0].scrollIntoView(true);", apply_button)
        time.sleep(0.5)
        try:
            apply_button.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", apply_button)

        # 6. Confirm application dialog
        confirm_btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Submit application') or contains(., 'Confirm')]")
        ))
        self.driver.execute_script("arguments[0].click();", confirm_btn)
        print("Application confirmation submitted...")

        # 7. Verify submission confirmation on the page
        wait.until(lambda d: (
            "Application submitted" in d.page_source or
            "Already Applied" in d.page_source or
            "Submitted" in d.page_source
        ))
        print("Application successfully recorded on detail page!")
        time.sleep(2)

        # 8. Navigate to candidate applications list to verify it appears in records
        self.driver.get("http://localhost:5173/candidate/applications")
        time.sleep(2)

        # Check that applications list loaded and contains our applied job or item
        applications_list = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "ul.applications-mindease-list, .application-item-card")
        ))
        assert applications_list.is_displayed(), "Applications list should be visible"
        assert selected_job_title.lower() in self.driver.page_source.lower() or "submitted" in self.driver.page_source.lower(), (
            f"Expected '{selected_job_title}' or 'submitted' to appear in candidate applications list"
        )
        print(f"Verified application for '{selected_job_title}' is present in Candidate Applications!")
