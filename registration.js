

const firebaseConfig = {
  apiKey: "AIzaSyDMNqYb2V90qdPUTCOkW6EiFuCHvI9JT2s",
  authDomain: "smart-attend-d476c.firebaseapp.com",
  projectId: "smart-attend-d476c",
  storageBucket: "smart-attend-d476c.appspot.com",
  messagingSenderId: "834025214336",
  appId: "1:834025214336:web:6e62ddf29f440f68c5f165",
  measurementId: "G-N46BB4YHQ3"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let currentCamp = null;
let currentSponsor = null;
let editingPatient = null;
let todayStats = { registrations: 0, totalPatients: 0 };
let availableCamps = [];

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
            await generateNextRegistrationNumber();
            await loadRecentPatients();
            await updateStatistics();
        }
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
    document.getElementById('registrationForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    
    // Phone number validation
    document.getElementById('patientPhone').addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 10);
        validatePhone(e.target.value);
    });
    
    // Age validation
    document.getElementById('patientAge').addEventListener('input', function(e) {
        validateAge(e.target.value);
    });
    
    // Quick actions
    document.getElementById('changeCampBtn').addEventListener('click', showCampSelectionModal);
    document.getElementById('refreshDataBtn').addEventListener('click', refreshAllData);
    
    // Camp selection modal
    document.getElementById('selectCampBtn').addEventListener('click', selectCamp);
    document.getElementById('refreshCampsBtn').addEventListener('click', loadAvailableCamps);
    document.getElementById('availableCamps').addEventListener('change', onCampSelectionChange);
    
    // Patient modal functionality
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('editPatientBtn').addEventListener('click', editPatient);
    
    // Close modals on outside click
    document.getElementById('patientModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    document.getElementById('campSelectionModal').addEventListener('click', function(e) {
        if (e.target === this) {
            // Don't allow closing camp selection modal by clicking outside
            // User must select a camp
        }
    });
}

// Load available camps from admin-created camps
async function loadAvailableCamps() {
    try {
        const refreshBtn = document.getElementById('refreshCampsBtn');
        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = 'Loading...';
        refreshBtn.disabled = true;
        
        // Get all camps - don't filter by status initially
        const campsRef = db.collection('camps');
        const snapshot = await campsRef.get();
        
        availableCamps = [];
        const campSelect = document.getElementById('availableCamps');
        campSelect.innerHTML = '<option value="">Select a camp</option>';
        
        if (snapshot.empty) {
            campSelect.innerHTML = '<option value="">No camps available</option>';
            showAlert('No camps found. Please contact admin to create camps.', 'warning');
            return;
        }
        
        console.log(`Found ${snapshot.size} total camps in database`);
        
        // Process all camps and load sponsor data
        for (const doc of snapshot.docs) {
            const campData = { id: doc.id, ...doc.data() };
            
            console.log(`Processing camp: ${campData.name}, Status: ${campData.status || 'No status'}`);
            
            // Include camps with any status or no status field (legacy camps)
            // Skip only explicitly 'completed' or 'cancelled' camps
            if (campData.status === 'completed' || campData.status === 'cancelled') {
                console.log(`Skipping ${campData.name} - status: ${campData.status}`);
                continue;
            }
            
            // Load sponsor information
            if (campData.sponsorId) {
                try {
                    const sponsorDoc = await db.collection('sponsors').doc(campData.sponsorId).get();
                    if (sponsorDoc.exists) {
                        campData.sponsor = sponsorDoc.data();
                    } else {
                        console.log(`Sponsor not found for camp: ${campData.name}`);
                        campData.sponsor = { name: 'Unknown Sponsor', code: 'UNK' };
                    }
                } catch (error) {
                    console.error(`Error loading sponsor for camp ${campData.name}:`, error);
                    campData.sponsor = { name: 'Unknown Sponsor', code: 'UNK' };
                }
            } else {
                // Handle camps without sponsorId (legacy camps)
                campData.sponsor = { name: 'No Sponsor', code: 'GEN' };
            }
            
            availableCamps.push(campData);
        }
        
        // Sort by creation date (newest first) or by name if no creation date
        availableCamps.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
            
            if (aTime && bTime) {
                return bTime - aTime; // Newest first
            } else {
                // Fallback to alphabetical if no timestamps
                return a.name.localeCompare(b.name);
            }
        });
        
        // Populate dropdown
        availableCamps.forEach(camp => {
            const option = document.createElement('option');
            option.value = camp.id;
            
            // Format the option text with more info
            const campDate = camp.date ? camp.date.toDate().toLocaleDateString() : 'No date';
            const statusText = camp.status ? ` [${camp.status}]` : ' [legacy]';
            
            option.textContent = `${camp.name} - ${camp.location} (${campDate})${statusText}`;
            campSelect.appendChild(option);
        });
        
        if (availableCamps.length === 0) {
            campSelect.innerHTML = '<option value="">No available camps found</option>';
            showAlert('No available camps found. All camps may be completed or cancelled.', 'warning');
        } else {
            showAlert(`${availableCamps.length} camps loaded successfully`, 'success');
        }
        
        console.log(`Loaded ${availableCamps.length} available camps out of ${snapshot.size} total camps`);
        
    } catch (error) {
        console.error('Error loading camps:', error);
        document.getElementById('availableCamps').innerHTML = '<option value="">Error loading camps</option>';
        showAlert('Failed to load camps: ' + error.message, 'error');
    } finally {
        const refreshBtn = document.getElementById('refreshCampsBtn');
        refreshBtn.textContent = 'Refresh Camps';
        refreshBtn.disabled = false;
    }
}

