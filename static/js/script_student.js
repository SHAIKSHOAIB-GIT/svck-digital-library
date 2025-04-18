// const BASE_URL = "http://127.0.0.1:5000"; // Change to your EC2 IP if hosted

// async function fetchMaterials() {
//     const branch = document.getElementById("filterBranch").value;
//     const semester = document.getElementById("filterSemester").value;
//     const subject = document.getElementById("filterSubject").value.trim();

//     const params = new URLSearchParams();
//     if (branch && branch !== "all") params.append("branch", branch);
//     if (semester && semester !== "all") params.append("semester", semester);
//     if (subject) params.append("subject", subject);

//     const url = `${BASE_URL}/materials?${params.toString()}`;

//     try {
//         const res = await fetch(url);
//         if (!res.ok) throw new Error("Failed to fetch materials");

//         const data = await res.json();
//         const tbody = document.querySelector("#materialsTable tbody");
//         tbody.innerHTML = "";

//         if (data.length === 0) {
//             tbody.innerHTML = "<tr><td colspan='5'>No materials found</td></tr>";
//         } else {
//             data.forEach(m => {
//                 const row = `<tr>
//                     <td>${m.title}</td>
//                     <td>${m.branch}</td>
//                     <td>${m.semester}</td>
//                     <td>${m.subject}</td>
//                     <td>
//                         <button class="btn view-btn" onclick="viewFile('${m.file_url}')">View</button>
//                         <button class="btn download-btn" onclick="downloadFile('${m.file_url}')">Download</button>
//                     </td>
//                 </tr>`;
//                 tbody.innerHTML += row;
//             });
//         }
//     } catch (error) {
//         console.error("Error fetching materials:", error);
//     }
// }

// function viewFile(url) {
//     window.open(url, "_blank", "noopener noreferrer");
// }

// function downloadFile(url) {
//     const a = document.createElement("a");
//     a.href = url;
//     a.target = "_blank";
//     a.rel = "noopener noreferrer";
//     a.download = url.split("/").pop();
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
// }

// document.addEventListener("DOMContentLoaded", fetchMaterials);

// function redirectToFacultyLogin() {
//     window.location.href = "/faculty_dashboard";
// }

// Dynamically detect the backend API URL (works for local & EC2 hosting)
const BASE_URL = window.location.origin;

// ✅ Fetch Study Materials (with filtering)
async function fetchMaterials() {
    const branch = document.getElementById("filterBranch").value;
    const semester = document.getElementById("filterSemester").value;
    const subject = document.getElementById("filterSubject").value.trim();

    // Build query parameters
    const params = new URLSearchParams();
    if (branch && branch !== "all") params.append("branch", branch);
    if (semester && semester !== "all") params.append("semester", semester);
    if (subject) params.append("subject", subject);

    const url = `${BASE_URL}/materials?${params.toString()}`;

    try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch materials");

        const data = await res.json();
        updateMaterialsTable(data);
    } catch (error) {
        console.error("Error fetching materials:", error);
        alert("Failed to fetch materials. Please try again later.");
    }
}

// ✅ Update the Student Materials Table
function updateMaterialsTable(materials) {
    const tbody = document.querySelector("#materialsTable tbody");
    tbody.innerHTML = "";

    if (materials.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No materials found</td></tr>`;
    } else {
        materials.forEach(m => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${m.title}</td>
                <td>${m.branch}</td>
                <td>${m.semester}</td>
                <td>${m.subject}</td>
                <td>
                    <button class="btn view-btn" onclick="viewFile('${m.file_url}')">View</button>
                    <button class="btn download-btn" onclick="downloadFile('${m.file_url}')">Download</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

// ✅ Open file in new tab (View)
function viewFile(url) {
    window.open(url, "_blank", "noopener noreferrer");
}

// ✅ Download file
function downloadFile(url) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = url.split("/").pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ✅ Redirect to Faculty Login Page
function redirectToFacultyLogin() {
    window.location.href = "/faculty_dashboard";
}

// ✅ Fetch materials on page load
document.addEventListener("DOMContentLoaded", fetchMaterials);
