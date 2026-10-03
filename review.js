const SCRIPT_URL=window.DJ_CONFIG.publicApiUrl||window.DJ_CONFIG.eventsApiUrl;
document.getElementById('reviewForm').addEventListener('submit',e=>window.submitReview(e));
