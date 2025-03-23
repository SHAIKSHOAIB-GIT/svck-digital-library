const BASE_URL = "http://127.0.0.1:5000"; // Change to your EC2 IP if hosted

async function fetchMaterials() {
    const branch = document.getElementById("filterBranch").value;
    const semester = document.getElementById("filterSemester").value;
    const subject = document.getElementById("filterSubject").value.trim();

    const params = new URLSearchParams();
    if (branch && branch !== "all") params.append("branch", branch);
    if (semester && semester !== "all") params.append("semester", semester);
    if (subject) params.append("subject", subject);

    const url = `${BASE_URL}/materials?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch materials");

        const data = await res.json();
        const tbody = document.querySelector("#materialsTable tbody");
        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5'>No materials found</td></tr>";
        } else {
            data.forEach(m => {
                const row = `<tr>
                    <td>${m.title}</td>
                    <td>${m.branch}</td>
                    <td>${m.semester}</td>
                    <td>${m.subject}</td>
                    <td>
                        <button class="btn view-btn" onclick="viewFile('${m.file_url}')">View</button>
                        <button class="btn download-btn" onclick="downloadFile('${m.file_url}')">Download</button>
                    </td>
                </tr>`;
                tbody.innerHTML += row;
            });
        }
    } catch (error) {
        console.error("Error fetching materials:", error);
    }
}

function viewFile(url) {
    window.open(url, "_blank", "noopener noreferrer");
}

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

document.addEventListener("DOMContentLoaded", fetchMaterials);

function redirectToFacultyLogin() {
    window.location.href = "/faculty_dashboard";
}
