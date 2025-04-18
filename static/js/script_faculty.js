const API_BASE = window.location.origin; // Dynamically get the server IP

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("facultyLoginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("facultyUsername").value.trim().toLowerCase();
            const password = document.getElementById("facultyPassword").value;
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                    credentials: "include"
                });
                const data = await res.json();
                if (res.ok) {
                    sessionStorage.setItem("faculty", username);
                    document.getElementById("facultyLoginContainer").style.display = "none";
                    document.getElementById("facultyDashboard").style.display = "block";
                    document.getElementById("facultyUsernameDisplay").innerText = `Hello, ${username.toUpperCase()}`;
                    fetchFacultyMaterials();
                } else {
                    document.getElementById("facultyLoginError").style.display = "block";
                }
            } catch (error) {
                console.error("Login failed:", error);
            }
        });
    }

    if (window.location.pathname.includes("/faculty_dashboard")) {
        checkSession();
        fetchFacultyMaterials();

        const uploadForm = document.getElementById("uploadForm");
        if (uploadForm) {
            uploadForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                
                const fileInput = document.getElementById("uploadFile");
                const title = document.getElementById("uploadTitle").value;
                const semester = document.getElementById("uploadSemester").value;
                const subject = document.getElementById("uploadSubject").value;
                const branch = document.getElementById("uploadBranch").value; 

                if (!fileInput.files.length) {
                    alert("Please select a file.");
                    return;
                }

                const uploadButton = uploadForm.querySelector("button[type='submit']");
                uploadButton.disabled = true;
                uploadButton.innerText = "Uploading...";

                const formData = new FormData();
                formData.append("file", fileInput.files[0]);
                formData.append("title", title);
                formData.append("semester", semester);
                formData.append("subject", subject);
                formData.append("uploadBranch", branch); 

                try {
                    const res = await fetch(`${API_BASE}/upload`, {
                        method: "POST",
                        body: formData,
                        credentials: "include"
                    });
                    const data = await res.json();
                    if (res.ok) {
                        alert(data.message);
                        fetchFacultyMaterials();
                        uploadForm.reset();
                    } else {
                        alert(data.error);
                    }
                } catch (error) {
                    console.error("Upload error:", error);
                } finally {
                    uploadButton.disabled = false;
                    uploadButton.innerText = "Upload";
                }
            });
        }

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                fetch(`${API_BASE}/logout`, {
                    method: "POST",
                    credentials: "include"
                })
                .then(response => response.json())
                .then(data => {
                    alert(data.message);
                    sessionStorage.removeItem("faculty");
                    window.location.href = "/"; 
                })
                .catch(error => console.error("Logout error:", error));
            });
        }

        const filterBtn = document.getElementById("filterBtn");
        if (filterBtn) {
            filterBtn.addEventListener("click", fetchFilteredMaterials);
        }
    }
});

// Fetch faculty materials based on department restriction
function fetchFacultyMaterials() {
    fetch(`${API_BASE}/materials`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            const tableBody = document.querySelector("#facultyMaterialsTable tbody");
            tableBody.innerHTML = "";
            data.forEach(material => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${material.title}</td>
                    <td>${material.semester}</td>
                    <td>${material.subject}</td>
                    <td>
                        <button onclick="downloadFile('${material.file_url}')">View</button>
                        <button onclick="deleteMaterial(${material.id})">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(error => console.error("Error fetching materials:", error));
}

// Fetch materials based on filters (branch, semester, and subject)
async function fetchFilteredMaterials() {
    const branch = document.getElementById("branchFilter").value;
    const semester = document.getElementById("semesterFilter").value;
    const subject = document.getElementById("subjectFilter").value.trim().toLowerCase();

    const params = new URLSearchParams();
    if (branch && branch !== "all") params.append("branch", branch);
    if (semester && semester !== "all") params.append("semester", semester);
    if (subject) params.append("subject", subject);

    const url = `${API_BASE}/materials?${params.toString()}`;

    try {
        const res = await fetch(url, { method: "GET", credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch filtered materials");

        const data = await res.json();
        const tableBody = document.querySelector("#facultyMaterialsTable tbody");
        tableBody.innerHTML = "";

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4">No materials found</td></tr>`;
        } else {
            data.forEach(material => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${material.title}</td>
                    <td>${material.semester}</td>
                    <td>${material.subject}</td>
                    <td>
                        <button onclick="downloadFile('${material.file_url}')">View</button>
                        <button onclick="deleteMaterial(${material.id})">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
    } catch (error) {
        console.error("Error fetching filtered materials:", error);
    }
}

function downloadFile(fileUrl) {
    window.open(fileUrl, "_blank");
}

function deleteMaterial(materialId) {
    if (confirm("Are you sure you want to delete this file?")) {
        fetch(`${API_BASE}/delete/${materialId}`, {
            method: "DELETE",
            credentials: "include"
        })
        .then(async (res) => {
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchFacultyMaterials(); 
            } else {
                alert("Error: " + (data.error || "Failed to delete material"));
            }
        })
        .catch(error => {
            console.error("Error deleting material:", error);
            alert("An error occurred while deleting the file.");
        });
    }
}

// Check faculty session function
function checkSession() {
    fetch(`${API_BASE}/check_session`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                document.getElementById("facultyDashboard").style.display = "block";
                document.getElementById("facultyLoginContainer").style.display = "none";
                document.getElementById("facultyUsernameDisplay").innerText = `Hello, ${data.user.toUpperCase()}`;
            } else {
                document.getElementById("facultyDashboard").style.display = "none";
                document.getElementById("facultyLoginContainer").style.display = "block";
            }
        })
        .catch(error => console.error("Session check failed:", error));
}
