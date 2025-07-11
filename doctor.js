// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMNqYb2V90qdPUTCOkW6EiFuCHvI9JT2s",
    authDomain: "smart-attend-d476c.firebaseapp.com",
    projectId: "smart-attend-d476c",
    storageBucket: "smart-attend-d476c.appspot.com",
    messagingSenderId: "834025214336",
    appId: "1:834025214336:web:6e62ddf29f440f68c5f165"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let currentCamp = null;
let currentSponsor = null;
let currentPatient = null;
let currentVisit = null;
let doctorStats = { today: 0, pending: 0 };

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    console.log('=== Doctor Dashboard: initializeApp started ===');
    try {
        await loadCurrentCamp();
        await updateDoctorStatistics();
        await loadReadyPatients();
        console.log('Doctor dashboard initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize doctor dashboard', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Patient search
    document.getElementById('searchBtn').addEventListener('click', searchPatients);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchPatients();
        }
    });
    
    // Search input formatting
    document.getElementById('searchInput').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
    
    // Form functionality
    document.getElementById('consultationForm').addEventListener('submit', handleConsultationSubmit);
    document.getElementById('clearConsultationBtn').addEventListener('click', clearConsultationForm);
    
    // Quick actions
    document.getElementById('refreshDataBtn').addEventListener('click', refreshAllData);
    document.getElementById('refreshPatientsBtn').addEventListener('click', loadReadyPatients);
    
    // Modal functionality
    document.getElementById('continueBtn').addEventListener('click', function() {
        document.getElementById('successModal').style.display = 'none';
        clearPatientSelection();
    });
}

// Load current active camp
async function loadCurrentCamp() {
    try {
        console.log('Loading current camp...');
        const campsRef = db.collection('camps');
        
        // Try to get active camps first
        let activeCamps = await campsRef.where('status', '==', 'active').get();
        
        if (activeCamps.empty) {
            // If no active camps, try planned camps
            activeCamps = await campsRef.where('status', '==', 'planned').get();
        }
        
        if (activeCamps.empty) {
            // If still no camps, get any camp that's not completed or cancelled
            const allCamps = await campsRef.get();
            const availableCamps = allCamps.docs.filter(doc => {
                const data = doc.data();
                return data.status !== 'completed' && data.status !== 'cancelled';
            });
            
            if (availableCamps.length > 0) {
                const campDoc = availableCamps[0];
                currentCamp = { id: campDoc.id, ...campDoc.data() };
            } else {
                displayNoCampState();
                return;
            }
        } else {
            const campDoc = activeCamps.docs[0];
            currentCamp = { id: campDoc.id, ...campDoc.data() };
        }
        
        // Load sponsor information
        if (currentCamp.sponsorId) {
            const sponsorDoc = await db.collection('sponsors').doc(currentCamp.sponsorId).get();
            if (sponsorDoc.exists) {
                currentSponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
            }
        }
        
        displayCampInfo();
        console.log('Current camp loaded:', currentCamp.name);
        
    } catch (error) {
        console.error('Error loading camp:', error);
        showAlert('Failed to load camp information', 'error');
        displayNoCampState();
    }
}

// Display camp information
function displayCampInfo() {
    if (!currentCamp) {
        displayNoCampState();
        return;
    }
    
    const campDate = currentCamp.date ? currentCamp.date.toDate().toLocaleDateString() : 'Unknown date';
    const sponsorName = currentSponsor ? currentSponsor.name : 'Unknown Sponsor';
    
    document.getElementById('campCard').innerHTML = `
        <h3>🏥 Current Camp</h3>
        <div class="camp-detail">
            <label>Camp Name</label>
            <span>${currentCamp.name}</span>
        </div>
        <div class="camp-detail">
            <label>Sponsor</label>
            <span>${sponsorName}</span>
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
                ${currentCamp.status || 'Active'}
            </span>
        </div>
    `;
}

// Display no camp state
function displayNoCampState() {
    document.getElementById('campCard').innerHTML = `
        <div class="no-camp-state">
            <h3>⚠️ No Active Camp</h3>
            <p>Please ensure there is an active camp for consultations</p>
        </div>
    `;
}

