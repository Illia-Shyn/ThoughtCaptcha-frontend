// --- Configuration ---
// TODO: Replace with your actual backend API URL (likely from Railway)
const API_BASE_URL = 'https://thoughtcaptcha-backend-production.up.railway.app/api'; // Use http://localhost:8000 for local testing
const SUBMIT_ASSIGNMENT_URL = `${API_BASE_URL}/submit-assignment`;
const GENERATE_QUESTION_URL = `${API_BASE_URL}/generate-question`;
const VERIFY_RESPONSE_URL = `${API_BASE_URL}/verify-response`;
const VERIFICATION_TIMEOUT_SECONDS = 60; // Match the desired timer

// --- Utility Function Definitions (Can stay outside) ---

/**
 * Displays status messages to the user.
 * @param {HTMLElement} element - The status message element.
 * @param {string} message - The message to display.
 * @param {boolean} isError - Whether the message represents an error.
 */
function showStatus(element, message, isError = false) {
    // Ensure the element exists before trying to modify it
    if (element) {
        element.textContent = message;
        element.className = isError ? 'status-message error' : 'status-message success';
        element.style.display = 'block';
    } else {
        console.error("Attempted to show status on a non-existent element.", message);
    }
}

/**
 * Hides a status message element.
 * @param {HTMLElement} element - The status message element to hide.
 */
function hideStatus(element) {
    // Ensure the element exists
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}

