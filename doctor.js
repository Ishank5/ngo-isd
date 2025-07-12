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
let currentPatient = null;
let consultationStats = { today: 0, pending: 0 };

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    try {
        await loadCurrentCamp();
        await loadReadyPatients();
        await updateConsultationStatistics();
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize application', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchBtn').addEventListener('click', searchPatients);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchPatients();
        }
    });
    
    // Form functionality
    document.getElementById('consultationForm').addEventListener('submit', handleConsultationSubmit);
    document.getElementById('clearConsultationBtn').addEventListener('click', clearConsultationForm);
    
    // Refresh data
    document.getElementById('refreshDataBtn').addEventListener('click', refreshAllData);
}

// Load current camp information
async function loadCurrentCamp() {
    try {
        const selectedCampId = localStorage.getItem('selectedCampId');
        if (!selectedCampId) {
            showAlert('No camp selected. Please select a camp first.', 'warning');
            return;
        }
        
        const campDoc = await db.collection('camps').doc(selectedCampId).get();
        if (!campDoc.exists) {
            showAlert('Selected camp not found', 'error');
            return;
        }
        
        currentCamp = { id: campDoc.id, ...campDoc.data() };
        displayCampInfo(currentCamp);
    } catch (error) {
        console.error('Error loading camp:', error);
        showAlert('Failed to load camp information', 'error');
    }
}

// Display camp information
function displayCampInfo(camp) {
    const campCard = document.getElementById('campCard');
    const campDate = camp.date && camp.date.toDate ? camp.date.toDate().toLocaleDateString() : 'Unknown date';
    const sponsorName = camp.sponsor && camp.sponsor.name ? camp.sponsor.name : 'Unknown';
    
    campCard.innerHTML = `
        <div class="camp-info">
            <h3>🏥 ${camp.name || 'Unknown Camp'}</h3>
            <p><strong>📍 Location:</strong> ${camp.location || 'Unknown'}</p>
            <p><strong>📅 Date:</strong> ${campDate}</p>
            <p><strong>🏢 Sponsor:</strong> ${sponsorName}</p>
            <p><strong>📊 Status:</strong> 
                <span class="status-badge ${camp.status || 'unknown'}">${camp.status || 'Unknown'}</span>
            </p>
        </div>
    `;
}

// Search patients function with proper null checks
async function searchPatients() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    if (!searchTerm) {
        showAlert('Please enter a search term', 'warning');
        return;
    }
    
    if (!currentCamp) {
        showAlert('Please select a camp first', 'warning');
        return;
    }
    
    const searchResultsSection = document.getElementById('searchResultsSection');
    const searchResultsList = document.getElementById('searchResultsList');
    const readyPatientsSection = document.getElementById('readyPatientsSection');
    
    // Show search results section, hide ready patients
    searchResultsSection.style.display = 'block';
    readyPatientsSection.style.display = 'none';
    
    try {
        searchResultsList.innerHTML = '<div class="loading">Searching patients...</div>';
        
        let allPatients = [];
        
        // Search by registration number (exact match)
        if (searchTerm.includes('_') || /^\d{8}_\d{3}$/.test(searchTerm)) {
            const regQuery = await db.collection('patients')
                .where('registrationNo', '==', searchTerm)
                .get();
            
            regQuery.forEach(doc => {
                allPatients.push({ id: doc.id, ...doc.data(), matchType: 'Registration Number' });
            });
        }
        
        // Search by phone number (exact match for 10 digits)
        if (/^\d{10}$/.test(searchTerm)) {
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
            // Get all patients and filter by name in JavaScript (since Firestore doesn't support case-insensitive search)
            const allPatientsQuery = await db.collection('patients').get();
            
            allPatientsQuery.forEach(doc => {
                const patient = doc.data();
                // Safe null check for name and toLowerCase
                const patientName = patient.name ? patient.name.toLowerCase() : '';
                const searchTermLower = searchTerm.toLowerCase();
                
                // Check if name contains the search term
                if (patientName.includes(searchTermLower)) {
                    const patientWithMatch = { id: doc.id, ...patient, matchType: 'Name Match' };
                    // Avoid duplicates
                    if (!allPatients.find(p => p.id === patientWithMatch.id)) {
                        allPatients.push(patientWithMatch);
                    }
                }
            });
        }
        
        if (allPatients.length === 0) {
            searchResultsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3>No Patients Found</h3>
                    <p>No patients found matching "${searchTerm}"</p>
                    <small>Try searching with registration number, phone, or name</small>
                </div>
            `;
        } else {
            searchResultsList.innerHTML = allPatients.map(patient => `
                <div class="search-result-item" onclick="selectPatientFromSearch('${patient.id}')">
                    <h5>${patient.name || 'Unknown Name'}</h5>
                    <p class="patient-reg-no">${patient.registrationNo || 'No Reg Number'}</p>
                    <p><strong>Phone:</strong> ${patient.phone || 'N/A'}</p>
                    <p><strong>Age:</strong> ${patient.age || 'N/A'} | <strong>Gender:</strong> ${patient.sex || 'N/A'}</p>
                    <p><strong>Match:</strong> <span style="color: var(--primary-color); font-weight: 600;">${patient.matchType}</span></p>
                </div>
            `).join('');
            
            // If exactly one result, auto-select it
            if (allPatients.length === 1) {
                await selectPatientFromSearch(allPatients[0].id);
                showAlert('Patient found and selected automatically', 'success');
            } else {
                showAlert(`Found ${allPatients.length} patients matching your search`, 'success');
            }
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showAlert('Failed to search patients', 'error');
        searchResultsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Search Failed</h3>
                <p>Unable to search patients. Please try again.</p>
            </div>
        `;
    }
}

