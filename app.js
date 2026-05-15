// 1. PASTE YOUR GOOGLE URL HERE
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzL3H4e5Un6ktLZXTTO4ydn3Q6cjL-tDh4_mYb_3U6Czsl2iu6dhp4y5UO41vC865aB/exec";
let schoolData = JSON.parse(localStorage.getItem('jomade_schoolData')) || {};
let records = JSON.parse(localStorage.getItem('jomade_records')) || [];
let history = JSON.parse(localStorage.getItem('jomade_history')) || [];
let activeClass = "";

// --- NEW: FETCH DATA FROM CLOUD ON LOAD ---
// --- UPDATED: FETCH NAMES AND ATTENDANCE HISTORY FROM CLOUD ---
async function loadDataFromCloud() {
    if (!navigator.onLine) return;
    try {
        const response = await fetch(SCRIPT_URL);
        const cloudData = await response.json();
        
        if (cloudData && !cloudData.error) {
            // Load master student list
            if (cloudData.schoolData && Object.keys(cloudData.schoolData).length > 0) {
                schoolData = cloudData.schoolData;
                localStorage.setItem('jomade_schoolData', JSON.stringify(schoolData));
            }
            // Load master attendance records (This fixes the across-devices issue!)
            if (cloudData.records && cloudData.records.length > 0) {
                records = cloudData.records;
                localStorage.setItem('jomade_records', JSON.stringify(records));
            }
            
            renderClassView();
            console.log("Everything synced from cloud successfully.");
        }
    } catch (e) {
        console.error("Could not load database from cloud:", e);
    }
}

// --- AUTO-SYNC LOGIC ---
async function autoSync() {
    if (!navigator.onLine || records.length === 0) return;
    
    try {
        await fetch(SCRIPT_URL, { 
            method: "POST", 
            mode: "no-cors", 
            header: { 'Content-Type': 'application/json' },
            body: JSON.stringify(records) 
        });
        console.log("Sync Successful");
    } catch (e) {
        console.log("Sync Pending (Offline)");
    }
}

window.addEventListener('online', autoSync);

// --- ATTENDANCE LOGIC ---
function mark(name, status, silent = false) {
    const term = document.getElementById('termSelect').value;
    const week = document.getElementById('weekSelect').value;
    const day = document.getElementById('daySelect').value;
    const session = document.getElementById('sessionInput').value || "2024/2025";

    records = records.filter(r => !(r.name === name && r.day === day && r.week === week && r.class === activeClass));

    records.push({ 
        name, status, day, week, term, session, 
        class: activeClass, 
        date: new Date().toLocaleDateString() 
    });
    
    save();
    if (!silent) {
        renderStudentList();
        autoSync();
    }
}

function markAllPresent() {
    if (!activeClass || schoolData[activeClass].length === 0) return;
    const day = document.getElementById('daySelect').value;
    if (confirm(`Mark everyone in ${activeClass} as Present for ${day}?`)) {
        schoolData[activeClass].forEach(name => {
            mark(name, 'P', true);
        });
        renderStudentList();
        autoSync();
    }
}

function deleteAttendance(name) {
    const day = document.getElementById('daySelect').value;
    const week = document.getElementById('weekSelect').value;

    if (confirm(`Delete attendance record for ${name} on ${day}?`)) {
        records = records.filter(r => !(r.name === name && r.day === day && r.week === week && r.class === activeClass));
        save();
        renderStudentList();
        autoSync();
    }
}

// --- CLASS & STUDENT MANAGEMENT ---
function addClass() {
    const name = document.getElementById('newClassName').value.trim().toUpperCase();
    if (name && !schoolData[name]) {
        schoolData[name] = [];
        save();
        renderClassView();
        document.getElementById('newClassName').value = "";
    }
}

function deleteClass(cls) {
    if(confirm(`Delete ${cls} and all its students?`)) {
        delete schoolData[cls];
        save();
        renderClassView();
    }
}

