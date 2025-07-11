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
let doctorStats = { ready: 0, completedToday: 0, total: 0 };

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    console.log('=== Doctor Dashboard initializing ===');
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
    // Patient lookup functionality
    document.getElementById('lookupBtn').addEventListener('click', lookupPatient);
    document.getElementById('clearLookupBtn').addEventListener('click', clearLookup);
    document.getElementById('patientLookupInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            lookupPatient();
        }
    });
    
    // Consultation form functionality
    document.getElementById('consultationFormElement').addEventListener('submit', handleConsultationSubmit);
    document.getElementById('clearConsultationBtn').addEventListener('click', clearConsultationForm);
    
    // Refresh functionality
    document.getElementById('refreshDataBtn').addEventListener('click', refreshAllData);
    
    // Modal functionality
    document.getElementById('continueBtn').addEventListener('click', function() {
        document.getElementById('consultationSuccessModal').style.display = 'none';
        clearPatientSelection();
    });
    
    // Input formatting
    document.getElementById('patientLookupInput').addEventListener('input', function(e) {
        e.target.value = e.target.value.toUpperCase();
    });
}

// Load current active camp
async function loadCurrentCamp() {
    try {
        // Check for selected camp in localStorage (from registration flow)
        const selectedCampId = localStorage.getItem('selectedCampId');
        if (selectedCampId) {
            const campDoc = await db.collection('camps').doc(selectedCampId).get();
            if (campDoc.exists) {
                currentCamp = { id: campDoc.id, ...campDoc.data() };
                
                // Load sponsor information
                if (currentCamp.sponsorId) {
                    const sponsorDoc = await db.collection('sponsors').doc(currentCamp.sponsorId).get();
                    if (sponsorDoc.exists) {
                        currentSponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
                    }
                }
                
                displayCampInfo();
                return;
            }
        }
        
        // Fallback: Find any active camp
        const campsRef = db.collection('camps');
        const activeCamps = await campsRef.where('status', '==', 'active').get();
        
        if (!activeCamps.empty) {
            const campDoc = activeCamps.docs[0];
            currentCamp = { id: campDoc.id, ...campDoc.data() };
            
            // Load sponsor information
            if (currentCamp.sponsorId) {
                const sponsorDoc = await db.collection('sponsors').doc(currentCamp.sponsorId).get();
                if (sponsorDoc.exists) {
                    currentSponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
                }
            }
            
            displayCampInfo();
        } else {
            displayNoCampState();
        }
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
            <h3>⚠️ No Active Camp Found</h3>
            <p>No active camp available for consultations</p>
        </div>
    `;
}

// Update doctor statistics - using simple queries and client-side filtering
async function updateDoctorStatistics() {
    try {
        if (!currentCamp) {
            updateStatisticsUI(0, 0, 0);
            return;
        }
        
        // Get all patient visits for current camp (simple query)
        const visitsSnapshot = await db.collection('patient_visits')
            .where('campId', '==', currentCamp.id)
            .get();
        
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        let readyCount = 0;
        let completedTodayCount = 0;
        let totalConsultations = 0;
        
        // Filter in JavaScript to avoid composite index requirements
        visitsSnapshot.forEach(doc => {
            const visit = doc.data();
            const journeyStatus = visit.journeyStatus;
            
            // Count patients ready for doctor (vitals completed, doctor pending)
            if (journeyStatus?.vitals?.status === 'completed' &&
                journeyStatus?.doctor?.status === 'pending') {
                readyCount++;
            }
            
            // Count consultations completed today
            if (journeyStatus?.doctor?.status === 'completed' &&
                journeyStatus?.doctor?.timestamp) {
                const consultationDate = journeyStatus.doctor.timestamp.toDate();
                if (consultationDate >= todayStart && consultationDate < todayEnd) {
                    completedTodayCount++;
                }
                totalConsultations++;
            }
        });
        
        doctorStats.ready = readyCount;
        doctorStats.completedToday = completedTodayCount;
        doctorStats.total = totalConsultations;
        
        updateStatisticsUI(readyCount, completedTodayCount, totalConsultations);
        
    } catch (error) {
        console.error('Error updating statistics:', error);
        updateStatisticsUI(0, 0, 0);
    }
}

// Update statistics UI
function updateStatisticsUI(ready, completedToday, total) {
    document.getElementById('readyPatients').textContent = ready;
    document.getElementById('completedToday').textContent = completedToday;
    document.getElementById('totalConsultations').textContent = total;
}

// Load patients ready for consultation - using simple query and client-side filtering
async function loadReadyPatients() {
    try {
        const readyContainer = document.getElementById('readyPatientsList');
        readyContainer.innerHTML = '<div class="loading">Loading patients ready for consultation...</div>';
        
        if (!currentCamp) {
            readyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏥</div>
                    <h3>No Active Camp</h3>
                    <p>No active camp available for consultations</p>
                </div>
            `;
            return;
        }
        
        // Get all patient visits for current camp (simple query)
        const visitsSnapshot = await db.collection('patient_visits')
            .where('campId', '==', currentCamp.id)
            .get();
        
        if (visitsSnapshot.empty) {
            readyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No Patient Visits</h3>
                    <p>No patient visits found for this camp</p>
                </div>
            `;
            return;
        }
        
        // Filter visits for patients ready for consultation
        const readyVisits = [];
        visitsSnapshot.forEach(doc => {
            const visit = doc.data();
            const journeyStatus = visit.journeyStatus;
            
            // Patient is ready if vitals completed and doctor consultation pending
            if (journeyStatus?.vitals?.status === 'completed' &&
                journeyStatus?.doctor?.status === 'pending') {
                readyVisits.push({ id: doc.id, ...visit });
            }
        });
        
        if (readyVisits.length === 0) {
            readyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⏳</div>
                    <h3>No Patients Ready</h3>
                    <p>No patients ready for consultation at this time</p>
                    <small>Patients need to complete vitals first</small>
                </div>
            `;
            return;
        }
        
        // Load patient details for each ready visit
        const readyPatientsWithDetails = [];
        for (const visit of readyVisits) {
            try {
                const patientDoc = await db.collection('patients').doc(visit.patientId).get();
                if (patientDoc.exists) {
                    const patientData = patientDoc.data();
                    readyPatientsWithDetails.push({
                        visit: visit,
                        patient: { id: patientDoc.id, ...patientData }
                    });
                }
            } catch (error) {
                console.error('Error loading patient details:', error);
            }
        }
        
        // Sort by visit date (newest first)
        readyPatientsWithDetails.sort((a, b) => {
            const aTime = a.visit.visitDate ? a.visit.visitDate.toDate().getTime() : 0;
            const bTime = b.visit.visitDate ? b.visit.visitDate.toDate().getTime() : 0;
            return bTime - aTime;
        });
        
        // Display ready patients
        readyContainer.innerHTML = readyPatientsWithDetails.map(item => {
            const patient = item.patient;
            const visit = item.visit;
            const vitalsTime = visit.journeyStatus?.vitals?.timestamp ? 
                visit.journeyStatus.vitals.timestamp.toDate().toLocaleTimeString() : 'Unknown time';
            
            return `
                <div class="patient-item" onclick="selectPatientForConsultation('${patient.id}', '${visit.id}')">
                    <h4>${patient.name}</h4>
                    <p><strong>Reg No:</strong> <span class="reg-number">${patient.registrationNo}</span></p>
                    <p><strong>Age:</strong> ${patient.age} | <strong>Gender:</strong> ${patient.sex}</p>
                    <p><strong>Phone:</strong> ${patient.phone}</p>
                    <p><strong>Vitals Completed:</strong> ${vitalsTime}</p>
                    <p><strong>Present Complaint:</strong> ${visit.presentComplaint || 'Not specified'}</p>
                </div>
            `;
        }).join('');
        
        console.log(`Loaded ${readyPatientsWithDetails.length} patients ready for consultation`);
        
    } catch (error) {
        console.error('Error loading ready patients:', error);
        document.getElementById('readyPatientsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Error Loading Patients</h3>
                <p>Error loading ready patients: ${error.message}</p>
                <button onclick="loadReadyPatients()" class="btn-primary" style="margin-top: 1rem;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Select patient for consultation
async function selectPatientForConsultation(patientId, visitId) {
    try {
        showAlert('Loading patient details...', 'info');
        
        // Load patient data
        const patientDoc = await db.collection('patients').doc(patientId).get();
        if (!patientDoc.exists) {
            showAlert('Patient not found', 'error');
            return;
        }
        
        // Load visit data
        const visitDoc = await db.collection('patient_visits').doc(visitId).get();
        if (!visitDoc.exists) {
            showAlert('Visit record not found', 'error');
            return;
        }
        
        currentPatient = { id: patientDoc.id, ...patientDoc.data() };
        currentVisit = { id: visitDoc.id, ...visitDoc.data() };
        
        // Display patient information
        displayPatientInfo();
        
        // Show consultation form
        document.getElementById('patientDetailsSection').style.display = 'block';
        
        // Load previous consultations
        await loadPreviousConsultations();
        
        // Scroll to patient details
        document.getElementById('patientDetailsSection').scrollIntoView({ behavior: 'smooth' });
        
        showAlert('Patient selected for consultation', 'success');
        
    } catch (error) {
        console.error('Error selecting patient:', error);
        showAlert('Failed to select patient', 'error');
    }
}

// Display patient information
function displayPatientInfo() {
    if (!currentPatient || !currentVisit) return;
    
    const vitalsData = currentVisit.vitals || {};
    const vitalsTime = currentVisit.journeyStatus?.vitals?.timestamp ? 
        currentVisit.journeyStatus.vitals.timestamp.toDate().toLocaleString() : 'Unknown';
    
    document.getElementById('patientInfo').innerHTML = `
        <div class="patient-detail">
            <label>Name</label>
            <span>${currentPatient.name}</span>
        </div>
        <div class="patient-detail">
            <label>Registration Number</label>
            <span class="reg-number">${currentPatient.registrationNo}</span>
        </div>
        <div class="patient-detail">
            <label>Age</label>
            <span>${currentPatient.age} years</span>
        </div>
        <div class="patient-detail">
            <label>Gender</label>
            <span>${currentPatient.sex}</span>
        </div>
        <div class="patient-detail">
            <label>Phone</label>
            <span>${currentPatient.phone}</span>
        </div>
        <div class="patient-detail">
            <label>Category</label>
            <span>${currentPatient.category}</span>
        </div>
        <div class="patient-detail">
            <label>Present Complaint</label>
            <span>${currentVisit.presentComplaint || 'Not specified'}</span>
        </div>
        <div class="patient-detail">
            <label>Current Treatment</label>
            <span>${currentVisit.currentTreatment || 'None specified'}</span>
        </div>
        <div class="patient-detail">
            <label>Vitals Completed</label>
            <span>${vitalsTime}</span>
        </div>
        <div class="patient-detail">
            <label>Blood Pressure</label>
            <span>${vitalsData.bp || 'N/A'}</span>
        </div>
        <div class="patient-detail">
            <label>Heart Rate</label>
            <span>${vitalsData.heartRate || 'N/A'} BPM</span>
        </div>
        <div class="patient-detail">
            <label>Temperature</label>
            <span>${vitalsData.temperature || 'N/A'}°F</span>
        </div>
        <div class="patient-detail">
            <label>BMI</label>
            <span>${vitalsData.bmi || 'N/A'}</span>
        </div>
        <div class="patient-detail">
            <label>Primary Symptoms</label>
            <span>${vitalsData.primarySymptoms || 'Not specified'}</span>
        </div>
    `;
}

// Lookup patient functionality
async function lookupPatient() {
    const searchTerm = document.getElementById('patientLookupInput').value.trim().toUpperCase();
    if (!searchTerm) {
        showAlert('Please enter a search term', 'warning');
        return;
    }
    
    if (!currentCamp) {
        showAlert('No active camp available', 'warning');
        return;
    }
    
    try {
        showAlert('Searching for patient...', 'info');
        
        const resultsContainer = document.getElementById('lookupResults');
        resultsContainer.innerHTML = '<div class="loading">Searching patients...</div>';
        
        // Get all patients for current camp (simple query)
        const patientsSnapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        let matchingPatients = [];
        
        // Filter in JavaScript to avoid composite index requirements
        patientsSnapshot.forEach(doc => {
            const patient = { id: doc.id, ...doc.data() };
            
            // Search by registration number (exact match)
            if (patient.registrationNo === searchTerm) {
                matchingPatients.push({ ...patient, matchType: 'Registration Number' });
                return;
            }
            
            // Search by phone number (exact match)
            if (patient.phone === searchTerm) {
                matchingPatients.push({ ...patient, matchType: 'Phone Number' });
                return;
            }
            
            // Search by name (partial match)
            if (searchTerm.length >= 3 && patient.name.toUpperCase().includes(searchTerm)) {
                matchingPatients.push({ ...patient, matchType: 'Name' });
                return;
            }
        });
        
        if (matchingPatients.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Patients Found</h3>
                    <p>No patients found matching "${searchTerm}"</p>
                </div>
            `;
            showAlert('No patients found', 'warning');
            return;
        }
        
        // For each matching patient, check if they need consultation
        const consultationCandidates = [];
        for (const patient of matchingPatients) {
            try {
                // Use single-field query and filter in JavaScript
                const visitsSnapshot = await db.collection('patient_visits')
                    .where('patientId', '==', patient.id)
                    .get();
                
                // Filter for current camp in JavaScript
                const campVisits = [];
                visitsSnapshot.forEach(doc => {
                    const visit = doc.data();
                    if (visit.campId === currentCamp.id) {
                        campVisits.push({ id: doc.id, ...visit });
                    }
                });
                
                if (campVisits.length > 0) {
                    const visit = campVisits[0];
                    consultationCandidates.push({
                        patient: patient,
                        visit: visit,
                        canConsult: visit.journeyStatus?.vitals?.status === 'completed'
                    });
                }
            } catch (error) {
                console.error('Error checking patient visit:', error);
            }
        }
        
        // Display results
        resultsContainer.innerHTML = consultationCandidates.map(item => {
            const patient = item.patient;
            const visit = item.visit;
            const canConsult = item.canConsult;
            
            return `
                <div class="patient-item ${canConsult ? '' : 'disabled'}" 
                     onclick="${canConsult ? `selectPatientForConsultation('${patient.id}', '${visit.id}')` : ''}">
                    <h4>${patient.name}</h4>
                    <p><strong>Reg No:</strong> <span class="reg-number">${patient.registrationNo}</span></p>
                    <p><strong>Age:</strong> ${patient.age} | <strong>Gender:</strong> ${patient.sex}</p>
                    <p><strong>Phone:</strong> ${patient.phone}</p>
                    <p><strong>Match:</strong> ${patient.matchType}</p>
                    <p><strong>Status:</strong> ${canConsult ? 
                        '<span style="color: var(--success-green);">Ready for Consultation</span>' : 
                        '<span style="color: var(--warning-orange);">Waiting for Vitals</span>'}</p>
                </div>
            `;
        }).join('');
        
        showAlert(`Found ${consultationCandidates.length} patient(s)`, 'success');
        
    } catch (error) {
        console.error('Error looking up patient:', error);
        showAlert('Failed to search patients', 'error');
    }
}

// Clear lookup
function clearLookup() {
    document.getElementById('patientLookupInput').value = '';
    document.getElementById('lookupResults').innerHTML = '';
}

// Handle consultation form submission
async function handleConsultationSubmit(e) {
    e.preventDefault();
    
    if (!currentPatient || !currentVisit) {
        showAlert('Please select a patient first', 'warning');
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
            diagnosis: formData.get('diagnosis').trim(),
            symptoms: formData.get('symptoms').trim(),
            treatment: formData.get('treatment').trim(),
            medications: formData.get('medications').trim(),
            followUp: formData.get('followUp').trim(),
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
            'journeyStatus.pharmacy.status': 'pending', // Ready for pharmacy
            updatedAt: firebase.firestore.Timestamp.now()
        };
        
        await db.collection('patient_visits').doc(currentVisit.id).update(updateData);
        
        // Show success modal
        document.getElementById('consultationSuccessModal').style.display = 'block';
        
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

// Clear consultation form
function clearConsultationForm() {
    document.getElementById('consultationFormElement').reset();
}

// Clear patient selection
function clearPatientSelection() {
    currentPatient = null;
    currentVisit = null;
    document.getElementById('patientDetailsSection').style.display = 'none';
    document.getElementById('previousConsultationsSection').style.display = 'none';
    clearConsultationForm();
}

// Load previous consultations for patient
async function loadPreviousConsultations() {
    try {
        if (!currentPatient) return;
        
        const historyContainer = document.getElementById('previousConsultations');
        historyContainer.innerHTML = '<div class="loading">Loading previous consultations...</div>';
        
        // Get all visits for this patient (simple query)
        const visitsSnapshot = await db.collection('patient_visits')
            .where('patientId', '==', currentPatient.id)
            .get();
        
        if (visitsSnapshot.empty) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📈</div>
                    <h3>No Previous Consultations</h3>
                    <p>No previous consultations found for this patient</p>
                </div>
            `;
            return;
        }
        
        // Filter for completed consultations and sort in JavaScript
        const completedConsultations = [];
        visitsSnapshot.forEach(doc => {
            const visit = doc.data();
            if (visit.journeyStatus?.doctor?.status === 'completed' && visit.consultation) {
                completedConsultations.push({
                    id: doc.id,
                    ...visit,
                    consultationDate: visit.journeyStatus.doctor.timestamp
                });
            }
        });
        
        if (completedConsultations.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📈</div>
                    <h3>No Previous Consultations</h3>
                    <p>No previous consultations found for this patient</p>
                </div>
            `;
            return;
        }
        
        // Sort by consultation date (newest first)
        completedConsultations.sort((a, b) => {
            const aTime = a.consultationDate ? a.consultationDate.toDate().getTime() : 0;
            const bTime = b.consultationDate ? b.consultationDate.toDate().getTime() : 0;
            return bTime - aTime;
        });
        
        // Display consultations
        const consultationsHTML = completedConsultations.slice(0, 5).map(visit => {
            const consultation = visit.consultation;
            const consultationDate = visit.consultationDate.toDate();
            
            return `
                <div class="consultation-item">
                    <div class="consultation-header">
                        <span class="consultation-date">${consultationDate.toLocaleDateString()} ${consultationDate.toLocaleTimeString()}</span>
                        <span class="consultation-doctor">by ${visit.journeyStatus.doctor.by}</span>
                    </div>
                    <div class="consultation-detail">
                        <label>Diagnosis:</label>
                        <span>${consultation.diagnosis}</span>
                    </div>
                    <div class="consultation-detail">
                        <label>Treatment:</label>
                        <span>${consultation.treatment || 'Not specified'}</span>
                    </div>
                    <div class="consultation-detail">
                        <label>Medications:</label>
                        <span>${consultation.medications || 'Not specified'}</span>
                    </div>
                    <div class="consultation-detail">
                        <label>Follow-up:</label>
                        <span>${consultation.followUp || 'Not specified'}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        historyContainer.innerHTML = consultationsHTML;
        document.getElementById('previousConsultationsSection').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading previous consultations:', error);
        document.getElementById('previousConsultations').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Loading Failed</h3>
                <p>Failed to load previous consultations</p>
            </div>
        `;
    }
}

// Refresh all data
async function refreshAllData() {
    try {
        showAlert('Refreshing data...', 'info');
        
        const refreshBtn = document.getElementById('refreshDataBtn');
        const btnText = refreshBtn.querySelector('.btn-text');
        const btnLoading = refreshBtn.querySelector('.btn-loading');
        
        refreshBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        
        await loadCurrentCamp();
        await updateDoctorStatistics();
        await loadReadyPatients();
        
        if (currentPatient) {
            await loadPreviousConsultations();
        }
        
        showAlert('Data refreshed successfully!', 'success');
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        showAlert('Failed to refresh data', 'error');
    } finally {
        const refreshBtn = document.getElementById('refreshDataBtn');
        const btnText = refreshBtn.querySelector('.btn-text');
        const btnLoading = refreshBtn.querySelector('.btn-loading');
        
        refreshBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
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
