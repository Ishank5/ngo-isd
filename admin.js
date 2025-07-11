// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMNqYb2V90qdPUTCOkW6EiFuCHvI9JT2s",
    authDomain: "smart-attend-d476c.firebaseapp.com",
    projectId: "smart-attend-d476c",
    storageBucket: "smart-attend-d476c.appspot.com",
    messagingSenderId: "834025214336",
    appId: "1:834025214336:web:6e62ddf29f440f68c5f165"
};

firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        const roleCards = document.querySelectorAll('.role-card');
        const modal = document.getElementById('userModal');
        const modalClose = document.getElementById('modalClose');
        const userForm = document.getElementById('userForm');
        const roleInput = document.getElementById('userRole');

        let selectedRole = '';

        roleCards.forEach(card => {
            card.addEventListener('click', () => {
                selectedRole = card.getAttribute('data-role');
                roleInput.value = selectedRole;
                modal.style.display = 'flex';
            });
        });

        modalClose.addEventListener('click', () => {
            modal.style.display = 'none';
            userForm.reset();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                userForm.reset();
            }
        });

        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('userName').value.trim();
            const email = document.getElementById('userEmail').value.trim();
            const password = document.getElementById('userPassword').value;
            const phone = document.getElementById('userPhone').value.trim();
            const role = document.getElementById('userRole').value;

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const uid = userCredential.user.uid;

                await db.collection('users').doc(email).set({
                    uid,
                    email,
                    name,
                    role,
                    phone,
                    createdAt: firebase.firestore.Timestamp.now(),
                    isActive: true
                });

                showAlert('User registered successfully!', 'success');
                userForm.reset();
                modal.style.display = 'none';
            } catch (error) {
                console.error(error);
                showAlert(error.message, 'error');
            }
        });

        function showAlert(message, type) {
            const alertContainer = document.getElementById('alertContainer');
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert ${type}`;
            alertDiv.textContent = message;
            alertContainer.appendChild(alertDiv);
            setTimeout(() => {
                alertDiv.remove();
            }, 4000);
        }

        const sponsorForm = document.getElementById("sponsorForm");
        const campForm = document.getElementById("campForm");

        sponsorForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("sponsorName").value.trim();
            const code = document.getElementById("sponsorCode").value.trim().toUpperCase();

            if (!name || !code) {
                showAlert("Please fill all sponsor fields", "error");
                return;
            }

            try {
                await db.collection("sponsors").add({
                    name,
                    code,
                    isActive: true,
                    createdAt: firebase.firestore.Timestamp.now()
                });
                showAlert("Sponsor created successfully!", "success");
                sponsorForm.reset();
                populateSponsors();
            } catch (error) {
                console.error("Error creating sponsor:", error);
                showAlert("Failed to create sponsor", "error");
            }
        });

        campForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("campName").value.trim();
            const location = document.getElementById("campLocation").value.trim();
            const date = document.getElementById("campDate").value;
            const sponsorId = document.getElementById("campSponsor").value;

            if (!name || !location || !date || !sponsorId) {
                showAlert("Please fill all camp fields", "error");
                return;
            }

            try {
                await db.collection("camps").add({
                    name,
                    sponsorId,
                    location,
                    date: firebase.firestore.Timestamp.fromDate(new Date(date)),
                    status: "planned",
                    createdBy: "admin-user",
                    createdAt: firebase.firestore.Timestamp.now()
                });
                showAlert("Camp created successfully!", "success");
                campForm.reset();
            } catch (error) {
                console.error("Error creating camp:", error);
                showAlert("Failed to create camp", "error");
            }
        });

        async function populateSponsors() {
            const select = document.getElementById("campSponsor");
            select.innerHTML = '<option value="">Select Sponsor</option>';
            try {
                const snapshot = await db.collection("sponsors").where("isActive", "==", true).get();
                snapshot.forEach(doc => {
                    const s = doc.data();
                    const opt = document.createElement("option");
                    opt.value = doc.id;
                    opt.textContent = `${s.name} (${s.code})`;
                    select.appendChild(opt);
                });
            } catch (err) {
                console.error("Error loading sponsors:", err);
            }
        }

        document.addEventListener("DOMContentLoaded", populateSponsors);