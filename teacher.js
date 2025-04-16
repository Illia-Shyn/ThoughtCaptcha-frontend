// --- Configuration ---
// Use the same base URL as script.js - ideally, this could be shared in a config file
// TODO: Replace with your actual backend API URL if different or if this is used standalone
const API_BASE_URL = 'https://thoughtcaptcha-backend-production.up.railway.app/api'; // Match script.js
const SUBMISSIONS_URL = `${API_BASE_URL}/submissions`;
const PROMPT_URL = `${API_BASE_URL}/prompt`;

// --- Utility Functions (Copied from script.js - ideally share via modules) ---
/**
 * Displays status messages to the user.
 */
function showStatus(element, message, isError = false) {
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
 */
function hideStatus(element) {
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}

/**
 * Creates an expandable content element with a show more/less button
 */
function createExpandableContent(content, id, type) {
    const container = document.createElement('div');
    
    const contentElement = document.createElement('pre');
    contentElement.id = `content-${type}-${id}`;
    contentElement.className = 'content-truncated';
    contentElement.textContent = content || 'N/A';
    container.appendChild(contentElement);
    
    const button = document.createElement('button');
    button.className = 'expand-button';
    button.textContent = 'Show More';
    button.onclick = function() {
        const contentEl = document.getElementById(`content-${type}-${id}`);
        if (contentEl.classList.contains('content-truncated')) {
            contentEl.classList.remove('content-truncated');
            contentEl.classList.add('content-full');
            button.textContent = 'Show Less';
        } else {
            contentEl.classList.remove('content-full');
            contentEl.classList.add('content-truncated');
            button.textContent = 'Show More';
        }
    };
    container.appendChild(button);
    
    return container;
}

// --- Main Teacher Page Logic ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("Teacher page DOMContentLoaded");

    // --- DOM Elements ---
    const promptForm = document.getElementById('prompt-form');
    const promptTextarea = document.getElementById('system-prompt-text');
    const updatePromptButton = document.getElementById('update-prompt-button');
    const promptStatus = document.getElementById('prompt-status');
    const submissionsListDiv = document.getElementById('submissions-list');

    if (!promptForm || !promptTextarea || !updatePromptButton || !promptStatus || !submissionsListDiv) {
        console.error("One or more essential teacher page elements are missing!");
        return; // Stop execution if elements aren't found
    }

    // --- Functions ---

    /** Fetch and display the current system prompt */
    async function loadSystemPrompt() {
        hideStatus(promptStatus);
        promptTextarea.disabled = true;
        try {
            const response = await fetch(PROMPT_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch prompt: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            promptTextarea.value = data.prompt_text || '';
        } catch (error) {
            console.error("Error loading system prompt:", error);
            showStatus(promptStatus, `Error loading prompt: ${error.message}`, true);
        } finally {
            promptTextarea.disabled = false;
        }
    }

    /** Handle updating the system prompt */
    async function handlePromptUpdate(event) {
        event.preventDefault();
        hideStatus(promptStatus);
        updatePromptButton.disabled = true;
        showStatus(promptStatus, "Updating prompt...", false);
        const newPrompt = promptTextarea.value;

        try {
            const response = await fetch(PROMPT_URL, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt_text: newPrompt })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error updating prompt.' }));
                throw new Error(`Failed to update prompt: ${response.status} ${response.statusText}. ${errorData.detail || ''}`);
            }
            const data = await response.json();
            promptTextarea.value = data.prompt_text; // Update textarea with potentially validated/formatted text
            showStatus(promptStatus, "Prompt updated successfully!", false);
        } catch (error) {
            console.error("Error updating system prompt:", error);
            showStatus(promptStatus, `Error updating prompt: ${error.message}`, true);
        } finally {
            updatePromptButton.disabled = false;
        }
    }

    /** Format date for display */
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString; // Return original if parsing fails
        }
    }

    /** Fetch and display submissions */
    async function loadSubmissions() {
        submissionsListDiv.innerHTML = '<p>Loading submissions...</p>';
        try {
            const response = await fetch(SUBMISSIONS_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch submissions: ${response.status} ${response.statusText}`);
            }
            const submissions = await response.json();

            if (submissions.length === 0) {
                submissionsListDiv.innerHTML = '<p>No submissions found.</p>';
                return;
            }

            submissionsListDiv.innerHTML = ''; // Clear loading message
            submissions.forEach(sub => {
                const entry = document.createElement('div');
                entry.className = 'submission-entry';
                
                // Create the header and metadata
                const header = document.createElement('h3');
                header.textContent = `Submission ID: ${sub.id}`;
                entry.appendChild(header);
                
                const dateP = document.createElement('p');
                dateP.innerHTML = `<strong>Submitted At:</strong> <span class="meta">${formatDate(sub.created_at)}</span>`;
                entry.appendChild(dateP);
                
                // Original content with expandable functionality
                const origContentP = document.createElement('p');
                origContentP.innerHTML = `<strong>Original Content:</strong>`;
                entry.appendChild(origContentP);
                entry.appendChild(createExpandableContent(sub.original_content, sub.id, 'original'));
                
                // Generated question with expandable functionality
                const questionP = document.createElement('p');
                questionP.innerHTML = `<strong>Generated Question:</strong>`;
                entry.appendChild(questionP);
                entry.appendChild(createExpandableContent(sub.generated_question, sub.id, 'question'));
                
                // Student response with expandable functionality
                const responseP = document.createElement('p');
                responseP.innerHTML = `<strong>Student Response:</strong>`;
                entry.appendChild(responseP);
                entry.appendChild(createExpandableContent(sub.student_response, sub.id, 'response'));
                
                submissionsListDiv.appendChild(entry);
            });

        } catch (error) {
            console.error("Error loading submissions:", error);
            submissionsListDiv.innerHTML = `<p class="status-message error">Error loading submissions: ${error.message}</p>`;
        }
    }

    // --- Event Listeners ---
    promptForm.addEventListener('submit', handlePromptUpdate);

    // --- Initial Load ---
    console.log("Loading initial data for teacher page...");
    loadSystemPrompt();
    loadSubmissions();
});

console.log("teacher.js loaded"); 