// Update doctor statistics
async function updateDoctorStatistics() {
    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        // Get all patient visits and filter in JavaScript
        const allVisits = await db.collection('patient_visits').get();
        
        let todayConsultationsCount = 0;
        let pendingConsultationsCount = 0;
        
        allVisits.forEach(doc => {
            const visit = doc.data();
            
            // Count today's completed consultations
            if (visit.journeyStatus?.doctor?.status === 'completed' && 
                visit.journeyStatus?.doctor?.timestamp) {
                const consultationDate = visit.journeyStatus.doctor.timestamp.toDate();
                if (consultationDate >= todayStart && consultationDate < todayEnd) {
                    todayConsultationsCount++;
                }
            }
            
            // Count pending consultations (vitals completed but doctor pending)
            if (visit.journeyStatus?.vitals?.status === 'completed' &&
                visit.journeyStatus?.doctor?.status === 'pending') {
                pendingConsultationsCount++;
            }
        });
        
        doctorStats.today = todayConsultationsCount;
        doctorStats.pending = pendingConsultationsCount;
        
        // Update UI
        document.getElementById('todayConsultations').textContent = doctorStats.today;
        document.getElementById('pendingConsultations').textContent = doctorStats.pending;
        
        console.log('Doctor statistics updated:', doctorStats);
        
    } catch (error) {
        console.error('Error updating statistics:', error);
        document.getElementById('todayConsultations').textContent = '0';
        document.getElementById('pendingConsultations').textContent = '0';
    }
}

