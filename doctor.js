// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMNqYb2V90qdPUTCOkW6EiFuCHvI9JT2s",
    authDomain: "smart-attend-d476c.firebaseapp.com",
    projectId: "smart-attend-d476c",
    storageBucket: "smart-attend-d476c.appspot.com",
    messagingSenderId: "834025214336",
    appId: "1:834025214336:web:6e62ddf29f440f68c5f165",
    measurementId: "G-N46BB4YHQ3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let currentCamp = null;
let currentSponsor = null;
let currentPatient = null;
let currentVisit = null;
let availableCamps = [];
let consultationStats = { today: 0, pending: 0 };
let medicineCounter = 1;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    try {
        await loadAvailableCamps();
        const campExists = await checkForSelectedCamp();
        if (!campExists) {
            showCampSelectionModal();
        } else {
            await loadCurrentCamp();
            await loadReadyPatients();
            await updateConsultationStatistics();
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize application', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Camp selection
    document.getElementById('availableCamps').addEventListener('change', handleCampSelection);
    document.getElementById('selectCampBtn').addEventListener('click', handleCampConfirmation);
    document.getElementById('refreshCampsBtn').addEventListener('click', loadAvailableCamps);
    document.getElementById('changeCampBtn').addEventListener('click', showCampSelectionModal);

    // Patient search
    document.getElementById('searchBtn').addEventListener('click', searchPatients);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchPatients();
        }
    });
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);

    // Consultation form
    document.getElementById('consultationForm').addEventListener('submit', handleConsultationSubmit);
    document.getElementById('clearConsultationBtn').addEventListener('click', clearConsultationForm);
    document.getElementById('addMedicineBtn').addEventListener('click', addMedicineField);

    // Follow-up handling
    document.getElementById('followUpRequired').addEventListener('change', handleFollowUpChange);
    document.getElementById('referralRequired').addEventListener('change', handleReferralChange);

    // Modal handling
    document.getElementById('continueBtn').addEventListener('click', function() {
        document.getElementById('successModal').style.display = 'none';
        clearConsultationForm();
        loadReadyPatients();
    });

    // Refresh data
    document.getElementById('refreshDataBtn').addEventListener('click', function() {
        loadReadyPatients();
        updateConsultationStatistics();
    });

    // Close modal on outside click
    window.addEventListener('click', function(event) {
        const campModal = document.getElementById('campSelectionModal');
        const successModal = document.getElementById('successModal');
        
        if (event.target === campModal) {
            campModal.style.display = 'none';
        }
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
    });
}

// Load available camps
async function loadAvailableCamps() {
    try {
        const snapshot = await db.collection('camps').get();
        availableCamps = [];
        
        snapshot.forEach(doc => {
            availableCamps.push({
                id: doc.id,
                ...doc.data()
            });
        });

        updateCampDropdown();
    } catch (error) {
        console.error('Error loading camps:', error);
        showAlert('Failed to load camps', 'error');
    }
}

// Update camp dropdown
function updateCampDropdown() {
    const select = document.getElementById('availableCamps');
    select.innerHTML = '<option value="">Select a camp</option>';
    
    availableCamps.forEach(camp => {
        const option = document.createElement('option');
        option.value = camp.id;
        option.textContent = `${camp.name} - ${camp.location}`;
        select.appendChild(option);
    });
}

// Handle camp selection
function handleCampSelection() {
    const selectedCampId = document.getElementById('availableCamps').value;
    const selectedCamp = availableCamps.find(camp => camp.id === selectedCampId);
    
    if (selectedCamp) {
        displayCampInfo(selectedCamp);
        document.getElementById('selectCampBtn').disabled = false;
    } else {
        document.getElementById('selectedCampInfo').style.display = 'none';
        document.getElementById('selectCampBtn').disabled = true;
    }
}

// Display camp information
function displayCampInfo(camp) {
    const campInfo = document.getElementById('selectedCampInfo');
    campInfo.innerHTML = `
        <h5>${camp.name}</h5>
        <div class="camp-info-grid">
            <div class="camp-info-item">
                <div class="camp-info-label">Location</div>
                <div class="camp-info-value">${camp.location}</div>
            </div>
            <div class="camp-info-item">
                <div class="camp-info-label">Date</div>
                <div class="camp-info-value">${formatDate(camp.date)}</div>
            </div>
            <div class="camp-info-item">
                <div class="camp-info-label">Sponsor</div>
                <div class="camp-info-value">${camp.sponsorName || 'N/A'}</div>
            </div>
            <div class="camp-info-item">
                <div class="camp-info-label">Status</div>
                <div class="camp-info-value">${camp.status || 'Active'}</div>
            </div>
        </div>
    `;
    campInfo.style.display = 'block';
}