// --- Main Execution (waits for DOM) ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded event fired"); // DEBUG

    // --- DOM Elements ---
    const submissionForm = document.getElementById('submission-form');
    const submissionText = document.getElementById('submission-text');
    const submitButton = document.getElementById('submit-button');
    const submissionStatus = document.getElementById('submission-status');
    const verificationModal = document.getElementById('verification-modal');
    const verificationQuestion = document.getElementById('verification-question');
    const verificationResponse = document.getElementById('verification-response');
    const submitVerificationButton = document.getElementById('submit-verification-button');
    const verificationStatus = document.getElementById('verification-status');
    const timerDisplay = document.getElementById('timer');
    const closeModalButton = document.getElementById('close-modal-button');
    console.log("DOM elements selected"); // DEBUG

    // --- State Variables ---
    let currentSubmissionId = null;
    let timerInterval = null;
    let timeLeft = VERIFICATION_TIMEOUT_SECONDS;
    console.log("State variables initialized"); // DEBUG

    // --- Core Function Definitions (Defined *inside* DOMContentLoaded) ---

    async function handleAssignmentSubmit(event) {
        console.log("handleAssignmentSubmit called"); // DEBUG
        event.preventDefault(); // Prevent default form submission
        if (!submitButton || !submissionText || !submissionStatus) {
            console.error("Required elements missing for submission.");
            return;
        }
        submitButton.disabled = true;
        hideStatus(submissionStatus);
        showStatus(submissionStatus, 'Submitting assignment...', false);

        const content = submissionText.value;

        try {
            const response = await fetch(SUBMIT_ASSIGNMENT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ original_content: content }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error during submission.' }));
                throw new Error(`Submission failed: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
            }

            const data = await response.json();
            currentSubmissionId = data.id;
            showStatus(submissionStatus, `Submission successful (ID: ${currentSubmissionId}). Generating verification question...`);

            await triggerQuestionGeneration(currentSubmissionId);

        } catch (error) {
            console.error('Submission error:', error);
            showStatus(submissionStatus, `Error submitting assignment: ${error.message}`, true);
            submitButton.disabled = false; // Re-enable button on error
        }
    }

    async function triggerQuestionGeneration(submissionId) {
        console.log(`triggerQuestionGeneration called with ID: ${submissionId}`); // DEBUG
        try {
            const response = await fetch(GENERATE_QUESTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ submission_id: submissionId }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error generating question.' }));
                throw new Error(`Question generation failed: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
            }

            const data = await response.json();
            showVerificationPopup(data.generated_question);

        } catch (error) {
            console.error('Question generation error:', error);
            showStatus(submissionStatus, `Error generating verification question: ${error.message}. Proceeding without verification.`, true);
            finalizeSubmission(true); // Indicate potential issue
        }
    }

    function showVerificationPopup(question) {
        console.log("showVerificationPopup called with question:", question);
        if (!verificationModal || !verificationQuestion || !verificationResponse || !submitVerificationButton) {
            console.error("Required elements missing for showing verification popup.");
            return;
        }
        hideStatus(submissionStatus);
        hideStatus(verificationStatus);
        verificationQuestion.textContent = question;
        verificationResponse.value = '';
        submitVerificationButton.disabled = false;
        verificationModal.style.display = 'flex';
        verificationResponse.focus();
        startTimer();
    }

    function startTimer() {
        console.log("startTimer called"); // DEBUG
        if (!timerDisplay) {
            console.error("Timer display element not found!");
            return;
        }
        timeLeft = VERIFICATION_TIMEOUT_SECONDS;
        timerDisplay.textContent = timeLeft;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleTimerEnd();
            }
        }, 1000);
    }

    function handleTimerEnd() {
        console.log("handleTimerEnd called"); // DEBUG
        if (!verificationStatus || !submitVerificationButton) {
             console.error("Required elements missing for timer end handling.");
            return;
        }
        showStatus(verificationStatus, 'Time ran out! Submitting response as is.', true);
        submitVerificationButton.disabled = true;
        handleVerificationSubmit();
    }

    async function handleVerificationSubmit() {
        console.log("handleVerificationSubmit called"); // DEBUG
        if (!submitVerificationButton || !verificationResponse || !verificationStatus) {
             console.error("Required elements missing for verification submission.");
            return;
        }
        clearInterval(timerInterval);
        submitVerificationButton.disabled = true;
        showStatus(verificationStatus, 'Submitting verification response...', false);
        const responseText = verificationResponse.value;
        if (currentSubmissionId === null) { // Check explicitly for null
            showStatus(verificationStatus, 'Error: Submission ID is missing.', true);
            submitVerificationButton.disabled = false; // Re-enable
            return;
        }
        try {
            const response = await fetch(VERIFY_RESPONSE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submission_id: currentSubmissionId,
                    student_response: responseText,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error verifying response.' }));
                throw new Error(`Verification submission failed: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
            }
            const data = await response.json();
            showStatus(verificationStatus, data.message || 'Verification successful!');
            setTimeout(() => {
                hideVerificationPopup();
                finalizeSubmission();
            }, 2000);
        } catch (error) {
            console.error('Verification submission error:', error);
            showStatus(verificationStatus, `Error submitting verification: ${error.message}`, true);
            submitVerificationButton.disabled = false; // Re-enable button on error
            setTimeout(() => {
                hideVerificationPopup();
                finalizeSubmission(true);
            }, 3000);
        }
    }

    function finalizeSubmission(hadIssue = false) {
        console.log(`finalizeSubmission called (hadIssue: ${hadIssue})`); // DEBUG
        if (!submissionStatus || !submissionText || !submitButton) {
            console.error("Required elements missing for finalizing submission.");
            return;
        }
        if (hadIssue) {
             showStatus(submissionStatus, 'Assignment submitted, but there was an issue during verification. Please contact support if needed.', true);
        } else {
            showStatus(submissionStatus, 'Assignment and verification submitted successfully!');
        }
        submissionText.value = '';
        submitButton.disabled = false;
        currentSubmissionId = null;
    }

    function hideVerificationPopup() {
        console.log("hideVerificationPopup called"); // DEBUG
        clearInterval(timerInterval); // This should now work as timerInterval is in the same scope
        if (verificationModal) {
            verificationModal.style.display = 'none';
        } else {
            console.error("Cannot hide modal, verificationModal not found!");
        }
    }

    // --- Event Listeners ---
    console.log("Adding event listeners..."); // DEBUG
    // Add checks to ensure elements exist before adding listeners
    if (submissionForm) {
        submissionForm.addEventListener('submit', handleAssignmentSubmit);
    } else {
        console.error("Submission form not found! Cannot add listener.");
    }
    if (submitVerificationButton) {
        submitVerificationButton.addEventListener('click', handleVerificationSubmit);
    } else {
        console.error("Submit verification button not found! Cannot add listener.");
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideVerificationPopup);
    } else {
        console.error("Close modal button not found! Cannot add listener.");
    }
    console.log("Event listeners added."); // DEBUG

    // --- Initial Setup ---
    console.log("ThoughtCaptcha frontend initialized. DOM ready."); // DEBUG
    if (verificationModal) {
        verificationModal.style.display = 'none';
        console.log("Modal display style after final check:", window.getComputedStyle(verificationModal).display);
    } else {
        console.error("Verification modal element not found at end of init!");
    }

}); // End of DOMContentLoaded listener

console.log("Script file loaded (waiting for DOMContentLoaded)..."); // DEBUG 