// Load patients ready for consultation
async function loadReadyPatients() {
    console.log('Loading patients ready for consultation...');
    try {
        const readyContainer = document.getElementById('readyPatientsList');
        readyContainer.innerHTML = '<div class="loading">Loading patients...</div>';
        
        // Get all patient visits and filter for those ready for doctor consultation
        const visitsSnapshot = await db.collection('patient_visits').get();
        
        const readyPatients = [];
        
        // Process visits and find those ready for doctor consultation
        for (const visitDoc of visitsSnapshot.docs) {
            const visit = visitDoc.data();
            
            // Check if vitals are completed and doctor is pending
            if (visit.journeyStatus?.vitals?.status === 'completed' &&
                visit.journeyStatus?.doctor?.status === 'pending') {
                
                // Get patient details
                try {
                    const patientDoc = await db.collection('patients').doc(visit.patientId).get();
                    if (patientDoc.exists) {
                        const patientData = patientDoc.data();
                        readyPatients.push({
                            visitId: visitDoc.id,
                            patientId: visit.patientId,
                            patient: patientData,
                            visit: visit
                        });
                    }
                } catch (patientError) {
                    console.error('Error loading patient details:', patientError);
                }
            }
        }
        
        console.log(`Found ${readyPatients.length} patients ready for consultation`);
        
        if (readyPatients.length === 0) {
            readyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🩺</div>
                    <p>No patients ready for consultation</p>
                    <small>Patients need to complete vitals first</small>
                </div>
            `;
            return;
        }
        
        // Sort by most recent vitals completion
        readyPatients.sort((a, b) => {
            const aTime = a.visit.journeyStatus?.vitals?.timestamp?.toDate()?.getTime() || 0;
            const bTime = b.visit.journeyStatus?.vitals?.timestamp?.toDate()?.getTime() || 0;
            return bTime - aTime; // Most recent first
        });
        
        // Display ready patients
        readyContainer.innerHTML = readyPatients.slice(0, 8).map(item => {
            const patient = item.patient;
            const vitalsTime = item.visit.journeyStatus?.vitals?.timestamp?.toDate();
            const timeStr = vitalsTime ? vitalsTime.toLocaleTimeString() : 'Unknown time';
            
            return `
                <div class="ready-patient-item" onclick="selectPatientFromReady('${item.patientId}', '${patient.registrationNo}')">
                    <h5>${patient.name || 'Unknown Name'}</h5>
                    <p class="patient-reg-no">${patient.registrationNo || 'No Reg Number'}</p>
                    <p><strong>Age:</strong> ${patient.age || 'N/A'} | <strong>Gender:</strong> ${patient.sex || 'N/A'}</p>
                    <p><strong>Vitals completed:</strong> ${timeStr}</p>
                </div>
            `;
        }).join('');
        
        console.log('Ready patients loaded successfully');
        
    } catch (error) {
        console.error('Error loading ready patients:', error);
        document.getElementById('readyPatientsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p>Error loading patients</p>
                <small>Check console for details</small>
            </div>
        `;
    }
}

// Select patient from ready list
async function selectPatientFromReady(patientId, regNumber) {
    console.log('Selecting patient from ready list:', patientId, regNumber);
    await selectPatient(patientId, regNumber);
}

// Search patients
async function searchPatients() {
    const searchTerm = document.getElementById('searchInput').value.trim().toUpperCase();
    if (!searchTerm) {
        showAlert('Please enter a search term', 'warning');
        return;
    }
    
    document.getElementById('searchResultsSection').style.display = 'block';
    const resultsContainer = document.getElementById('searchResultsList');
    resultsContainer.innerHTML = '<div class="loading">Searching patients...</div>';
    
    try {
        showAlert('Searching for patients...', 'info');
        
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
                if (!allPatients.find(p => p.id === patient.id)) {
                    allPatients.push(patient);
                }
            });
        }
        
        // Search by name (partial match)
        if (searchTerm.length >= 3 && !/^\d+$/.test(searchTerm)) {
            console.log('Searching by name:', searchTerm);
            const allPatientsQuery = await db.collection('patients').get();
            
            allPatientsQuery.forEach(doc => {
                const patient = doc.data();
                const patientName = patient.name ? patient.name.toUpperCase() : '';
                
                if (patientName.includes(searchTerm)) {
                    const patientWithMatch = { id: doc.id, ...patient, matchType: 'Name' };
                    if (!allPatients.find(p => p.id === patientWithMatch.id)) {
                        allPatients.push(patientWithMatch);
                    }
                }
            });
        }
        
        console.log('Search results:', allPatients.length, 'patients found');
        
        if (allPatients.length === 0) {
            resultsContainer.innerHTML = `
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
        resultsContainer.innerHTML = allPatients.map(patient => `
            <div class="search-result-item" onclick="selectPatientFromSearch('${patient.id}', '${patient.registrationNo}')">
                <h5>${patient.name}</h5>
                <p class="patient-reg-no">${patient.registrationNo}</p>
                <p><strong>Phone:</strong> ${patient.phone}</p>
                <p><strong>Age:</strong> ${patient.age} | <strong>Gender:</strong> ${patient.sex}</p>
                <p><strong>Match:</strong> <span style="color: var(--doctor-purple); font-weight: 600;">${patient.matchType}</span></p>
            </div>
        `).join('');
        
        if (allPatients.length === 1) {
            await selectPatientFromSearch(allPatients[0].id, allPatients[0].registrationNo);
            showAlert('Patient found and selected automatically', 'success');
        } else {
            showAlert(`Found ${allPatients.length} patients matching your search`, 'success');
        }
        
    } catch (error) {
        console.error('Error searching patients:', error);
        showAlert('Failed to search patients', 'error');
        resultsContainer.innerHTML = `
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
    console.log('Selecting patient from search:', patientId, regNumber);
    await selectPatient(patientId, regNumber);
}

// Select patient (common function)
async function selectPatient(patientId, regNumber) {
    try {
        console.log('Selecting patient:', patientId);
        
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
            .get();
        
        if (visitQuery.empty) {
            showAlert('No visit record found for this patient', 'error');
            return;
        }
        
        // Get the most recent visit
        const visits = visitQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        visits.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
        });
        
        currentVisit = visits[0];
        
        // Check if vitals are completed
        if (currentVisit.journeyStatus?.vitals?.status !== 'completed') {
            showAlert('Patient has not completed vitals yet', 'warning');
            return;
        }
        
        // Check if consultation already completed
        if (currentVisit.journeyStatus?.doctor?.status === 'completed') {
            showAlert('Consultation already completed for this patient', 'warning');
            displayPatientInfo();
            loadPreviousConsultations();
            return;
        }
        
        // Display patient information and show form
        displayPatientInfo();
        showConsultationForm();
        
        showAlert('Patient selected successfully', 'success');
        
    } catch (error) {
        console.error('Error selecting patient:', error);
        showAlert('Failed to select patient', 'error');
    }
}