// Handle camp confirmation
async function handleCampConfirmation() {
    const selectedCampId = document.getElementById('availableCamps').value;
    const selectedCamp = availableCamps.find(camp => camp.id === selectedCampId);
    
    if (selectedCamp) {
        try {
            // Save camp selection to localStorage
            localStorage.setItem('selectedCamp', JSON.stringify(selectedCamp));
            
            // Update current camp
            currentCamp = selectedCamp;
            
            // Load camp details
            await loadCurrentCamp();
            
            // Hide modal
            document.getElementById('campSelectionModal').style.display = 'none';
            
            // Load patients and stats
            await loadReadyPatients();
            await updateConsultationStatistics();
            
            showAlert('Camp selected successfully', 'success');
        } catch (error) {
            console.error('Error selecting camp:', error);
            showAlert('Failed to select camp', 'error');
        }
    }
}

// Check for selected camp
async function checkForSelectedCamp() {
    const savedCamp = localStorage.getItem('selectedCamp');
    if (savedCamp) {
        currentCamp = JSON.parse(savedCamp);
        return true;
    }
    return false;
}

// Load current camp
async function loadCurrentCamp() {
    if (!currentCamp) {
        const savedCamp = localStorage.getItem('selectedCamp');
        if (savedCamp) {
            currentCamp = JSON.parse(savedCamp);
        }
    }
    
    if (currentCamp) {
        displayCurrentCampInfo();
    }
}

// Display current camp information
function displayCurrentCampInfo() {
    const campCard = document.getElementById('campCard');
    campCard.innerHTML = `
        <h3>📍 ${currentCamp.name}</h3>
        <div class="camp-detail">
            <label>Location:</label>
            <span>${currentCamp.location}</span>
        </div>
        <div class="camp-detail">
            <label>Date:</label>
            <span>${formatDate(currentCamp.date)}</span>
        </div>
        <div class="camp-detail">
            <label>Sponsor:</label>
            <span>${currentCamp.sponsorName || 'N/A'}</span>
        </div>
    `;
}

// Show camp selection modal
function showCampSelectionModal() {
    document.getElementById('campSelectionModal').style.display = 'block';
}

// Load patients ready for consultation
async function loadReadyPatients() {
    if (!currentCamp) return;
    
    try {
        const readyPatientsList = document.getElementById('readyPatientsList');
        readyPatientsList.innerHTML = '<div class="loading">Loading patients...</div>';
        
        // Query patients who have completed vitals but not doctor consultation
        const snapshot = await db.collection('patient_visits')
            .where('campId', '==', currentCamp.id)
            .where('journeyStatus.vitals.status', '==', 'completed')
            .where('journeyStatus.doctor.status', '==', 'pending')
            .orderBy('journeyStatus.vitals.completedAt', 'desc')
            .get();
        
        const patients = [];
        for (const doc of snapshot.docs) {
            const visitData = doc.data();
            // Get patient details
            const patientDoc = await db.collection('patients').doc(visitData.patientId).get();
            if (patientDoc.exists) {
                patients.push({
                    visitId: doc.id,
                    ...visitData,
                    patientData: patientDoc.data()
                });
            }
        }
        
        displayReadyPatients(patients);
    } catch (error) {
        console.error('Error loading ready patients:', error);
        showAlert('Failed to load patients', 'error');
    }
}