// Clear search function
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResultsSection').style.display = 'none';
    document.getElementById('readyPatientsSection').style.display = 'block';
    loadReadyPatients();
}

// Load patients ready for consultation
async function loadReadyPatients() {
    const readyPatientsList = document.getElementById('readyPatientsList');
    
    try {
        readyPatientsList.innerHTML = '<div class="loading">Loading ready patients...</div>';
        
        // Get patients who have vitals recorded but no consultation yet
        const vitalsQuery = await db.collection('vitals')
            .where('campId', '==', currentCamp?.id || '')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const readyPatients = [];
        
        for (const vitalDoc of vitalsQuery.docs) {
            const vital = vitalDoc.data();
            const patientId = vital.patientId;
            
            // Check if patient already has consultation
            const consultationQuery = await db.collection('consultations')
                .where('patientId', '==', patientId)
                .where('campId', '==', currentCamp?.id || '')
                .get();
            
            if (consultationQuery.empty) {
                // Get patient details
                const patientDoc = await db.collection('patients').doc(patientId).get();
                if (patientDoc.exists) {
                    const patient = { id: patientDoc.id, ...patientDoc.data() };
                    patient.vitalsRecorded = vital.createdAt.toDate();
                    readyPatients.push(patient);
                }
            }
        }
        
        if (readyPatients.length === 0) {
            readyPatientsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⏳</div>
                    <h3>No Patients Ready</h3>
                    <p>No patients are ready for consultation yet.</p>
                    <small>Patients need to complete vitals first</small>
                </div>
            `;
        } else {
            readyPatientsList.innerHTML = readyPatients.map(patient => `
                <div class="ready-patient-item" onclick="selectPatientFromReady('${patient.id}')">
                    <h5>${patient.name || 'Unknown Name'}</h5>
                    <p class="patient-reg-no">${patient.registrationNo || 'No Reg Number'}</p>
                    <p><strong>Age:</strong> ${patient.age || 'N/A'} | <strong>Gender:</strong> ${patient.sex || 'N/A'}</p>
                    <p><strong>Vitals Recorded:</strong> ${patient.vitalsRecorded.toLocaleString()}</p>
                    <span class="ready-badge">Ready for Consultation</span>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading ready patients:', error);
        readyPatientsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Error Loading Patients</h3>
                <p>Unable to load ready patients. Please try again.</p>
            </div>
        `;
    }
}

// Select patient from ready list
async function selectPatientFromReady(patientId) {
    await selectPatient(patientId);
}

// Select patient from search results
async function selectPatientFromSearch(patientId) {
    await selectPatient(patientId);
}

// Select patient (common function)
async function selectPatient(patientId) {
    try {
        showAlert('Loading patient details...', 'info');
        
        // Get patient data
        const patientDoc = await db.collection('patients').doc(patientId).get();
        if (!patientDoc.exists) {
            showAlert('Patient not found', 'error');
            return;
        }
        
        currentPatient = { id: patientDoc.id, ...patientDoc.data() };
        
        // Get patient's vitals
        const vitalsQuery = await db.collection('vitals')
            .where('patientId', '==', patientId)
            .where('campId', '==', currentCamp?.id || '')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        
        let vitals = null;
        if (!vitalsQuery.empty) {
            vitals = vitalsQuery.docs[0].data();
        }
        
        // Display patient details
        displayPatientDetails(currentPatient, vitals);
        
        // Show consultation form
        showConsultationForm();
        
        showAlert('Patient selected successfully', 'success');
        
    } catch (error) {
        console.error('Error selecting patient:', error);
        showAlert('Failed to select patient', 'error');
    }
}

// Display patient details
function displayPatientDetails(patient, vitals) {
    const patientDetailsSection = document.getElementById('patientDetailsSection');
    
    const vitalsInfo = vitals ? `
        <div class="vitals-section">
            <h4>📋 Vitals</h4>
            <div class="vitals-grid">
                <div class="vital-item">
                    <label>Blood Pressure:</label>
                    <span>${vitals.bloodPressure || 'N/A'}</span>
                </div>
                <div class="vital-item">
                    <label>Heart Rate:</label>
                    <span>${vitals.heartRate || 'N/A'} bpm</span>
                </div>
                <div class="vital-item">
                    <label>Temperature:</label>
                    <span>${vitals.temperature || 'N/A'}°F</span>
                </div>
                <div class="vital-item">
                    <label>Weight:</label>
                    <span>${vitals.weight || 'N/A'} kg</span>
                </div>
                <div class="vital-item">
                    <label>Height:</label>
                    <span>${vitals.height || 'N/A'} cm</span>
                </div>
                <div class="vital-item">
                    <label>Oxygen Saturation:</label>
                    <span>${vitals.oxygenSaturation || 'N/A'}%</span>
                </div>
            </div>
        </div>
    ` : '<div class="no-vitals">⚠️ No vitals recorded</div>';
    
    patientDetailsSection.innerHTML = `
        <div class="patient-details-content">
            <div class="patient-header">
                <h3>${patient.name || 'Unknown Name'}</h3>
                <span class="reg-number">${patient.registrationNo || 'No Reg Number'}</span>
            </div>
            
            <div class="patient-info-grid">
                <div class="info-item">
                    <label>Age:</label>
                    <span>${patient.age || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Gender:</label>
                    <span>${patient.sex || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Phone:</label>
                    <span>${patient.phone || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Address:</label>
                    <span>${patient.address || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Emergency Contact:</label>
                    <span>${patient.emergencyContact || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <label>Medical History:</label>
                    <span>${patient.medicalHistory || 'None'}</span>
                </div>
            </div>
            
            ${vitalsInfo}
        </div>
    `;
}

// Show consultation form
function showConsultationForm() {
    document.getElementById('consultationForm').style.display = 'block';
    document.getElementById('consultationEmpty').style.display = 'none';
}

// Handle consultation form submission
async function handleConsultationSubmit(e) {
    e.preventDefault();
    
    if (!currentPatient) {
        showAlert('No patient selected', 'warning');
        return;
    }
    
    if (!currentCamp) {
        showAlert('No camp selected', 'warning');
        return;
    }
    
    try {
        const symptoms = document.getElementById('symptoms').value.trim();
        const diagnosis = document.getElementById('diagnosis').value.trim();
        const prescription = document.getElementById('prescription').value.trim();
        const notes = document.getElementById('notes').value.trim();
        const followUp = document.getElementById('followUp').value;
        
        if (!symptoms || !diagnosis || !prescription) {
            showAlert('Please fill all required fields', 'warning');
            return;
        }
        
        showAlert('Saving consultation...', 'info');
        
        // Create consultation record
        const consultationData = {
            patientId: currentPatient.id,
            campId: currentCamp.id,
            patientName: currentPatient.name,
            registrationNo: currentPatient.registrationNo,
            symptoms: symptoms,
            diagnosis: diagnosis,
            prescription: prescription,
            notes: notes,
            followUp: followUp,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            doctorId: 'current-doctor', // This should be the actual doctor ID
            status: 'completed'
        };
        
        await db.collection('consultations').add(consultationData);
        
        // Update patient status
        await db.collection('patients').doc(currentPatient.id).update({
            consultationCompleted: true,
            consultationCompletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert('Consultation saved successfully!', 'success');
        
        // Clear form and patient selection
        clearConsultationForm();
        clearPatientSelection();
        
        // Refresh data
        await refreshAllData();
        
    } catch (error) {
        console.error('Error saving consultation:', error);
        showAlert('Failed to save consultation', 'error');
    }
}

// Clear consultation form
function clearConsultationForm() {
    document.getElementById('consultationForm').reset();
}

// Clear patient selection
function clearPatientSelection() {
    currentPatient = null;
    
    // Hide consultation form
    document.getElementById('consultationForm').style.display = 'none';
    document.getElementById('consultationEmpty').style.display = 'block';
    
    // Clear patient details
    document.getElementById('patientDetailsSection').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">👨‍⚕️</div>
            <h3>No Patient Selected</h3>
            <p>Search for a patient to start consultation</p>
        </div>
    `;
}

// Update consultation statistics
async function updateConsultationStatistics() {
    try {
        if (!currentCamp) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get today's consultations
        const todayConsultationsQuery = await db.collection('consultations')
            .where('campId', '==', currentCamp.id)
            .where('createdAt', '>=', today)
            .get();
        
        const todayConsultations = todayConsultationsQuery.size;
        
        // Get pending patients (have vitals but no consultation)
        const vitalsQuery = await db.collection('vitals')
            .where('campId', '==', currentCamp.id)
            .get();
        
        let pendingCount = 0;
        for (const vitalDoc of vitalsQuery.docs) {
            const vital = vitalDoc.data();
            const consultationQuery = await db.collection('consultations')
                .where('patientId', '==', vital.patientId)
                .where('campId', '==', currentCamp.id)
                .get();
            
            if (consultationQuery.empty) {
                pendingCount++;
            }
        }
        
        // Update UI
        document.getElementById('todayConsultations').textContent = todayConsultations;
        document.getElementById('pendingPatients').textContent = pendingCount;
        
        consultationStats = { today: todayConsultations, pending: pendingCount };
        
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// Refresh all data
async function refreshAllData() {
    try {
        showAlert('Refreshing data...', 'info');
        await loadCurrentCamp();
        await loadReadyPatients();
        await updateConsultationStatistics();
        showAlert('Data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showAlert('Failed to refresh data', 'error');
    }
}

// Show alert function
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;
    
    alertContainer.appendChild(alertElement);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        alertElement.remove();
    }, 5000);
}