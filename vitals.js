// Firebase configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: "AIzaSyDMNqYb2V90qdPUTCOkW6EiFuCHvI9JT2s",
    authDomain: "smart-attend-d476c.firebaseapp.com",
    projectId: "smart-attend-d476c",
    storageBucket: "smart-attend-d476c.firebasestorage.app",
    messagingSenderId: "834025214336",
    appId: "1:834025214336:web:6e62ddf29f440f68c5f165",
    measurementId: "G-N46BB4YHQ3"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let currentCamp = null;
let currentPatient = null;
let currentVisit = null;
let vitalsStats = { today: 0, pending: 0 };

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    console.log('=== initializeApp started ===');
    try {
        await loadCurrentCamp();
        await updateVitalsStatistics();
        console.log('About to call loadRecentPatients...');
        await loadRecentPatients();
        console.log('loadRecentPatients completed');
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize application', 'error');
    }
    try {
        await loadCurrentCamp();
        await updateVitalsStatistics();
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize application', 'error');
    }
}

// Load recent registered patients (with detailed debugging)
// Load recent registered patients
async function loadRecentPatients() {
    console.log('loadRecentPatients function called!');
    console.log('=== Starting loadRecentPatients ===');
    
    try {
        const recentContainer = document.getElementById('recentPatientsList');
        console.log('recentPatientsList element:', recentContainer);
        
        if (!recentContainer) {
            console.error('recentPatientsList element not found!');
            return;
        }
        
        recentContainer.innerHTML = '<div class="loading">Loading recent patients...</div>';
        
        console.log('Firebase db object:', db);
        console.log('Attempting to query patients collection...');
        
        // Test if we can connect to Firebase at all
        const testQuery = await db.collection('patients').limit(1).get();
        console.log('Test query result:', testQuery);
        console.log('Test query size:', testQuery.size);
        
        if (testQuery.empty) {
            console.log('No patients found in database');
            recentContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>No patients in database yet</p>
                    <small>Register some patients first</small>
                </div>
            `;
            return;
        }
        
        console.log('Found patients, loading more...');
        
        // Get more patients
        const patientsSnapshot = await db.collection('patients').limit(10).get();
        console.log('Full query result size:', patientsSnapshot.size);
        
        // Process and display
        const patients = [];
        patientsSnapshot.forEach(doc => {
            const data = doc.data();
            console.log('Patient data:', data);
            patients.push({ id: doc.id, ...data });
        });
        
        console.log('Processed patients array:', patients);
        
        if (patients.length === 0) {
            recentContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>No valid patient data found</p>
                </div>
            `;
            return;
        }
        
        // Sort by creation date if available
        patients.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
        });
        
        // Display patients
        recentContainer.innerHTML = patients.slice(0, 8).map(patient => {
            const createdDate = patient.createdAt ? 
                patient.createdAt.toDate().toLocaleDateString() : 'Unknown date';
            
            return `
                <div class="recent-patient-item" onclick="selectPatientFromList('${patient.id}', '${patient.registrationNo}')">
                    <h5>${patient.name || 'Unknown Name'}</h5>
                    <p class="patient-reg-no">${patient.registrationNo || 'No Reg Number'}</p>
                    <p><strong>Age:</strong> ${patient.age || 'N/A'} | <strong>Gender:</strong> ${patient.sex || 'N/A'}</p>
                    <p><strong>Registered:</strong> ${createdDate}</p>
                </div>
            `;
        }).join('');
        
        console.log('=== loadRecentPatients completed successfully ===');
        
    } catch (error) {
        console.error('=== Error in loadRecentPatients ===', error);
        document.getElementById('recentPatientsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p>Error: ${error.message}</p>
                <small>Check console for details</small>
            </div>
        `;
    }
}
// Select patient from recent list
async function selectPatientFromList(patientId, regNumber) {
    document.getElementById('regNumberInput').value = regNumber;
    await lookupPatient();
}

// Setup event listeners
function setupEventListeners() {
    // Update your existing DOMContentLoaded function
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase (your existing code)
    // ... existing Firebase initialization code ...
    
    // Initialize camp selection
    initializeCampSelection();
    
    // Your existing event listeners
    // ... existing code ...
});
    // Patient lookup
    document.getElementById('lookupBtn').addEventListener('click', lookupPatient);
    document.getElementById('clearLookupBtn').addEventListener('click', clearLookup);
    document.getElementById('regNumberInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            lookupPatient();
        }
    });
    
    // Registration number formatting
    document.getElementById('regNumberInput').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // BMI auto-calculation
    document.getElementById('height').addEventListener('input', calculateBMI);
    document.getElementById('weight').addEventListener('input', calculateBMI);
    
    // Form functionality
    document.getElementById('vitalsForm').addEventListener('submit', handleVitalsSubmit);
    document.getElementById('clearVitalsBtn').addEventListener('click', clearVitalsForm);
    
    document.getElementById('refreshDataBtn').addEventListener('click', refreshAllData);
    
    // Modal functionality
    document.getElementById('continueBtn').addEventListener('click', function() {
        document.getElementById('successModal').style.display = 'none';
        clearLookup();
    });
    
    // Blood pressure validation
    document.getElementById('bloodPressure').addEventListener('input', validateBloodPressure);
    
    // Vital signs validation
    setupVitalSignsValidation();
}

// Load current active camp
async function loadCurrentCamp() {
    try {
        const campsRef = db.collection('camps');
        const activeCamps = await campsRef.where('status', '==', 'active').get();
        
        if (!activeCamps.empty) {
            const campDoc = activeCamps.docs[0];
            currentCamp = { id: campDoc.id, ...campDoc.data() };
            
            // Load sponsor information
            const sponsorDoc = await db.collection('sponsors').doc(currentCamp.sponsorId).get();
            if (sponsorDoc.exists) {
                currentSponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
            }
            
            displayCampInfo();
        } else {
            displayNoCampState();
        }
    } catch (error) {
        console.error('Error loading camp:', error);
        showAlert('Failed to load camp information', 'error');
    }
}

// Display camp information
function displayCampInfo() {
    if (!currentCamp || !currentSponsor) return;
    
    const campDate = currentCamp.date.toDate().toLocaleDateString();
    
    document.getElementById('campCard').innerHTML = `
        <h3>🏥 Current Camp</h3>
        <div class="camp-detail">
            <label>Camp Name</label>
            <span>${currentCamp.name}</span>
        </div>
        <div class="camp-detail">
            <label>Sponsor</label>
            <span>${currentSponsor.name}</span>
        </div>
        <div class="camp-detail">
            <label>Location</label>
            <span>${currentCamp.location}</span>
        </div>
        <div class="camp-detail">
            <label>Date</label>
            <span>${campDate}</span>
        </div>
        <div class="camp-detail">
            <label>Status</label>
            <span class="camp-status">
                <span>🟢</span>
                Active
            </span>
        </div>
    `;
}

// Display no camp state
function displayNoCampState() {
    document.getElementById('campCard').innerHTML = `
        <div class="no-camp-state">
            <h3>⚠️ No Active Camp</h3>
            <p>Please ensure there is an active camp to record vitals</p>
        </div>
    `;
}

// Update vitals statistics
// Update vitals statistics (simplified - no orderBy)
async function updateVitalsStatistics() {
    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        // Get all patient visits and filter in JavaScript
        const allVisits = await db.collection('patient_visits').get();
        
        let todayVitalsCount = 0;
        let pendingVitalsCount = 0;
        
        allVisits.forEach(doc => {
            const visit = doc.data();
            
            // Count today's completed vitals
            if (visit.journeyStatus?.vitals?.status === 'completed' && 
                visit.journeyStatus?.vitals?.timestamp) {
                const vitalsDate = visit.journeyStatus.vitals.timestamp.toDate();
                if (vitalsDate >= todayStart && vitalsDate < todayEnd) {
                    todayVitalsCount++;
                }
            }
            
            // Count pending vitals
            if (visit.journeyStatus?.registration?.status === 'completed' &&
                visit.journeyStatus?.vitals?.status === 'pending') {
                pendingVitalsCount++;
            }
        });
        
        vitalsStats.today = todayVitalsCount;
        vitalsStats.pending = pendingVitalsCount;
        
        // Update UI
        document.getElementById('todayVitals').textContent = vitalsStats.today;
        document.getElementById('pendingVitals').textContent = vitalsStats.pending;
        
    } catch (error) {
        console.error('Error updating statistics:', error);
        // Set default values on error
        document.getElementById('todayVitals').textContent = '0';
        document.getElementById('pendingVitals').textContent = '0';
    }
}

// Lookup patient by registration number, name, or phone
async function lookupPatient() {
    const searchTerm = document.getElementById('regNumberInput').value.trim().toUpperCase();
    if (!searchTerm) {
        showAlert('Please enter a search term', 'warning');
        return;
    }
    
    // Show search results section, hide recent patients
    document.getElementById('recentPatientsSection').style.display = 'none';
    document.getElementById('searchResultsSection').style.display = 'block';
    
    try {
        showAlert('Searching for patient...', 'info');
        
        let allPatients = [];
        
        // Search by registration number (exact match)
        if (searchTerm.includes('_') || /^\d{8}_\d{3}$/.test(searchTerm)) {
            console.log('Searching by registration number:', searchTerm);
            const regQuery = await db.collection('patients')
                .where('registrationNo', '==', searchTerm)
                .get();
            
            regQuery.forEach(doc => {
                allPatients.push({ id: doc.id, ...doc.data(), matchType: 'Registration Number' });
            });
        }
        
        // Search by phone number (exact match for 10 digits)
        if (/^\d{10}$/.test(searchTerm)) {
            console.log('Searching by phone number:', searchTerm);
            const phoneQuery = await db.collection('patients')
                .where('phone', '==', searchTerm)
                .get();
            
            phoneQuery.forEach(doc => {
                const patient = { id: doc.id, ...doc.data(), matchType: 'Phone Number' };
                // Avoid duplicates
                if (!allPatients.find(p => p.id === patient.id)) {
                    allPatients.push(patient);
                }
            });
        }
        
        // Search by name (partial match) - only if search term is at least 3 characters
        if (searchTerm.length >= 3 && !/^\d+$/.test(searchTerm)) {
            console.log('Searching by name:', searchTerm);
            
            // Get all patients and filter by name in JavaScript (since Firestore doesn't support case-insensitive search)
            const allPatientsQuery = await db.collection('patients').get();
            
            allPatientsQuery.forEach(doc => {
                const patient = doc.data();
                const patientName = patient.name ? patient.name.toUpperCase() : '';
                
                // Check if name contains the search term
                if (patientName.includes(searchTerm)) {
                    const patientWithMatch = { id: doc.id, ...patient, matchType: 'Name' };
                    // Avoid duplicates
                    if (!allPatients.find(p => p.id === patientWithMatch.id)) {
                        allPatients.push(patientWithMatch);
                    }
                }
            });
        }
        
        console.log('Search results:', allPatients);
        
        if (allPatients.length === 0) {
            document.getElementById('searchResultsList').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Patients Found</h3>
                    <p>No patients found matching "${searchTerm}"</p>
                    <small>Try searching with registration number, phone, or name</small>
                </div>
            `;
            showAlert('No patients found with this search term', 'error');
            return;
        }
        
        // Display search results
        document.getElementById('searchResultsList').innerHTML = allPatients.map(patient => `
            <div class="search-result-item" onclick="selectPatientFromSearch('${patient.id}', '${patient.registrationNo}')">
                <h5>${patient.name}</h5>
                <p class="patient-reg-no">${patient.registrationNo}</p>
                <p><strong>Phone:</strong> ${patient.phone}</p>
                <p><strong>Age:</strong> ${patient.age} | <strong>Gender:</strong> ${patient.sex}</p>
                <p><strong>Match:</strong> <span style="color: var(--vitals-purple); font-weight: 600;">${patient.matchType}</span></p>
            </div>
        `).join('');
        
        // If exactly one result, auto-select it
        if (allPatients.length === 1) {
            await selectPatientFromSearch(allPatients[0].id, allPatients[0].registrationNo);
            showAlert('Patient found and selected automatically', 'success');
        } else {
            showAlert(`Found ${allPatients.length} patients matching your search`, 'success');
        }
        
    } catch (error) {
        console.error('Error looking up patient:', error);
        showAlert('Failed to lookup patient', 'error');
        document.getElementById('searchResultsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Search Failed</h3>
                <p>Unable to search patients. Please try again.</p>
            </div>
        `;
    }
}

// Select patient from search results
async function selectPatientFromSearch(patientId, regNumber) {
    try {
        // Get patient data
        const patientDoc = await db.collection('patients').doc(patientId).get();
        if (!patientDoc.exists) {
            showAlert('Patient not found', 'error');
            return;
        }
        
        currentPatient = { id: patientDoc.id, ...patientDoc.data() };
        
        // Find patient's visit record
        const visitQuery = await db.collection('patient_visits')
            .where('patientId', '==', currentPatient.id)
            .where('campId', '==', currentCamp.id)
            .get();
        
        if (visitQuery.empty) {
            showAlert('No visit record found for this patient in current camp', 'error');
            return;
        }
        
        currentVisit = { id: visitQuery.docs[0].id, ...visitQuery.docs[0].data() };
        
        // Check if registration is completed
        if (currentVisit.journeyStatus.registration.status !== 'completed') {
            showAlert('Patient registration is not completed yet', 'warning');
            return;
        }
        
        // Check if vitals already completed
        if (currentVisit.journeyStatus.vitals.status === 'completed') {
            showAlert('Vitals already recorded for this patient', 'warning');
            displayPatientInfo();
            loadPreviousVitals();
            return;
        }
        
        // Update the search input to show selected patient
        document.getElementById('regNumberInput').value = regNumber;
        
        // Display patient information and show form
        displayPatientInfo();
        showVitalsForm();
        loadPreviousVitals();
        
        showAlert('Patient selected successfully', 'success');
        
    } catch (error) {
        console.error('Error selecting patient:', error);
        showAlert('Failed to select patient', 'error');
    }
}

// Display patient information
function displayPatientInfo() {
    const patientInfo = document.getElementById('patientInfo');
    
    document.getElementById('patientName').textContent = currentPatient.name;
    document.getElementById('patientRegNo').textContent = currentPatient.registrationNo;
    document.getElementById('patientAge').textContent = `${currentPatient.age} years`;
    document.getElementById('patientGender').textContent = currentPatient.sex;
    document.getElementById('patientPhone').textContent = currentPatient.phone;
    document.getElementById('presentComplaint').textContent = currentVisit.presentComplaint || 'Not specified';
    
    patientInfo.style.display = 'block';
}

// Show vitals form
function showVitalsForm() {
    document.getElementById('vitalsForm').style.display = 'block';
    document.getElementById('noPatientState').style.display = 'none';
    
    // Update completion status
    const completionStatus = document.getElementById('completionStatus');
    if (currentVisit.journeyStatus.vitals.status === 'completed') {
        completionStatus.innerHTML = `
            <span class="status-icon">✅</span>
            <span class="status-text">Vitals Completed</span>
        `;
        completionStatus.className = 'completion-status completed';
        
        // Disable form if already completed
        const form = document.getElementById('vitalsForm');
        const inputs = form.querySelectorAll('input, textarea, button[type="submit"]');
        inputs.forEach(input => {
            if (input.type !== 'button' && input.id !== 'clearVitalsBtn') {
                input.disabled = true;
            }
        });
        
        // Load existing vitals data
        if (currentVisit.vitals) {
            populateVitalsForm(currentVisit.vitals);
        }
    } else {
        completionStatus.innerHTML = `
            <span class="status-icon">📝</span>
            <span class="status-text">Recording Vitals</span>
        `;
        completionStatus.className = 'completion-status ready';
    }
}

// Populate vitals form with existing data
function populateVitalsForm(vitalsData) {
    document.getElementById('bloodPressure').value = vitalsData.bp || '';
    document.getElementById('heartRate').value = vitalsData.heartRate || '';
    document.getElementById('temperature').value = vitalsData.temperature || '';
    document.getElementById('height').value = vitalsData.height || '';
    document.getElementById('weight').value = vitalsData.weight || '';
    document.getElementById('bmi').value = vitalsData.bmi || '';
    document.getElementById('respirationRate').value = vitalsData.respirationRate || '';
    document.getElementById('hemoglobin').value = vitalsData.hemoglobin || '';
    document.getElementById('bloodGlucose').value = vitalsData.bloodGlucose || '';
    document.getElementById('primarySymptoms').value = vitalsData.primarySymptoms || '';
    document.getElementById('additionalComplaints').value = vitalsData.additionalComplaints || '';
    
    // Update BMI category if BMI exists
    if (vitalsData.bmi) {
        updateBMICategory(vitalsData.bmi);
    }
}

// Calculate BMI automatically
function calculateBMI() {
    const height = parseFloat(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    
    if (height && weight && height > 0) {
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        const roundedBMI = Math.round(bmi * 10) / 10;
        
        document.getElementById('bmi').value = roundedBMI;
        updateBMICategory(roundedBMI);
    } else {
        document.getElementById('bmi').value = '';
        document.getElementById('bmiCategory').textContent = '';
    }
}

// Update BMI category display
function updateBMICategory(bmi) {
    const categoryElement = document.getElementById('bmiCategory');
    
    if (bmi < 18.5) {
        categoryElement.textContent = 'Underweight';
        categoryElement.className = 'field-hint bmi-category underweight';
    } else if (bmi >= 18.5 && bmi < 25) {
        categoryElement.textContent = 'Normal weight';
        categoryElement.className = 'field-hint bmi-category normal';
    } else if (bmi >= 25 && bmi < 30) {
        categoryElement.textContent = 'Overweight';
        categoryElement.className = 'field-hint bmi-category overweight';
    } else {
        categoryElement.textContent = 'Obese';
        categoryElement.className = 'field-hint bmi-category obese';
    }
}

// Validate blood pressure format
function validateBloodPressure() {
    const bpInput = document.getElementById('bloodPressure');
    const value = bpInput.value;
    
    // Allow partial typing
    if (value && !value.match(/^\d{0,3}\/?(\d{0,3})?$/)) {
        bpInput.value = value.slice(0, -1);
    }
}

// Setup vital signs validation
function setupVitalSignsValidation() {
    // Heart rate validation
    document.getElementById('heartRate').addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        if (value && (value < 40 || value > 200)) {
            showFieldError('heartRate', 'Heart rate should be between 40-200 BPM');
        } else {
            clearFieldError('heartRate');
        }
    });
    
    // Temperature validation
    document.getElementById('temperature').addEventListener('input', function(e) {
        const value = parseFloat(e.target.value);
        if (value && (value < 90 || value > 110)) {
            showFieldError('temperature', 'Temperature should be between 90-110°F');
        } else {
            clearFieldError('temperature');
        }
    });
    
    // Height validation
    document.getElementById('height').addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        if (value && (value < 50 || value > 250)) {
            showFieldError('height', 'Height should be between 50-250 cm');
        } else {
            clearFieldError('height');
        }
    });
    
    // Weight validation
    document.getElementById('weight').addEventListener('input', function(e) {
        const value = parseFloat(e.target.value);
        if (value && (value < 10 || value > 300)) {
            showFieldError('weight', 'Weight should be between 10-300 kg');
        } else {
            clearFieldError('weight');
        }
    });
}

// Handle vitals form submission
async function handleVitalsSubmit(e) {
    e.preventDefault();
    
    if (!currentPatient || !currentVisit) {
        showAlert('Please lookup a patient first', 'warning');
        return;
    }
    
    if (!validateVitalsForm()) {
        return;
    }
    
    const submitBtn = document.getElementById('saveVitalsBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    try {
        const formData = new FormData(e.target);
        
        // Prepare vitals data
        const vitalsData = {
            bp: formData.get('bp') || '',
            heartRate: formData.get('heartRate') ? parseInt(formData.get('heartRate')) : null,
            height: formData.get('height') ? parseInt(formData.get('height')) : null,
            weight: formData.get('weight') ? parseFloat(formData.get('weight')) : null,
            bmi: formData.get('bmi') ? parseFloat(formData.get('bmi')) : null,
            temperature: formData.get('temperature') ? parseFloat(formData.get('temperature')) : null,
            respirationRate: formData.get('respirationRate') ? parseInt(formData.get('respirationRate')) : null,
            hemoglobin: formData.get('hemoglobin') ? parseFloat(formData.get('hemoglobin')) : null,
            bloodGlucose: formData.get('bloodGlucose') ? parseInt(formData.get('bloodGlucose')) : null,
            primarySymptoms: formData.get('primarySymptoms') || '',
            additionalComplaints: formData.get('additionalComplaints') || '',
            recordedAt: firebase.firestore.Timestamp.now(),
            recordedBy: 'vitals-user' // Replace with actual user ID
        };
        
        // Update patient visit record
        const updateData = {
            vitals: vitalsData,
            'journeyStatus.vitals.status': 'completed',
            'journeyStatus.vitals.timestamp': firebase.firestore.Timestamp.now(),
            'journeyStatus.vitals.by': 'vitals-user',
            updatedAt: firebase.firestore.Timestamp.now()
        };
        
        await db.collection('patient_visits').doc(currentVisit.id).update(updateData);
        
        // Update current visit object
        currentVisit = { ...currentVisit, ...updateData };
        
        // Show success modal
        document.getElementById('successModal').style.display = 'block';
        
        // Update statistics
        await updateVitalsStatistics();
        
        // Refresh previous vitals
        await loadPreviousVitals();
        
        showAlert('Vitals recorded successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving vitals:', error);
        showAlert('Failed to save vitals: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Validate vitals form
function validateVitalsForm() {
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    // Validate required fields
    const requiredFields = ['bloodPressure', 'heartRate', 'temperature', 'height', 'weight'];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showFieldError(fieldId, 'This field is required');
            isValid = false;
        }
    });
    
    // Validate blood pressure format
    const bp = document.getElementById('bloodPressure').value;
    if (bp && !bp.match(/^\d{2,3}\/\d{2,3}$/)) {
        showFieldError('bloodPressure', 'Please enter in format: 120/80');
        isValid = false;
    }
    
    // Validate numeric ranges
    const heartRate = parseInt(document.getElementById('heartRate').value);
    if (heartRate && (heartRate < 40 || heartRate > 200)) {
        showFieldError('heartRate', 'Heart rate must be between 40-200 BPM');
        isValid = false;
    }
    
    const temperature = parseFloat(document.getElementById('temperature').value);
    if (temperature && (temperature < 90 || temperature > 110)) {
        showFieldError('temperature', 'Temperature must be between 90-110°F');
        isValid = false;
    }
    
    return isValid;
}

// Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    formGroup.classList.add('error');
    
    let errorElement = formGroup.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        formGroup.appendChild(errorElement);
    }
    errorElement.textContent = message;
}

// Clear field error
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    formGroup.classList.remove('error');
}

// Load previous vitals history (without orderBy)
async function loadPreviousVitals() {
    try {
        if (!currentPatient) return;
        
        const historyContainer = document.getElementById('vitalsHistory');
        historyContainer.innerHTML = '<div class="loading">Loading previous vitals...</div>';
        
        // Get all visits for this patient and filter in JavaScript
        const visitsQuery = await db.collection('patient_visits')
            .where('patientId', '==', currentPatient.id)
            .get();
        
        if (visitsQuery.empty) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>No Previous Records</h3>
                    <p>No previous vitals found for this patient</p>
                </div>
            `;
            return;
        }
        
        // Filter and sort in JavaScript
        const completedVitals = visitsQuery.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(visit => visit.journeyStatus?.vitals?.status === 'completed')
            .sort((a, b) => {
                const aTime = a.journeyStatus?.vitals?.timestamp ? 
                    a.journeyStatus.vitals.timestamp.toDate().getTime() : 0;
                const bTime = b.journeyStatus?.vitals?.timestamp ? 
                    b.journeyStatus.vitals.timestamp.toDate().getTime() : 0;
                return bTime - aTime; // Newest first
            })
            .slice(0, 5); // Take only first 5
        
        if (completedVitals.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>No Previous Records</h3>
                    <p>No previous vitals found for this patient</p>
                </div>
            `;
            return;
        }
        
        const historyItems = completedVitals.map(visit => {
            const vitals = visit.vitals;
            const recordedDate = visit.journeyStatus.vitals.timestamp.toDate();
            
            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-date">${recordedDate.toLocaleDateString()} ${recordedDate.toLocaleTimeString()}</span>
                        <span class="history-by">by ${visit.journeyStatus.vitals.by}</span>
                    </div>
                    <div class="history-vitals">
                        <div class="history-vital">
                            <label>BP:</label>
                            <span>${vitals.bp || 'N/A'}</span>
                        </div>
                        <div class="history-vital">
                            <label>HR:</label>
                            <span>${vitals.heartRate || 'N/A'}</span>
                        </div>
                        <div class="history-vital">
                            <label>Temp:</label>
                            <span>${vitals.temperature || 'N/A'}°F</span>
                        </div>
                        <div class="history-vital">
                            <label>BMI:</label>
                            <span>${vitals.bmi || 'N/A'}</span>
                        </div>
                        <div class="history-vital">
                            <label>Weight:</label>
                            <span>${vitals.weight || 'N/A'} kg</span>
                        </div>
                        <div class="history-vital">
                            <label>Height:</label>
                            <span>${vitals.height || 'N/A'} cm</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        historyContainer.innerHTML = historyItems;
        
    } catch (error) {
        console.error('Error loading previous vitals:', error);
        document.getElementById('vitalsHistory').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Loading Failed</h3>
                <p>Failed to load previous vitals</p>
            </div>
        `;
    }
}