// Handle camp selection change
function onCampSelectionChange() {
    const campSelect = document.getElementById('availableCamps');
    const selectedCampId = campSelect.value;
    const selectBtn = document.getElementById('selectCampBtn');
    const campInfoDiv = document.getElementById('selectedCampInfo');
    
    if (selectedCampId) {
        const selectedCamp = availableCamps.find(camp => camp.id === selectedCampId);
        if (selectedCamp) {
            displaySelectedCampInfo(selectedCamp);
            campInfoDiv.style.display = 'block';
            selectBtn.disabled = false;
        }
    } else {
        campInfoDiv.style.display = 'none';
        selectBtn.disabled = true;
    }
}

// Display selected camp information
function displaySelectedCampInfo(camp) {
    const campInfoDiv = document.getElementById('selectedCampInfo');
    const campDate = camp.date.toDate().toLocaleDateString();
    const sponsorName = camp.sponsor ? camp.sponsor.name : 'Unknown';
    
    campInfoDiv.innerHTML = `
        <h5>📋 Camp Details</h5>
        <div class="camp-info-detail">
            <label>Camp Name:</label>
            <span>${camp.name}</span>
        </div>
        <div class="camp-info-detail">
            <label>Location:</label>
            <span>${camp.location}</span>
        </div>
        <div class="camp-info-detail">
            <label>Date:</label>
            <span>${campDate}</span>
        </div>
        <div class="camp-info-detail">
            <label>Sponsor:</label>
            <span>${sponsorName}</span>
        </div>
        <div class="camp-info-detail">
            <label>Status:</label>
            <span style="color: var(--success-green); font-weight: 600;">${camp.status}</span>
        </div>
    `;
}

// Check if a camp is already selected (stored in localStorage or session)
function checkForSelectedCamp() {
    const selectedCampId = localStorage.getItem('selectedCampId');
    if (selectedCampId) {
        // Check if the camp still exists and is active
        return db.collection('camps').doc(selectedCampId).get()
            .then(doc => {
                if (doc.exists && ['active', 'planned'].includes(doc.data().status)) {
                    return true;
                } else {
                    localStorage.removeItem('selectedCampId');
                    return false;
                }
            })
            .catch(() => {
                localStorage.removeItem('selectedCampId');
                return false;
            });
    }
    return Promise.resolve(false);
}

