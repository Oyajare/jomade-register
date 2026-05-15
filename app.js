// 1. PASTE YOUR GOOGLE URL HERE
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGaxFBRhD3s7nnPg_5vfJaFWBu0l6vekliNWQGZnqoRpWDkSo2OyoEGJRd_YefwpbD/exec";
let schoolData = JSON.parse(localStorage.getItem('jomade_schoolData')) || {};
let records = JSON.parse(localStorage.getItem('jomade_records')) || [];
let history = JSON.parse(localStorage.getItem('jomade_history')) || [];
let activeClass = "";

// --- 1. AUTO-SYNC LOGIC ---
async function autoSync() {
    if (!navigator.onLine || records.length === 0) return;
    
    try {
        // Send data to Google Sheets
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

// Sync automatically when internet returns
window.addEventListener('online', autoSync);

// --- 2. ATTENDANCE LOGIC ---

function mark(name, status, silent = false) {
    const term = document.getElementById('termSelect').value;
    const week = document.getElementById('weekSelect').value;
    const day = document.getElementById('daySelect').value;
    const session = document.getElementById('sessionInput').value || "2024/2025";

    // Remove old mark for this day/student to avoid duplicates
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
            mark(name, 'P', true); // 'true' keeps it silent to avoid refreshing 50 times
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

// --- 3. CLASS & STUDENT MANAGEMENT ---

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

// --- 4. REPORTS & SESSION ---

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

function closeReport() { document.getElementById('report-view').classList.add('hidden'); }

function endLifecycle(type) {
    if (type === 'Session') {
        if (confirm("End Session? Promote students and clear logs?")) {
            let newData = {};
            let classes = Object.keys(schoolData).sort();
            for (let i = classes.length - 1; i >= 0; i--) {
                let currentCls = classes[i];
                let nextCls = classes[i+1];
                if (nextCls) newData[nextCls] = schoolData[currentCls];
            }
            newData[classes[0]] = []; 
            history.push({ session: document.getElementById('sessionInput').value, records: [...records] });
            schoolData = newData;
            records = [];
            save();
            localStorage.setItem('jomade_history', JSON.stringify(history));
            location.reload();
        }
    }
}

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
for(let i=1; i<=12; i++) ws.innerHTML += `<option>Week ${i}</option>`;
renderClassView();
autoSync();