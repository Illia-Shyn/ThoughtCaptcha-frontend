// --- Configuration ---
// TODO: Replace with your actual backend API URL (likely from Railway)
const API_BASE_URL = 'https://thoughtcaptcha-backend-production.up.railway.app/api'; // Use http://localhost:8000 for local testing
const SUBMIT_ASSIGNMENT_URL = `${API_BASE_URL}/submit-assignment`;
const GENERATE_QUESTION_URL = `${API_BASE_URL}/generate-question`;
const VERIFY_RESPONSE_URL = `${API_BASE_URL}/verify-response`;
const VERIFICATION_TIMEOUT_SECONDS = 60; // Match the desired timer

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

// --- State Variables ---
let currentSubmissionId = null;
let timerInterval = null;
let timeLeft = VERIFICATION_TIMEOUT_SECONDS;
console.log("State variables initialized");

// --- Functions ---

/**
 * Displays status messages to the user.
 * @param {HTMLElement} element - The status message element.
 * @param {string} message - The message to display.
 * @param {boolean} isError - Whether the message represents an error.
 */
function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'status-message error' : 'status-message success';
    element.style.display = 'block';
}

/**
 * Hides a status message element.
 * @param {HTMLElement} element - The status message element to hide.
 */
function hideStatus(element) {
    element.textContent = '';
    element.style.display = 'none';
}

/**
 * Handles the initial assignment submission.
 * @param {Event} event - The form submission event.
 */
async function handleAssignmentSubmit(event) {
    console.log("handleAssignmentSubmit called");
    event.preventDefault(); // Prevent default form submission
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

        // Immediately try to generate the verification question
        await triggerQuestionGeneration(currentSubmissionId);

    } catch (error) {
        console.error('Submission error:', error);
        showStatus(submissionStatus, `Error submitting assignment: ${error.message}`, true);
        submitButton.disabled = false; // Re-enable button on error
    }
}

/**
 * Calls the backend to generate the follow-up question.
 * @param {number} submissionId - The ID of the submission.
 */
async function triggerQuestionGeneration(submissionId) {
    console.log(`triggerQuestionGeneration called with ID: ${submissionId}`);
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
        // Decide how to handle failure: maybe allow submission without verification?
        showStatus(submissionStatus, `Error generating verification question: ${error.message}. Proceeding without verification.`, true);
        // Optionally, finalize the submission process here if verification fails critically
        finalizeSubmission(true); // Indicate potential issue
    }
}

/**
 * Displays the verification modal with the question and starts the timer.
 * @param {string} question - The question to display.
 */
function showVerificationPopup(question) {
    console.log("showVerificationPopup called with question:", question);
    hideStatus(submissionStatus);
    hideStatus(verificationStatus);
    verificationQuestion.textContent = question;
    verificationResponse.value = ''; // Clear previous response
    submitVerificationButton.disabled = false;
    verificationModal.hidden = false;
    verificationResponse.focus();
    startTimer();
}

/**
 * Starts the countdown timer for the verification response.
 */
function startTimer() {
    console.log("startTimer called");
    timeLeft = VERIFICATION_TIMEOUT_SECONDS;
    timerDisplay.textContent = timeLeft;
    clearInterval(timerInterval); // Clear any existing timer

    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimerEnd();
        }
    }, 1000);
}

/**
 * Handles the situation when the verification timer runs out.
 */
function handleTimerEnd() {
    showStatus(verificationStatus, 'Time ran out! Submitting response as is.', true);
    submitVerificationButton.disabled = true;
    // Automatically submit whatever is in the response box (or empty)
    handleVerificationSubmit();
}

/**
 * Handles the submission of the verification response.
 */
async function handleVerificationSubmit() {
    console.log("handleVerificationSubmit called");
    clearInterval(timerInterval); // Stop timer on manual submit
    submitVerificationButton.disabled = true;
    showStatus(verificationStatus, 'Submitting verification response...', false);

    const responseText = verificationResponse.value;

    if (!currentSubmissionId) {
        showStatus(verificationStatus, 'Error: Submission ID is missing.', true);
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
        // Wait a bit before hiding the modal and finalizing
        setTimeout(() => {
            verificationModal.hidden = true;
            finalizeSubmission();
        }, 2000); // Show success message for 2 seconds

    } catch (error) {
        console.error('Verification submission error:', error);
        showStatus(verificationStatus, `Error submitting verification: ${error.message}`, true);
        // Decide if submission should still be finalized despite verification error
        setTimeout(() => {
            verificationModal.hidden = true;
             finalizeSubmission(true); // Finalize but indicate issue
        }, 3000); // Show error longer
    }
}

/**
 * Finalizes the submission process, potentially showing a final message.
 * @param {boolean} [hadIssue=false] - Whether an issue occurred during verification.
 */
function finalizeSubmission(hadIssue = false) {
    if (hadIssue) {
         showStatus(submissionStatus, 'Assignment submitted, but there was an issue during verification. Please contact support if needed.', true);
    } else {
        showStatus(submissionStatus, 'Assignment and verification submitted successfully!');
    }
    // Reset form for next submission (optional)
    submissionText.value = '';
    submitButton.disabled = false;
    currentSubmissionId = null;
}

/**
 * Hides the verification modal and clears the timer.
 */
function hideVerificationPopup() {
    console.log("hideVerificationPopup called");
    clearInterval(timerInterval);
    verificationModal.hidden = true;
    // Optionally reset related fields if needed
    // verificationResponse.value = '';
    // hideStatus(verificationStatus);
}

// --- Event Listeners ---
console.log("Adding event listeners...");
submissionForm.addEventListener('submit', handleAssignmentSubmit);
submitVerificationButton.addEventListener('click', handleVerificationSubmit);
closeModalButton.addEventListener('click', hideVerificationPopup);
console.log("Event listeners added.");

// --- Initial Setup ---
// (Could add initialization logic here if needed)
console.log("ThoughtCaptcha frontend initialized. Script loaded."); 