// Display ready patients
function displayReadyPatients(patients) {
    const readyPatientsList = document.getElementById('readyPatientsList');
    
    if (patients.length === 0) {
        readyPatientsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <h3>No Patients Ready</h3>
                <p>No patients are currently ready for consultation</p>
            </div>
        `;
        return;
    }
    
    readyPatientsList.innerHTML = '';
    
    patients.forEach(patient => {
        const patientItem = document.createElement('div');
        patientItem.className = 'patient-item';
        patientItem.innerHTML = `
            <div class="patient-item-header">
                <div class="patient-name">${patient.patientData.name}</div>
                <div class="patient-reg-no">${patient.patientData.registrationNumber}</div>
            </div>
            <div class="patient-details">
                <span>${patient.patientData.age} years, ${patient.patientData.sex}</span>
                <span>Phone: ${patient.patientData.phone}</span>
            </div>
        `;
        
        patientItem.addEventListener('click', () => selectPatient(patient));
        readyPatientsList.appendChild(patientItem);
    });
}

// Search patients
async function searchPatients() {
    const searchQuery = document.getElementById('searchInput').value.trim();
    if (!searchQuery || !currentCamp) return;
    
    try {
        const searchResultsList = document.getElementById('searchResultsList');
        searchResultsList.innerHTML = '<div class="loading">Searching...</div>';
        
        // Show search results section
        document.getElementById('searchResultsSection').style.display = 'block';
        
        // Search in patients collection
        const snapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        const matchingPatients = [];
        snapshot.forEach(doc => {
            const patient = doc.data();
            const searchLower = searchQuery.toLowerCase();
            
            if (patient.name.toLowerCase().includes(searchLower) ||
                patient.phone.includes(searchQuery) ||
                patient.registrationNumber.toLowerCase().includes(searchLower)) {
                matchingPatients.push({ id: doc.id, ...patient });
            }
        });
        
        displaySearchResults(matchingPatients);
    } catch (error) {
        console.error('Error searching patients:', error);
        showAlert('Failed to search patients', 'error');
    }
}

// Display search results
function displaySearchResults(patients) {
    const searchResultsList = document.getElementById('searchResultsList');
    
    if (patients.length === 0) {
        searchResultsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>No Results Found</h3>
                <p>No patients match your search criteria</p>
            </div>
        `;
        return;
    }
    
    searchResultsList.innerHTML = '';
    
    patients.forEach(patient => {
        const patientItem = document.createElement('div');
        patientItem.className = 'patient-item';
        patientItem.innerHTML = `
            <div class="patient-item-header">
                <div class="patient-name">${patient.name}</div>
                <div class="patient-reg-no">${patient.registrationNumber}</div>
            </div>
            <div class="patient-details">
                <span>${patient.age} years, ${patient.sex}</span>
                <span>Phone: ${patient.phone}</span>
            </div>
        `;
        
        patientItem.addEventListener('click', () => selectPatientById(patient.id));
        searchResultsList.appendChild(patientItem);
    });
}

// Select patient by ID
async function selectPatientById(patientId) {
    try {
        // Get patient data
        const patientDoc = await db.collection('patients').doc(patientId).get();
        if (!patientDoc.exists) {
            showAlert('Patient not found', 'error');
            return;
        }
        
        // Get or create patient visit
        const visitSnapshot = await db.collection('patient_visits')
            .where('patientId', '==', patientId)
            .where('campId', '==', currentCamp.id)
            .limit(1)
            .get();
        
        let visitData;
        if (!visitSnapshot.empty) {
            visitData = { id: visitSnapshot.docs[0].id, ...visitSnapshot.docs[0].data() };
        } else {
            // Create new visit if none exists
            const newVisit = {
                patientId: patientId,
                campId: currentCamp.id,
                visitDate: new Date().toISOString(),
                visitType: 'consultation',
                journeyStatus: {
                    registration: { status: 'completed' },
                    vitals: { status: 'pending' },
                    doctor: { status: 'pending' },
                    pharmacy: { status: 'pending' }
                }
            };
            
            const visitRef = await db.collection('patient_visits').add(newVisit);
            visitData = { id: visitRef.id, ...newVisit };
        }
        
        const patientWithVisit = {
            visitId: visitData.id,
            ...visitData,
            patientData: patientDoc.data()
        };
        
        selectPatient(patientWithVisit);
    } catch (error) {
        console.error('Error selecting patient:', error);
        showAlert('Failed to select patient', 'error');
    }
}