function renderClassView() {
    const list = document.getElementById('vertical-class-list');
    if (!list) return;
    list.innerHTML = "";
    Object.keys(schoolData).sort().forEach(cls => {
        list.innerHTML += `
            <div class="vertical-item">
                <span onclick="showStudentView('${cls}')" style="flex:1; font-weight:bold;">${cls}</span>
                <button class="delete-btn" onclick="deleteClass('${cls}')">×</button>
            </div>`;
    });
}

function showStudentView(cls) {
    activeClass = cls;
    document.getElementById('class-view').classList.add('hidden');
    document.getElementById('student-view').classList.remove('hidden');
    document.getElementById('current-class-title').innerText = `Class: ${cls}`;
    renderStudentList();
}

function addStudent() {
    const name = document.getElementById('newStudentName').value.trim();
    if (name) {
        schoolData[activeClass].push(name);
        save();
        renderStudentList();
        document.getElementById('newStudentName').value = "";
    }
}

function deleteStudent(index) {
    if(confirm("Remove this student from the class list?")) {
        schoolData[activeClass].splice(index, 1);
        save();
        renderStudentList();
    }
}

function renderStudentList() {
    const list = document.getElementById('student-list-vertical');
    const day = document.getElementById('daySelect').value;
    const week = document.getElementById('weekSelect').value;
    
    if (!list) return;
    list.innerHTML = "";
    if (schoolData[activeClass]) {
        schoolData[activeClass].forEach((name, index) => {
            const record = records.find(r => r.name === name && r.day === day && r.week === week && r.class === activeClass);
            let dotClass = record ? (record.status === 'P' ? 'marked-p' : 'marked-a') : '';
            
            list.innerHTML += `
                <div class="student-row vertical-item">
                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                        <div class="status-dot ${dotClass}"></div>
                        <span>${name}</span>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button onclick="mark('${name}', 'P')" style="background:#00b894; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">P</button>
                        <button onclick="mark('${name}', 'A')" style="background:#d63031; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">A</button>
                        <button onclick="deleteAttendance('${name}')" style="background:none; border:1px solid #ff7675; color:#ff7675; padding:2px 5px; border-radius:4px; cursor:pointer;">🗑️</button>
                        <button class="delete-btn" onclick="deleteStudent(${index})" style="margin-left:10px;">×</button>
                    </div>
                </div>`;
        });
    }
}

// --- REPORTS & SESSION ---
function showCollation() {
    document.getElementById('report-view').classList.remove('hidden');
    const reportSelect = document.getElementById('reportClassSelect');
    reportSelect.innerHTML = `<option value="">-- Choose Class --</option>`;
    Object.keys(schoolData).sort().forEach(cls => {
        reportSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
    });
}

function generateSpecificReport() {
    const selectedClass = document.getElementById('reportClassSelect').value;
    const resultsDiv = document.getElementById('report-results');
    if (!selectedClass) return;

    let html = `<table><tr><th>Student</th><th>Opens</th><th>Present</th><th>Absent</th></tr>`;
    schoolData[selectedClass].forEach(name => {
        const studentRecs = records.filter(r => r.name === name && r.class === selectedClass);
        const present = studentRecs.filter(r => r.status === 'P').length * 2;
        const absent = studentRecs.filter(r => r.status === 'A').length * 2;
        html += `<tr><td>${name}</td><td>${present+absent}</td><td>${present}</td><td>${absent}</td></tr>`;
    });
    resultsDiv.innerHTML = html + `</table>`;
}

// Helpers
function closeReport() { document.getElementById('report-view').classList.add('hidden'); }
function save() {
    localStorage.setItem('jomade_schoolData', JSON.stringify(schoolData));
    localStorage.setItem('jomade_records', JSON.stringify(records));
}
function showClassView() { 
    document.getElementById('student-view').classList.add('hidden'); 
    document.getElementById('class-view').classList.remove('hidden'); 
}

// --- INIT ---
const ws = document.getElementById('weekSelect');
if (ws) {
    for(let i=1; i<=12; i++) ws.innerHTML += `<option>Week ${i}</option>`;
}
renderClassView();
loadDataFromCloud(); // Handles pulling list onto new devices automatically
autoSync();