// Clear lookup
function clearLookup() {
    // Show recent patients, hide search results
    document.getElementById('recentPatientsSection').style.display = 'block';
    document.getElementById('searchResultsSection').style.display = 'none';
    document.getElementById('regNumberInput').value = '';
    document.getElementById('patientInfo').style.display = 'none';
    document.getElementById('vitalsForm').style.display = 'none';
    document.getElementById('noPatientState').style.display = 'block';
    
    currentPatient = null;
    currentVisit = null;
    
    // Clear vitals history
    document.getElementById('vitalsHistory').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3>No Previous Records</h3>
            <p>No previous vitals found for this patient</p>
        </div>
    `;
    
    clearVitalsForm();
}

// Clear vitals form
function clearVitalsForm() {
    document.getElementById('vitalsForm').reset();
    document.getElementById('bmiCategory').textContent = '';
    
    // Clear all errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    // Re-enable form if it was disabled
    const form = document.getElementById('vitalsForm');
    const inputs = form.querySelectorAll('input, textarea, button');
    inputs.forEach(input => {
        input.disabled = false;
    });
}

// Refresh all data
async function refreshAllData() {
    await loadRecentPatients();
    try {
        showAlert('Refreshing data...', 'info');
        await loadCurrentCamp();
        await updateVitalsStatistics();
        if (currentPatient) {
            await loadPreviousVitals();
        }
        showAlert('Data refreshed successfully!', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showAlert('Failed to refresh data', 'error');
    }
}

// Show alert notification
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    alertDiv.innerHTML = `
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Show alert
    setTimeout(() => alertDiv.classList.add('show'), 100);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            if (alertContainer.contains(alertDiv)) {
                alertContainer.removeChild(alertDiv);
            }
        }, 300);
    }, 5000);
}
