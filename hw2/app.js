// app.js - Review Sentiment Analyzer with Google Sheets Logging
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js";

// Configuration
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'; // Replace with your Google Script URL
const MODEL_NAME = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
const TSV_FILE = 'reviews_test.tsv';

// State management
let reviews = [];
let sentimentPipeline = null;
let currentAnalysis = null;
let modelLoaded = false;
let reviewsLoaded = false;

// DOM Elements
const reviewBox = document.getElementById('reviewBox');
const resultBox = document.getElementById('resultBox');
const analyzeBtn = document.getElementById('analyzeBtn');
const logBtn = document.getElementById('logBtn');
const modelStatus = document.getElementById('modelStatus');
const reviewsStatus = document.getElementById('reviewsStatus');
const errorBox = document.getElementById('errorBox');
const errorMessage = document.getElementById('errorMessage');

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load reviews and model in parallel
        await Promise.all([
            loadReviews(),
            loadModel()
        ]);
        
        analyzeBtn.disabled = false;
        analyzeBtn.addEventListener('click', analyzeRandomReview);
        logBtn.addEventListener('click', logToGoogleSheets);
        
    } catch (error) {
        showError(`Failed to initialize application: ${error.message}`);
    }
});

/**
 * Load reviews from TSV file using Papa Parse
 */
async function loadReviews() {
    try {
        const response = await fetch(TSV_FILE);
        if (!response.ok) {
            throw new Error(`Failed to load TSV file: ${response.status} ${response.statusText}`);
        }
        
        const tsvContent = await response.text();
        
        // Parse TSV using Papa Parse
        const result = Papa.parse(tsvContent, {
            header: true,
            delimiter: "\t",
            skipEmptyLines: true
        });
        
        if (result.errors.length > 0) {
            console.warn('Parsing warnings:', result.errors);
        }
        
        // Extract review texts from 'text' column
        reviews = result.data
            .map(row => row.text)
            .filter(text => text && typeof text === 'string' && text.trim().length > 0);
        
        if (reviews.length === 0) {
            throw new Error('No valid reviews found in TSV file');
        }
        
        // Update status
        reviewsStatus.classList.remove('loading');
        reviewsStatus.classList.add('success');
        reviewsStatus.querySelector('.status-icon').innerHTML = '<i class="fas fa-check"></i>';
        reviewsStatus.querySelector('p').textContent = `Loaded ${reviews.length} reviews`;
        reviewsLoaded = true;
        
        console.log(`Successfully loaded ${reviews.length} reviews`);
        
    } catch (error) {
        reviewsStatus.classList.remove('loading');
        reviewsStatus.classList.add('error');
        reviewsStatus.querySelector('.status-icon').innerHTML = '<i class="fas fa-times"></i>';
        reviewsStatus.querySelector('p').textContent = 'Failed to load reviews';
        throw error;
    }
}

/**
 * Load sentiment analysis model using Transformers.js
 */
async function loadModel() {
    try {
        console.log('Loading sentiment analysis model...');
        
        sentimentPipeline = await pipeline('text-classification', MODEL_NAME, {
            progress_callback: (progress) => {
                if (progress.status === 'downloading') {
                    modelStatus.querySelector('p').textContent = 
                        `Downloading model: ${Math.round(progress.progress * 100)}%`;
                }
            }
        });
        
        // Update status
        modelStatus.classList.remove('loading');
        modelStatus.classList.add('success');
        modelStatus.querySelector('.status-icon').innerHTML = '<i class="fas fa-check"></i>';
        modelStatus.querySelector('p').textContent = 'Model loaded and ready';
        modelLoaded = true;
        
        console.log('Sentiment analysis model loaded successfully');
        
    } catch (error) {
        modelStatus.classList.remove('loading');
        modelStatus.classList.add('error');
        modelStatus.querySelector('.status-icon').innerHTML = '<i class="fas fa-times"></i>';
        modelStatus.querySelector('p').textContent = 'Failed to load model';
        throw new Error(`Model loading failed: ${error.message}`);
    }
}

/**
 * Select a random review from the loaded reviews
 */
function getRandomReview() {
    if (reviews.length === 0) {
        throw new Error('No reviews available');
    }
    
    const randomIndex = Math.floor(Math.random() * reviews.length);
    return reviews[randomIndex];
}

/**
 * Analyze the sentiment of a given text using Transformers.js
 */
async function analyzeSentiment(text) {
    if (!sentimentPipeline) {
        throw new Error('Sentiment model not loaded');
    }
    
    if (!text || text.trim().length === 0) {
        throw new Error('Review text is empty');
    }
    
    // Run sentiment analysis
    const results = await sentimentPipeline(text);
    
    if (!Array.isArray(results) || results.length === 0) {
        throw new Error('Invalid analysis results');
    }
    
    // Get the primary result (highest score)
    const primaryResult = results[0];
    
    // Determine sentiment category
    const label = primaryResult.label.toUpperCase();
    const score = primaryResult.score;
    
    let sentiment;
    if (label.includes('POSITIVE') && score > 0.5) {
        sentiment = 'positive';
    } else if (label.includes('NEGATIVE') && score > 0.5) {
        sentiment = 'negative';
    } else {
        sentiment = 'neutral';
    }
    
    return {
        label,
        score,
        sentiment,
        confidence: (score * 100).toFixed(1)
    };
}