// Display patient information
function displayPatientInfo() {
    const patientInfoCard = document.getElementById('patientInfoCard');
    
    document.getElementById('patientName').textContent = currentPatient.name || 'Unknown';
    document.getElementById('patientRegNo').textContent = currentPatient.registrationNo || 'N/A';
    document.getElementById('patientAge').textContent = `${currentPatient.age || 'N/A'} years`;
    document.getElementById('patientGender').textContent = currentPatient.sex || 'N/A';
    document.getElementById('patientPhone').textContent = currentPatient.phone || 'N/A';
    document.getElementById('presentComplaint').textContent = currentVisit.presentComplaint || 'Not specified';
    
    // Display vitals information
    displayVitalsInfo();
    
    patientInfoCard.style.display = 'block';
    
    // Update completion status
    const completionStatus = document.getElementById('completionStatus');
    if (currentVisit.journeyStatus?.doctor?.status === 'completed') {
        completionStatus.innerHTML = `
            <span class="status-icon">✅</span>
            <span class="status-text">Consultation Completed</span>
        `;
        completionStatus.className = 'completion-status completed';
    } else {
        completionStatus.innerHTML = `
            <span class="status-icon">📝</span>
            <span class="status-text">Consultation in Progress</span>
        `;
        completionStatus.className = 'completion-status ready';
    }
}

// Display vitals information
function displayVitalsInfo() {
    const vitalsDisplay = document.getElementById('vitalsDisplay');
    
    if (!currentVisit.vitals) {
        vitalsDisplay.innerHTML = '<div class="empty-state"><p>No vitals data available</p></div>';
        return;
    }
    
    const vitals = currentVisit.vitals;
    
    vitalsDisplay.innerHTML = `
        <div class="vitals-display">
            <div class="vital-item">
                <div class="vital-value">${vitals.bp || 'N/A'}</div>
                <div class="vital-label">Blood Pressure</div>
            </div>
            <div class="vital-item">
                <div class="vital-value">${vitals.heartRate || 'N/A'}</div>
                <div class="vital-label">Heart Rate (BPM)</div>
            </div>
            <div class="vital-item">
                <div class="vital-value">${vitals.temperature || 'N/A'}°F</div>
                <div class="vital-label">Temperature</div>
            </div>
            <div class="vital-item">
                <div class="vital-value">${vitals.height || 'N/A'} cm</div>
                <div class="vital-label">Height</div>
            </div>
            <div class="vital-item">
                <div class="vital-value">${vitals.weight || 'N/A'} kg</div>
                <div class="vital-label">Weight</div>
            </div>
            <div class="vital-item">
                <div class="vital-value">${vitals.bmi || 'N/A'}</div>
                <div class="vital-label">BMI</div>
            </div>
            ${vitals.primarySymptoms ? `
                <div class="vital-item" style="grid-column: 1 / -1;">
                    <div class="vital-label">Primary Symptoms</div>
                    <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-medium);">
                        ${vitals.primarySymptoms}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Show consultation form
function showConsultationForm() {
    const consultationFormCard = document.getElementById('consultationFormCard');
    
    // Pre-populate symptoms from vitals if available
    if (currentVisit.vitals?.primarySymptoms) {
        document.getElementById('symptoms').value = currentVisit.vitals.primarySymptoms;
    }
    
    if (currentVisit.journeyStatus?.doctor?.status === 'completed') {
        // Load existing consultation data
        if (currentVisit.consultation) {
            populateConsultationForm(currentVisit.consultation);
        }
        
        // Disable form
        const form = document.getElementById('consultationForm');
        const inputs = form.querySelectorAll('input, textarea, select, button[type="submit"]');
        inputs.forEach(input => {
            if (input.type !== 'button' && input.id !== 'clearConsultationBtn') {
                input.disabled = true;
            }
        });
    }
    
    consultationFormCard.style.display = 'block';
    document.getElementById('noPatientState').style.display = 'none';
}

// Populate consultation form with existing data
function populateConsultationForm(consultationData) {
    document.getElementById('symptoms').value = consultationData.symptoms || '';
    document.getElementById('diagnosis').value = consultationData.diagnosis || '';
    document.getElementById('prescription').value = consultationData.prescription || '';
    document.getElementById('instructions').value = consultationData.instructions || '';
    document.getElementById('followUp').value = consultationData.followUp || 'none';
    document.getElementById('notes').value = consultationData.notes || '';
}