// Select patient
async function selectPatient(patient) {
    currentPatient = patient;
    currentVisit = patient;
    
    // Update UI to show selected patient
    document.querySelectorAll('.patient-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    event.target.closest('.patient-item').classList.add('selected');
    
    // Display patient information
    displayPatientInfo(patient);
    
    // Load patient history
    await loadPatientHistory(patient.patientId);
    
    // Show consultation form
    showConsultationForm();
    
    // Update status
    updatePatientStatus('Selected for consultation');
}

// Display patient information
function displayPatientInfo(patient) {
    const patientInfo = document.getElementById('patientInfo');
    const patientData = patient.patientData;
    
    patientInfo.innerHTML = `
        <div class="patient-basic-info">
            <h3>${patientData.name}</h3>
            <div class="patient-info-grid">
                <div class="info-item">
                    <div class="info-label">Registration Number</div>
                    <div class="info-value">${patientData.registrationNumber}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Age</div>
                    <div class="info-value">${patientData.age} years</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Gender</div>
                    <div class="info-value">${patientData.sex}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${patientData.phone}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Category</div>
                    <div class="info-value">${patientData.category}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Address</div>
                    <div class="info-value">${patientData.address}</div>
                </div>
            </div>
        </div>
    `;
    
    // Add vitals information if available
    if (patient.journeyStatus && patient.journeyStatus.vitals && patient.journeyStatus.vitals.data) {
        const vitals = patient.journeyStatus.vitals.data;
        patientInfo.innerHTML += `
            <div class="patient-vitals">
                <h4>Latest Vitals</h4>
                <div class="vitals-grid">
                    <div class="vital-item">
                        <div class="vital-label">Blood Pressure</div>
                        <div class="vital-value">${vitals.bp || 'N/A'}</div>
                    </div>
                    <div class="vital-item">
                        <div class="vital-label">Heart Rate</div>
                        <div class="vital-value">${vitals.heartRate || 'N/A'} BPM</div>
                    </div>
                    <div class="vital-item">
                        <div class="vital-label">Temperature</div>
                        <div class="vital-value">${vitals.temperature || 'N/A'} °F</div>
                    </div>
                    <div class="vital-item">
                        <div class="vital-label">Height</div>
                        <div class="vital-value">${vitals.height || 'N/A'} cm</div>
                    </div>
                    <div class="vital-item">
                        <div class="vital-label">Weight</div>
                        <div class="vital-value">${vitals.weight || 'N/A'} kg</div>
                    </div>
                    <div class="vital-item">
                        <div class="vital-label">BMI</div>
                        <div class="vital-value">${vitals.bmi || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add present complaint if available
    if (patientData.presentComplaint) {
        patientInfo.innerHTML += `
            <div class="patient-basic-info">
                <h4>Present Complaint</h4>
                <p>${patientData.presentComplaint}</p>
            </div>
        `;
    }
    
    patientInfo.style.display = 'block';
    document.getElementById('noPatientState').style.display = 'none';
}

// Load patient history
async function loadPatientHistory(patientId) {
    try {
        const snapshot = await db.collection('patient_visits')
            .where('patientId', '==', patientId)
            .where('journeyStatus.doctor.status', '==', 'completed')
            .orderBy('visitDate', 'desc')
            .get();
        
        const history = [];
        snapshot.forEach(doc => {
            const visitData = doc.data();
            if (visitData.journeyStatus.doctor.data) {
                history.push(visitData.journeyStatus.doctor.data);
            }
        });
        
        displayPatientHistory(history);
    } catch (error) {
        console.error('Error loading patient history:', error);
        showAlert('Failed to load patient history', 'error');
    }
}

// Display patient history
function displayPatientHistory(history) {
    const historyContainer = document.getElementById('patientHistory');
    
    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h3>No Previous Consultations</h3>
                <p>This patient has no previous consultation history</p>
            </div>
        `;
        return;
    }
    
    historyContainer.innerHTML = '';
    
    history.forEach(consultation => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-header">
                <div class="history-date">${formatDate(consultation.consultationDate)}</div>
                <div class="history-type">Consultation</div>
            </div>
            <div class="history-content">
                <div class="history-diagnosis">
                    <strong>Diagnosis:</strong> ${consultation.primaryDiagnosis}
                </div>
                <div class="history-treatment">
                    <strong>Treatment:</strong> ${consultation.treatmentPlan}
                </div>
                ${consultation.medicines ? `
                    <div class="history-treatment">
                        <strong>Medicines:</strong> ${consultation.medicines.map(med => med.name).join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
        historyContainer.appendChild(historyItem);
    });
}

// Show consultation form
function showConsultationForm() {
    document.getElementById('consultationForm').style.display = 'block';
    document.getElementById('noConsultationState').style.display = 'none';
    
    // Update patient status
    updatePatientStatus('Ready for consultation');
}

// Update patient status
function updatePatientStatus(statusText) {
    const statusElement = document.getElementById('patientStatus');
    statusElement.innerHTML = `
        <span class="status-icon">👨‍⚕️</span>
        <span class="status-text">${statusText}</span>
    `;
}

// Handle follow-up change
function handleFollowUpChange() {
    const followUpRequired = document.getElementById('followUpRequired').value;
    const followUpDate = document.getElementById('followUpDate');
    const followUpType = document.getElementById('followUpType');
    
    if (followUpRequired === 'yes') {
        followUpDate.required = true;
        followUpType.required = true;
        followUpDate.parentElement.style.opacity = '1';
        followUpType.parentElement.style.opacity = '1';
    } else {
        followUpDate.required = false;
        followUpType.required = false;
        followUpDate.parentElement.style.opacity = '0.5';
        followUpType.parentElement.style.opacity = '0.5';
        followUpDate.value = '';
        followUpType.value = '';
    }
}

// Handle referral change
function handleReferralChange() {
    const referralRequired = document.getElementById('referralRequired').value;
    const referralSpecialty = document.getElementById('referralSpecialty');
    const referralUrgency = document.getElementById('referralUrgency');
    const referralReason = document.getElementById('referralReason');
    
    if (referralRequired === 'yes') {
        referralSpecialty.required = true;
        referralUrgency.required = true;
        referralReason.required = true;
        referralSpecialty.parentElement.style.opacity = '1';
        referralUrgency.parentElement.style.opacity = '1';
        referralReason.parentElement.style.opacity = '1';
    } else {
        referralSpecialty.required = false;
        referralUrgency.required = false;
        referralReason.required = false;
        referralSpecialty.parentElement.style.opacity = '0.5';
        referralUrgency.parentElement.style.opacity = '0.5';
        referralReason.parentElement.style.opacity = '0.5';
        referralSpecialty.value = '';
        referralUrgency.value = '';
        referralReason.value = '';
    }
}

// Add medicine field
function addMedicineField() {
    medicineCounter++;
    const medicinesContainer = document.querySelector('.medicines-container');
    
    const medicineItem = document.createElement('div');
    medicineItem.className = 'medicine-item';
    medicineItem.innerHTML = `
        <button type="button" class="remove-medicine" onclick="removeMedicine(this)">×</button>
        <div class="form-row">
            <div class="form-group">
                <label for="medicine${medicineCounter}">Medicine Name</label>
                <input type="text" id="medicine${medicineCounter}" name="medicine${medicineCounter}" placeholder="e.g., Paracetamol 500mg">
            </div>
            <div class="form-group">
                <label for="dosage${medicineCounter}">Dosage</label>
                <input type="text" id="dosage${medicineCounter}" name="dosage${medicineCounter}" placeholder="e.g., 1 tablet">
            </div>
            <div class="form-group">
                <label for="frequency${medicineCounter}">Frequency</label>
                <select id="frequency${medicineCounter}" name="frequency${medicineCounter}">
                    <option value="">Select frequency</option>
                    <option value="Once daily">Once daily</option>
                    <option value="Twice daily">Twice daily</option>
                    <option value="Three times daily">Three times daily</option>
                    <option value="Four times daily">Four times daily</option>
                    <option value="As needed">As needed</option>
                </select>
            </div>
            <div class="form-group">
                <label for="duration${medicineCounter}">Duration</label>
                <input type="text" id="duration${medicineCounter}" name="duration${medicineCounter}" placeholder="e.g., 5 days">
            </div>
        </div>
    `;
    
    medicinesContainer.appendChild(medicineItem);
}

// Remove medicine field
function removeMedicine(button) {
    button.parentElement.remove();
}

// Handle consultation form submission
async function handleConsultationSubmit(e) {
    e.preventDefault();
    
    if (!currentPatient || !currentVisit) {
        showAlert('Please select a patient first', 'error');
        return;
    }
    
    try {
        // Show loading
        const saveBtn = document.getElementById('saveConsultationBtn');
        saveBtn.querySelector('.btn-text').style.display = 'none';
        saveBtn.querySelector('.btn-loading').style.display = 'inline';
        saveBtn.disabled = true;
        
        // Collect form data
        const formData = new FormData(e.target);
        const consultationData = {
            patientId: currentPatient.patientId,
            visitId: currentVisit.visitId,
            campId: currentCamp.id,
            consultationDate: new Date().toISOString(),
            primaryDiagnosis: formData.get('primaryDiagnosis'),
            secondaryDiagnosis: formData.get('secondaryDiagnosis'),
            clinicalFindings: formData.get('clinicalFindings'),
            treatmentPlan: formData.get('treatmentPlan'),
            additionalNotes: formData.get('additionalNotes'),
            medicines: collectMedicines(formData),
            followUp: {
                required: formData.get('followUpRequired') === 'yes',
                date: formData.get('followUpDate'),
                type: formData.get('followUpType')
            },
            referral: {
                required: formData.get('referralRequired') === 'yes',
                specialty: formData.get('referralSpecialty'),
                urgency: formData.get('referralUrgency'),
                reason: formData.get('referralReason')
            }
        };
        
        // Update patient visit with consultation data
        await db.collection('patient_visits').doc(currentVisit.visitId).update({
            'journeyStatus.doctor.status': 'completed',
            'journeyStatus.doctor.data': consultationData,
            'journeyStatus.doctor.completedAt': new Date().toISOString(),
            'journeyStatus.pharmacy.status': consultationData.medicines.length > 0 ? 'pending' : 'not_required'
        });
        
        // Create follow-up if required
        if (consultationData.followUp.required) {
            await createFollowUp(consultationData);
        }
        
        // Show success message
        showAlert('Consultation saved successfully', 'success');
        document.getElementById('successModal').style.display = 'block';
        
        // Update statistics
        await updateConsultationStatistics();
        
    } catch (error) {
        console.error('Error saving consultation:', error);
        showAlert('Failed to save consultation', 'error');
    } finally {
        // Reset button
        const saveBtn = document.getElementById('saveConsultationBtn');
        saveBtn.querySelector('.btn-text').style.display = 'inline';
        saveBtn.querySelector('.btn-loading').style.display = 'none';
        saveBtn.disabled = false;
    }
}

// Collect medicines from form
function collectMedicines(formData) {
    const medicines = [];
    let counter = 1;
    
    while (formData.get(`medicine${counter}`)) {
        const medicineName = formData.get(`medicine${counter}`);
        if (medicineName.trim()) {
            medicines.push({
                name: medicineName,
                dosage: formData.get(`dosage${counter}`) || '',
                frequency: formData.get(`frequency${counter}`) || '',
                duration: formData.get(`duration${counter}`) || ''
            });
        }
        counter++;
    }
    
    return medicines;
}

// Create follow-up appointment
async function createFollowUp(consultationData) {
    const followUpData = {
        patientId: consultationData.patientId,
        originalVisitId: consultationData.visitId,
        campId: consultationData.campId,
        scheduledDate: consultationData.followUp.date,
        scheduledBy: 'doctor',
        type: consultationData.followUp.type,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        notes: `Follow-up for: ${consultationData.primaryDiagnosis}`
    };
    
    await db.collection('followups').add(followUpData);
}

// Clear consultation form
function clearConsultationForm() {
    document.getElementById('consultationForm').reset();
    
    // Reset medicine counter and remove extra medicine fields
    medicineCounter = 1;
    const medicinesContainer = document.querySelector('.medicines-container');
    const medicineItems = medicinesContainer.querySelectorAll('.medicine-item');
    
    // Keep only the first medicine item
    for (let i = 1; i < medicineItems.length; i++) {
        medicineItems[i].remove();
    }
    
    // Reset follow-up and referral fields
    handleFollowUpChange();
    handleReferralChange();
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsSection').style.display = 'none';
}

// Update consultation statistics
async function updateConsultationStatistics() {
    if (!currentCamp) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's completed consultations
        const todaySnapshot = await db.collection('patient_visits')
            .where('campId', '==', currentCamp.id)
            .where('journeyStatus.doctor.status', '==', 'completed')
            .get();
        
        const todayConsultations = todaySnapshot.docs.filter(doc => {
            const completedAt = doc.data().journeyStatus.doctor.completedAt;
            return completedAt && completedAt.split('T')[0] === today;
        }).length;
        
        // Get pending consultations
        const pendingSnapshot = await db.collection('patient_visits')
            .where('campId', '==', currentCamp.id)
            .where('journeyStatus.vitals.status', '==', 'completed')
            .where('journeyStatus.doctor.status', '==', 'pending')
            .get();
        
        const pendingConsultations = pendingSnapshot.size;
        
        // Update UI
        document.getElementById('todayConsultations').textContent = todayConsultations;
        document.getElementById('pendingConsultations').textContent = pendingConsultations;
        
        consultationStats = {
            today: todayConsultations,
            pending: pendingConsultations
        };
        
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    
    alert.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">${icon}</div>
            <div class="alert-message">${message}</div>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Export functions for global access
window.removeMedicine = removeMedicine;