/**
 * Update UI with analysis results
 */
function updateUI(review, analysis) {
    // Update review display
    reviewBox.textContent = review;
    reviewBox.classList.add('pulse');
    
    // Update result display
    resultBox.className = `result-box ${analysis.sentiment}`;
    
    const sentimentIcon = resultBox.querySelector('.sentiment-icon i');
    const sentimentLabel = resultBox.querySelector('.sentiment-label');
    const confidenceEl = resultBox.querySelector('.confidence');
    
    // Set icon based on sentiment
    switch (analysis.sentiment) {
        case 'positive':
            sentimentIcon.className = 'fas fa-thumbs-up';
            break;
        case 'negative':
            sentimentIcon.className = 'fas fa-thumbs-down';
            break;
        default:
            sentimentIcon.className = 'fas fa-question-circle';
    }
    
    sentimentLabel.textContent = analysis.label;
    confidenceEl.textContent = `${analysis.confidence}% confidence`;
    
    // Remove pulse animation after a delay
    setTimeout(() => {
        reviewBox.classList.remove('pulse');
    }, 1000);
}

/**
 * Handle random review analysis
 */
async function analyzeRandomReview() {
    if (!modelLoaded || !reviewsLoaded) {
        showError('Model or reviews not loaded yet');
        return;
    }
    
    try {
        // Reset error display
        hideError();
        
        // Disable button and show loading state
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        logBtn.disabled = true;
        
        // Get random review
        const review = getRandomReview();
        
        // Analyze sentiment
        const analysis = await analyzeSentiment(review);
        
        // Store current analysis for logging
        currentAnalysis = {
            review,
            ...analysis,
            timestamp: new Date().toISOString()
        };
        
        // Update UI
        updateUI(review, analysis);
        
        // Enable logging button
        logBtn.disabled = false;
        
    } catch (error) {
        showError(`Analysis failed: ${error.message}`);
    } finally {
        // Restore button state
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-random"></i> Analyze Random Review';
    }
}

/**
 * Collect metadata from client
 */
function collectMetadata() {
    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        model: MODEL_NAME,
        timestamp: new Date().toISOString(),
        reviewCount: reviews.length,
        analysisTime: new Date().toISOString()
    };
}

/**
 * Log analysis results to Google Sheets
 */
async function logToGoogleSheets() {
    if (!currentAnalysis) {
        showError('No analysis to log');
        return;
    }
    
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
        showError('Google Sheets integration not configured. Please set your Google Script URL.');
        return;
    }
    
    try {
        // Prepare data for Google Sheets
        const payload = {
            ts_iso: currentAnalysis.timestamp,
            review: currentAnalysis.review,
            sentiment: `${currentAnalysis.label} (${currentAnalysis.confidence}%)`,
            meta: JSON.stringify({
                ...collectMetadata(),
                analysis: {
                    label: currentAnalysis.label,
                    score: currentAnalysis.score,
                    sentiment: currentAnalysis.sentiment,
                    confidence: currentAnalysis.confidence
                }
            })
        };
        
        // Update button to show loading
        logBtn.disabled = true;
        logBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging...';
        
        // Send to Google Apps Script
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for cross-origin to Google Scripts
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        // Note: With 'no-cors' mode, we can't read the response
        // But we assume it worked if no error was thrown
        
        // Show success feedback
        logBtn.innerHTML = '<i class="fas fa-check"></i> Logged Successfully';
        logBtn.style.background = 'var(--positive)';
        logBtn.style.color = 'white';
        
        // Reset button after delay
        setTimeout(() => {
            logBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Log to Google Sheets';
            logBtn.style.background = '';
            logBtn.style.color = '';
            logBtn.disabled = false;
        }, 2000);
        
        console.log('Data logged to Google Sheets:', payload);
        
    } catch (error) {
        showError(`Failed to log to Google Sheets: ${error.message}`);
        logBtn.disabled = false;
        logBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Log to Google Sheets';
    }
}

/**
 * Display error message in UI
 */
function showError(message) {
    console.error('Application error:', message);
    errorMessage.textContent = message;
    errorBox.classList.add('show');
    
    // Auto-hide error after 10 seconds
    setTimeout(hideError, 10000);
}

/**
 * Hide error message
 */
function hideError() {
    errorBox.classList.remove('show');
}

// Export functions for testing (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getRandomReview,
        analyzeSentiment,
        collectMetadata
    };
}