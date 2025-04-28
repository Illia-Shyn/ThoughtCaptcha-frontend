// --- Configuration ---
// TODO: Replace with your actual backend API URL (likely from Railway)
const API_BASE_URL = 'https://thoughtcaptcha-backend-production.up.railway.app/api'; // Use http://localhost:8000 for local testing
const SUBMIT_ASSIGNMENT_URL = `${API_BASE_URL}/submit-assignment`;
const GENERATE_QUESTION_URL = `${API_BASE_URL}/generate-question`;
const VERIFY_RESPONSE_URL = `${API_BASE_URL}/verify-response`;
const CURRENT_ASSIGNMENT_URL = `${API_BASE_URL}/assignments/current`;
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
    const assignmentTitle = document.getElementById('assignment-title');
    const assignmentPromptDisplay = document.getElementById('assignment-prompt-display');
    const assignmentPromptLabel = document.getElementById('assignment-prompt-label');
    console.log("DOM elements selected"); // DEBUG

    // --- State Variables ---
    let currentSubmissionId = null;
    let currentAssignmentId = null;
    let timerInterval = null;
    let timeLeft = VERIFICATION_TIMEOUT_SECONDS;
    console.log("State variables initialized"); // DEBUG

    // --- Core Function Definitions (Defined *inside* DOMContentLoaded) ---

    /**
     * Loads and displays the current assignment
     */
    async function loadAndDisplayCurrentAssignment() {
        try {
            assignmentTitle.textContent = "Loading Assignment...";
            assignmentPromptDisplay.textContent = "Loading assignment prompt...";
            
            const response = await fetch(CURRENT_ASSIGNMENT_URL);
            
            if (response.status === 404) {
                // No current assignment set
                assignmentTitle.textContent = "Submit Your Work";
                assignmentPromptDisplay.textContent = "No specific assignment prompt is currently active.";
                assignmentPromptLabel.textContent = "Enter your submission:";
                currentAssignmentId = null;
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch current assignment: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            assignmentTitle.textContent = "Assignment";
            assignmentPromptDisplay.textContent = data.prompt_text;
            assignmentPromptLabel.textContent = "Your Response to the Assignment Above:";
            currentAssignmentId = data.id;
            
        } catch (error) {
            console.error("Error loading current assignment:", error);
            assignmentTitle.textContent = "Submit Your Work";
            assignmentPromptDisplay.textContent = "Error loading assignment: " + error.message;
            assignmentPromptLabel.textContent = "Enter your submission:";
            currentAssignmentId = null;
        }
    }

    async function handleAssignmentSubmit(event) {
        console.log("handleAssignmentSubmit called"); // DEBUG
        event.preventDefault(); // Prevent default form submission
        if (!submitButton || !submissionText || !submissionStatus) {
            console.error("Required elements missing for submission.");
            return;
        }
        submitButton.disabled = true;
        hideStatus(submissionStatus);
        showStatus(submissionStatus, 'Submitting response...', false);

        const content = submissionText.value;
        
        // Include the assignment ID in the payload if it exists
        const payload = {
            original_content: content,
            assignment_id: currentAssignmentId // This will be null if no assignment is active
        };

        try {
            const response = await fetch(SUBMIT_ASSIGNMENT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
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
            showStatus(submissionStatus, `Error submitting response: ${error.message}`, true);
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
                    student_response: responseText
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error verifying response.' }));
                throw new Error(`Verification submission failed: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
            }

            showStatus(verificationStatus, 'Verification response submitted successfully!');
            finalizeSubmission();
            
        } catch (error) {
            console.error('Verification submission error:', error);
            showStatus(verificationStatus, `Error submitting verification: ${error.message}`, true);
            submitVerificationButton.disabled = false; // Re-enable in case they want to retry
        }
    }

    function finalizeSubmission(hadIssue = false) {
        console.log(`finalizeSubmission called, hadIssue: ${hadIssue}`); // DEBUG
        setTimeout(() => {
            if (verificationModal) {
                hideVerificationPopup();
            }
            
            // Reset the form
            if (submissionForm) {
                submissionForm.reset();
            }
            if (submitButton) {
                submitButton.disabled = false;
            }
            
            // Show a final submission status
            if (submissionStatus) {
                let message = 'Submission and verification complete!';
                if (hadIssue) {
                    message = 'Submission complete, but there were issues with verification.';
                }
                showStatus(submissionStatus, message, hadIssue);
            }
        }, 3000); // Short delay to allow reading the verification status
    }

    function hideVerificationPopup() {
        console.log("hideVerificationPopup called"); // DEBUG
        if (verificationModal) {
            verificationModal.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    if (submissionForm) {
        submissionForm.addEventListener('submit', handleAssignmentSubmit);
    } else {
        console.error("Submission form not found!");
    }

    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            hideVerificationPopup();
            // If they manually close without responding, consider it an issue
            finalizeSubmission(true);
        });
    }

    if (submitVerificationButton) {
        submitVerificationButton.addEventListener('click', handleVerificationSubmit);
    }

    // Initial load
    loadAndDisplayCurrentAssignment();
    console.log("Script initialization complete");
}); 