// Handle consultation form submission
async function handleConsultationSubmit(e) {
    e.preventDefault();
    
    if (!currentPatient || !currentVisit) {
        showAlert('Please select a patient first', 'warning');
        return;
    }
    
    if (!validateConsultationForm()) {
        return;
    }
    
    const submitBtn = document.getElementById('saveConsultationBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    try {
        const formData = new FormData(e.target);
        
        // Prepare consultation data
        const consultationData = {
            symptoms: formData.get('symptoms').trim(),
            diagnosis: formData.get('diagnosis').trim(),
            prescription: formData.get('prescription').trim(),
            instructions: formData.get('instructions').trim(),
            followUp: formData.get('followUp'),
            notes: formData.get('notes').trim(),
            consultedAt: firebase.firestore.Timestamp.now(),
            consultedBy: 'doctor-user' // Replace with actual user ID
        };
        
        // Update patient visit record
        const updateData = {
            consultation: consultationData,
            'journeyStatus.doctor.status': 'completed',
            'journeyStatus.doctor.timestamp': firebase.firestore.Timestamp.now(),
            'journeyStatus.doctor.by': 'doctor-user',
            'journeyStatus.pharmacy.status': 'pending',
            updatedAt: firebase.firestore.Timestamp.now()
        };
        
        await db.collection('patient_visits').doc(currentVisit.id).update(updateData);
        
        // Update current visit object
        currentVisit = { ...currentVisit, ...updateData };
        
        // Show success modal
        document.getElementById('successModal').style.display = 'block';
        
        // Update statistics
        await updateDoctorStatistics();
        
        // Refresh ready patients list
        await loadReadyPatients();
        
        showAlert('Consultation completed successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving consultation:', error);
        showAlert('Failed to save consultation: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Validate consultation form
function validateConsultationForm() {
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    // Validate required fields
    const requiredFields = ['symptoms', 'diagnosis', 'prescription'];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showFieldError(fieldId, 'This field is required');
            isValid = false;
        }
    });
    
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

// Clear consultation form
function clearConsultationForm() {
    document.getElementById('consultationForm').reset();
    
    // Clear all errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    // Re-enable form if it was disabled
    const form = document.getElementById('consultationForm');
    const inputs = form.querySelectorAll('input, textarea, select, button');
    inputs.forEach(input => {
        input.disabled = false;
    });
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsSection').style.display = 'none';
}

// Clear patient selection
function clearPatientSelection() {
    currentPatient = null;
    currentVisit = null;
    
    document.getElementById('patientInfoCard').style.display = 'none';
    document.getElementById('consultationFormCard').style.display = 'none';
    document.getElementById('noPatientState').style.display = 'block';
    
    clearConsultationForm();
    clearSearch();
}

// Load previous consultations (for reference)
async function loadPreviousConsultations() {
    try {
        if (!currentPatient) return;
        
        console.log('Loading previous consultations for patient:', currentPatient.id);
        
        // Get all visits for this patient with completed consultations
        const visitsQuery = await db.collection('patient_visits')
            .where('patientId', '==', currentPatient.id)
            .get();
        
        const consultationHistory = visitsQuery.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(visit => visit.journeyStatus?.doctor?.status === 'completed')
            .sort((a, b) => {
                const aTime = a.journeyStatus?.doctor?.timestamp?.toDate()?.getTime() || 0;
                const bTime = b.journeyStatus?.doctor?.timestamp?.toDate()?.getTime() || 0;
                return bTime - aTime;
            });
        
        console.log(`Found ${consultationHistory.length} previous consultations`);
        
    } catch (error) {
        console.error('Error loading previous consultations:', error);
    }
}

// Refresh all data
async function refreshAllData() {
    try {
        showAlert('Refreshing data...', 'info');
        await loadCurrentCamp();
        await updateDoctorStatistics();
        await loadReadyPatients();
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

// Console log for debugging
console.log('Doctor dashboard script loaded successfully');
console.log('Firebase config:', firebaseConfig);
console.log('Firebase initialized:', firebase.apps.length > 0);