// Show camp selection modal
function showCampSelectionModal() {
    document.getElementById('campSelectionModal').style.display = 'block';
    loadAvailableCamps();
}

// Hide camp selection modal
function hideCampSelectionModal() {
    document.getElementById('campSelectionModal').style.display = 'none';
}

// Select a camp
async function selectCamp() {
    const selectBtn = document.getElementById('selectCampBtn');
    const btnText = selectBtn.querySelector('.btn-text');
    const btnLoading = selectBtn.querySelector('.btn-loading');
    const selectedCampId = document.getElementById('availableCamps').value;
    
    if (!selectedCampId) {
        showAlert('Please select a camp', 'warning');
        return;
    }
    
    selectBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    try {
        // Store selected camp
        localStorage.setItem('selectedCampId', selectedCampId);
        
        // Load the selected camp
        await loadCurrentCamp();
        await generateNextRegistrationNumber();
        await loadRecentPatients();
        await updateStatistics();
        
        hideCampSelectionModal();
        showAlert('Camp selected successfully!', 'success');
        
    } catch (error) {
        console.error('Error selecting camp:', error);
        showAlert('Failed to select camp', 'error');
    } finally {
        selectBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Load current selected camp
async function loadCurrentCamp() {
    try {
        const selectedCampId = localStorage.getItem('selectedCampId');
        if (!selectedCampId) {
            displayNoCampState();
            return;
        }
        
        const campDoc = await db.collection('camps').doc(selectedCampId).get();
        if (!campDoc.exists) {
            localStorage.removeItem('selectedCampId');
            displayNoCampState();
            return;
        }
        
        currentCamp = { id: campDoc.id, ...campDoc.data() };
        
        // Load sponsor information
        if (currentCamp.sponsorId) {
            const sponsorDoc = await db.collection('sponsors').doc(currentCamp.sponsorId).get();
            if (sponsorDoc.exists) {
                currentSponsor = { id: sponsorDoc.id, ...sponsorDoc.data() };
            }
        }
        
        displayCampInfo();
        
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
    
    const campDate = currentCamp.date.toDate().toLocaleDateString();
    const sponsorName = currentSponsor ? currentSponsor.name : 'Unknown';
    
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
                ${currentCamp.status}
            </span>
        </div>
    `;
}

// Display no camp state
function displayNoCampState() {
    document.getElementById('campCard').innerHTML = `
        <div class="no-camp-state">
            <h3>⚠️ No Camp Selected</h3>
            <p>Please select a camp to start registering patients</p>
            <button onclick="showCampSelectionModal()" class="btn-primary" style="margin-top: 0.5rem;">
                Select Camp
            </button>
        </div>
    `;
}

// Generate next registration number
async function generateNextRegistrationNumber() {
    try {
        if (!currentCamp) {
            document.getElementById('nextRegNumber').textContent = 'No camp selected';
            return;
        }
        
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const sponsorCode = currentSponsor ? currentSponsor.code : 'GEN';
        const prefix = `${dateStr}_${sponsorCode}_`;
        
        // Get all patients for this camp and filter in memory
        const patientsSnapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        let maxSequence = 0;
        patientsSnapshot.forEach(doc => {
            const patient = doc.data();
            const regNo = patient.registrationNo;
            
            // Check if registration number matches today's pattern
            if (regNo && regNo.startsWith(prefix)) {
                const sequence = parseInt(regNo.split('_')[2]);
                if (!isNaN(sequence) && sequence > maxSequence) {
                    maxSequence = sequence;
                }
            }
        });
        
        const nextSequence = maxSequence + 1;
        const nextRegNumber = `${prefix}${nextSequence.toString().padStart(3, '0')}`;
        document.getElementById('nextRegNumber').textContent = nextRegNumber;
        
    } catch (error) {
        console.error('Error generating registration number:', error);
        document.getElementById('nextRegNumber').textContent = 'Error';
    }
}

// Update statistics
async function updateStatistics() {
    try {
        if (!currentCamp) {
            document.getElementById('todayRegistrations').textContent = '0';
            document.getElementById('totalPatients').textContent = '0';
            return;
        }
        
        // Get all patients for current camp first
        const allPatientsSnapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
        
        let todayCount = 0;
        let totalCount = 0;
        
        allPatientsSnapshot.forEach(doc => {
            const patient = doc.data();
            totalCount++;
            
            // Check if created today
            const createdAt = patient.createdAt.toDate();
            if (createdAt >= todayStart && createdAt < todayEnd) {
                todayCount++;
            }
        });
        
        todayStats.registrations = todayCount;
        todayStats.totalPatients = totalCount;
        
        // Update UI
        document.getElementById('todayRegistrations').textContent = todayStats.registrations;
        document.getElementById('totalPatients').textContent = todayStats.totalPatients;
        
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// Search patients
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
    
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="loading">Searching patients...</div>';
    
    try {
        // Get all patients for current camp and search in memory
        const patientsSnapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        let results = [];
        
        patientsSnapshot.forEach(doc => {
            const patient = { id: doc.id, ...doc.data() };
            
            // Search by phone number (exact match)
            if (/^\d{10}$/.test(searchTerm) && patient.phone === searchTerm) {
                results.push(patient);
                return;
            }
            
            // Search by registration number (exact match)
            if (searchTerm.includes('_') && patient.registrationNo === searchTerm.toUpperCase()) {
                results.push(patient);
                return;
            }
            
            // Search by name (case insensitive partial match)
            if (searchTerm.length >= 3 && 
                patient.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                results.push(patient);
                return;
            }
        });
        
        // Remove duplicates (shouldn't happen with current logic, but safety check)
        results = results.filter((patient, index, self) => 
            index === self.findIndex(p => p.id === patient.id)
        );
        
        displaySearchResults(results);
        
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Search Failed</h3>
                <p>Unable to search patients. Please try again.</p>
            </div>
        `;
    }
}

// Display search results
function displaySearchResults(patients) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (patients.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>No Patients Found</h3>
                <p>Try searching with a different term</p>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = patients.map(patient => `
        <div class="patient-card" onclick="showPatientDetails('${patient.id}')">
            <h4>${patient.name}</h4>
            <p><strong>Reg No:</strong> <span class="reg-number">${patient.registrationNo}</span></p>
            <p><strong>Phone:</strong> ${patient.phone}</p>
            <p><strong>Age:</strong> ${patient.age} | <strong>Gender:</strong> ${patient.sex}</p>
            <p><strong>Category:</strong> ${patient.category}</p>
        </div>
    `).join('');
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentCamp) {
        showAlert('Please select a camp first', 'error');
        return;
    }
    
    if (!validateForm()) {
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    try {
        const formData = new FormData(e.target);
        const patientData = {
            registrationNo: document.getElementById('nextRegNumber').textContent,
            name: formData.get('name').trim(),
            age: parseInt(formData.get('age')),
            sex: formData.get('sex'),
            phone: formData.get('phone'),
            address: formData.get('address').trim(),
            category: formData.get('category'),
            education: formData.get('education').trim() || '',
            occupation: formData.get('occupation').trim() || '',
            campId: currentCamp.id,
            sponsorId: currentCamp.sponsorId,
            createdAt: firebase.firestore.Timestamp.now(),
            createdBy: 'registration-user',
            isActive: true
        };
        
        // Check for duplicate phone number within the same camp
        const allPatientsSnapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        let duplicateFound = false;
        allPatientsSnapshot.forEach(doc => {
            const patient = doc.data();
            if (patient.phone === patientData.phone && (!editingPatient || doc.id !== editingPatient.id)) {
                duplicateFound = true;
            }
        });
        
        if (duplicateFound) {
            throw new Error('A patient with this phone number already exists in this camp');
        }
        
        let patientId;
        if (editingPatient) {
            // Update existing patient
            await db.collection('patients').doc(editingPatient.id).update({
                ...patientData,
                updatedAt: firebase.firestore.Timestamp.now()
            });
            patientId = editingPatient.id;
            showAlert('Patient updated successfully!', 'success');
        } else {
            // Create new patient
            const docRef = await db.collection('patients').add(patientData);
            patientId = docRef.id;
            showAlert('Patient registered successfully!', 'success');
        }
        
        // Create initial patient visit record
        const visitData = {
            patientId: patientId,
            campId: currentCamp.id,
            visitDate: firebase.firestore.Timestamp.now(),
            visitType: editingPatient ? 'update' : 'new',
            journeyStatus: {
                registration: {
                    status: 'completed',
                    timestamp: firebase.firestore.Timestamp.now(),
                    by: 'registration-user'
                },
                vitals: {
                    status: 'pending'
                },
                doctor: {
                    status: 'pending'
                },
                pharmacy: {
                    status: 'pending'
                }
            },
            presentComplaint: formData.get('presentComplaint') || '',
            currentTreatment: formData.get('currentTreatment') || '',
            createdAt: firebase.firestore.Timestamp.now(),
            isCompleted: false
        };
        
        if (!editingPatient) {
            await db.collection('patient_visits').add(visitData);
        }
        
        // Reset form and refresh data
        clearForm();
        await generateNextRegistrationNumber();
        await loadRecentPatients();
        await updateStatistics();
        
    } catch (error) {
        console.error('Registration error:', error);
        showAlert(error.message || 'Registration failed', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        editingPatient = null;
    }
}

// Validate form
function validateForm() {
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    // Validate required fields
    const requiredFields = ['patientName', 'patientAge', 'patientSex', 'patientPhone', 'patientCategory', 'patientAddress'];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showFieldError(fieldId, 'This field is required');
            isValid = false;
        }
    });
    
    // Validate phone number
    const phone = document.getElementById('patientPhone').value;
    if (phone && !/^\d{10}$/.test(phone)) {
        showFieldError('patientPhone', 'Please enter a valid 10-digit phone number');
        isValid = false;
    }
    
    // Validate age
    const age = parseInt(document.getElementById('patientAge').value);
    if (age && (age < 1 || age > 120)) {
        showFieldError('patientAge', 'Please enter a valid age between 1 and 120');
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

// Validate phone number
function validatePhone(phone) {
    const phoneField = document.getElementById('patientPhone');
    const formGroup = phoneField.closest('.form-group');
    
    if (phone.length === 10) {
        formGroup.classList.remove('error');
        if (currentCamp) {
            checkDuplicatePhone(phone);
        }
    } else if (phone.length > 0) {
        showFieldError('patientPhone', 'Phone number must be 10 digits');
    }
}

// Check for duplicate phone number
async function checkDuplicatePhone(phone) {
    try {
        if (!currentCamp) return;
        
        // Get all patients for current camp and check in memory
        const patientsSnapshot = await db.collection('patients')
            .where('campId', '==', currentCamp.id)
            .get();
        
        let duplicateFound = false;
        patientsSnapshot.forEach(doc => {
            const patient = doc.data();
            if (patient.phone === phone && (!editingPatient || doc.id !== editingPatient.id)) {
                duplicateFound = true;
            }
        });
        
        if (duplicateFound) {
            showFieldError('patientPhone', 'A patient with this phone number already exists in this camp');
        }
    } catch (error) {
        console.error('Duplicate check error:', error);
    }
}

// Validate age
function validateAge(age) {
    const ageValue = parseInt(age);
    if (age && (ageValue < 1 || ageValue > 120)) {
        showFieldError('patientAge', 'Age must be between 1 and 120');
    }
}

// Clear form
function clearForm() {
    document.getElementById('registrationForm').reset();
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    editingPatient = null;
    
    // Update form header
    document.getElementById('formTitle').innerHTML = '👤 New Patient Registration';
}

// Load recent patients
async function loadRecentPatients() {
    try {
        if (!currentCamp) {
            document.getElementById('recentPatients').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No Camp Selected</h3>
                    <p>Select a camp to view registrations</p>
                </div>
            `;
            return;
        }
        
        const recentContainer = document.getElementById('recentPatients');
        recentContainer.innerHTML = '<div class="loading">Loading recent registrations...</div>';
        
        // Get patients for current camp AND patients without campId (legacy records)
        const [campPatientsSnapshot, allPatientsSnapshot] = await Promise.all([
            // Patients with current camp ID
            db.collection('patients').where('campId', '==', currentCamp.id).get(),
            // All patients (to include legacy records without campId)
            db.collection('patients').limit(50).get()
        ]);
        
        const patients = new Map(); // Use Map to avoid duplicates
        
        // Add patients from current camp
        campPatientsSnapshot.forEach(doc => {
            const data = doc.data();
            patients.set(doc.id, {
                id: doc.id,
                ...data,
                createdAtTime: data.createdAt ? data.createdAt.toMillis() : Date.now(),
                source: 'camp-specific'
            });
        });
        
        // Add legacy patients (those without campId) if we don't have many camp-specific ones
        if (patients.size < 10) {
            allPatientsSnapshot.forEach(doc => {
                const data = doc.data();
                // Only add if not already in our map and doesn't have a campId (legacy record)
                if (!patients.has(doc.id) && !data.campId) {
                    patients.set(doc.id, {
                        id: doc.id,
                        ...data,
                        createdAtTime: data.createdAt ? data.createdAt.toMillis() : Date.now(),
                        source: 'legacy'
                    });
                }
            });
        }
        
        if (patients.size === 0) {
            recentContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No Registrations</h3>
                    <p>No patient registrations found</p>
                    <button onclick="refreshAllData()" class="btn-primary" style="margin-top: 1rem;">
                        Refresh Data
                    </button>
                </div>
            `;
            return;
        }
        
        // Convert to array and sort by creation time (newest first)
        const patientsArray = Array.from(patients.values());
        patientsArray.sort((a, b) => b.createdAtTime - a.createdAtTime);
        
        // Take only first 10 (most recent)
        const recentPatients = patientsArray.slice(0, 10);
        
        recentContainer.innerHTML = recentPatients.map(patient => {
            let createdDate = 'Unknown';
            let createdTime = '';
            
            try {
                if (patient.createdAt) {
                    const date = patient.createdAt.toDate();
                    createdDate = date.toLocaleDateString();
                    createdTime = date.toLocaleTimeString();
                } else {
                    createdDate = 'Recently';
                    createdTime = '';
                }
            } catch (error) {
                console.error('Error formatting date:', error);
                createdDate = 'Recently';
                createdTime = '';
            }
            
            // Add indicator for legacy vs camp-specific patients
            const sourceIndicator = patient.source === 'legacy' ? 
                '<span style="color: var(--warning-orange); font-size: 0.7rem;">(Legacy)</span>' : '';
            
            return `
                <div class="recent-item" onclick="showPatientDetails('${patient.id}')">
                    <h4>${patient.name || 'Unknown Name'} ${sourceIndicator}</h4>
                    <p class="reg-no">${patient.registrationNo || 'No Reg Number'}</p>
                    <p><strong>Phone:</strong> ${patient.phone || 'N/A'}</p>
                    <p><strong>Age:</strong> ${patient.age || 'N/A'} | <strong>Gender:</strong> ${patient.sex || 'N/A'}</p>
                    <p><strong>Time:</strong> ${createdDate} ${createdTime}</p>
                </div>
            `;
        }).join('');
        
        console.log(`Loaded ${recentPatients.length} recent patients (${campPatientsSnapshot.size} camp-specific, ${patients.size - campPatientsSnapshot.size} legacy) for camp: ${currentCamp.name}`);
        
    } catch (error) {
        console.error('Error loading recent patients:', error);
        document.getElementById('recentPatients').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>Loading Failed</h3>
                <p>Failed to load recent registrations: ${error.message}</p>
                <button onclick="loadRecentPatients()" class="btn-secondary" style="margin-top: 1rem;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Show patient details in modal
async function showPatientDetails(patientId) {
    try {
        const patientDoc = await db.collection('patients').doc(patientId).get();
        if (!patientDoc.exists) {
            showAlert('Patient not found', 'error');
            return;
        }
        
        const patient = patientDoc.data();
        const createdDate = patient.createdAt.toDate().toLocaleDateString();
        const createdTime = patient.createdAt.toDate().toLocaleTimeString();
        
        document.getElementById('modalBody').innerHTML = `
            <div class="patient-detail">
                <div class="detail-group">
                    <label>Registration Number</label>
                    <span style="font-family: 'Courier New', monospace; font-weight: 700; color: var(--success-green);">${patient.registrationNo}</span>
                </div>
                <div class="detail-group">
                    <label>Registration Date</label>
                    <span>${createdDate} ${createdTime}</span>
                </div>
                <div class="detail-group">
                    <label>Full Name</label>
                    <span>${patient.name}</span>
                </div>
                <div class="detail-group">
                    <label>Age</label>
                    <span>${patient.age} years</span>
                </div>
                <div class="detail-group">
                    <label>Gender</label>
                    <span>${patient.sex}</span>
                </div>
                <div class="detail-group">
                    <label>Phone Number</label>
                    <span>${patient.phone}</span>
                </div>
                <div class="detail-group">
                    <label>Category</label>
                    <span>${patient.category}</span>
                </div>
                <div class="detail-group">
                    <label>Education</label>
                    <span>${patient.education || 'Not specified'}</span>
                </div>
                <div class="detail-group">
                    <label>Occupation</label>
                    <span>${patient.occupation || 'Not specified'}</span>
                </div>
                <div class="detail-group full-width">
                    <label>Address</label>
                    <span>${patient.address}</span>
                </div>
            </div>
        `;
        
        // Store patient data for editing
        editingPatient = { id: patientId, ...patient };
        
        // Show modal
        document.getElementById('patientModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading patient details:', error);
        showAlert('Failed to load patient details', 'error');
    }
}

// Edit patient
function editPatient() {
    if (!editingPatient) return;
    
    // Populate form with patient data
    document.getElementById('patientName').value = editingPatient.name;
    document.getElementById('patientAge').value = editingPatient.age;
    document.getElementById('patientSex').value = editingPatient.sex;
    document.getElementById('patientPhone').value = editingPatient.phone;
    document.getElementById('patientCategory').value = editingPatient.category;
    document.getElementById('patientAddress').value = editingPatient.address;
    document.getElementById('patientEducation').value = editingPatient.education || '';
    document.getElementById('patientOccupation').value = editingPatient.occupation || '';
    
    // Update form header
    document.getElementById('formTitle').innerHTML = '✏️ Edit Patient Registration';
    document.getElementById('nextRegNumber').textContent = editingPatient.registrationNo;
    
    // Close modal
    closeModal();
    
    // Scroll to form
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth' });
}

// Close modal
function closeModal() {
    document.getElementById('patientModal').style.display = 'none';
    editingPatient = null;
}

// Refresh all data
async function refreshAllData() {
    try {
        showAlert('Refreshing data...', 'info');
        await loadAvailableCamps();
        await loadCurrentCamp();
        await generateNextRegistrationNumber();
        await loadRecentPatients();
        await updateStatistics();
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

// Utility function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Utility function to format time
function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}