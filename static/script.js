/* ==========================================================================
   CLAIMPULSE - PREMIUM DARK INSURTECH SAAS APPLICATION JAVASCRIPT
   Single-Page View Controller, Dashboard Visualizations, Analytics, Wizard & Modals
   ========================================================================== */

let activeModalClaimId = null;

const VIEW_TITLES = {
    'dashboard': 'Operations Dashboard',
    'submit': 'Fast-Track Claim Intake',
    'track': 'Real-Time Claim Tracker',
    'claims': 'Full Claims Queue',
    'officer': 'Officer Command Center',
    'analytics': 'System Analytics & Insights',
    'how': 'Workflow & Integration Architecture'
};

document.addEventListener('DOMContentLoaded', () => {
    initDocumentSelector();
    initWizardForm();
    initTrackClaim();
    initDashboardFilters();
    loadDashboardView();
});

// ==========================================
// 1. SIDEBAR & VIEW SWITCHER
// ==========================================
function switchView(viewName) {
    // Hide all view panes & deactivate menu items
    const panes = document.querySelectorAll('.view-pane');
    panes.forEach(p => p.classList.add('hidden'));

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => n.classList.remove('active'));

    const targetPane = document.getElementById(`view-${viewName}`);
    const targetNav = document.getElementById(`nav-${viewName}`);

    if (targetPane) targetPane.classList.remove('hidden');
    if (targetNav) targetNav.classList.add('active');

    const titleElem = document.getElementById('currentViewTitle');
    if (titleElem) titleElem.innerText = VIEW_TITLES[viewName] || 'ClaimPulse SaaS';

    // Trigger data loaders per view
    if (viewName === 'dashboard') loadDashboardView();
    else if (viewName === 'claims') fetchFilteredClaims();
    else if (viewName === 'officer') loadOfficerDashboard();
    else if (viewName === 'analytics') loadAnalyticsView();
}

window.switchView = switchView;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

window.toggleSidebar = toggleSidebar;

function handleGlobalSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            switchView('claims');
            const searchInput = document.getElementById('filterSearch');
            if (searchInput) {
                searchInput.value = query;
                fetchFilteredClaims();
            }
        }
    }
}

window.handleGlobalSearch = handleGlobalSearch;

// ==========================================
// 2. MAIN DASHBOARD VIEW & VISUALIZATIONS
// ==========================================
async function loadDashboardView() {
    try {
        const [dashRes, analyticsRes] = await Promise.all([
            fetch('/officer-dashboard'),
            fetch('/analytics')
        ]);

        const dashData = await dashRes.json();
        const analyticsData = await analyticsRes.json();

        if (dashRes.ok && dashData.success) {
            const stats = dashData.stats;
            document.getElementById('dashTotalClaims').innerText = stats.total_claims;
            document.getElementById('dashPendingClaims').innerText = stats.pending_claims;
            document.getElementById('dashApprovedClaims').innerText = stats.approved_claims;
            document.getElementById('dashRejectedClaims').innerText = stats.rejected_claims;
            document.getElementById('dashHighRiskClaims').innerText = stats.high_risk_claims;
            document.getElementById('dashDocsReqClaims').innerText = stats.claims_requiring_docs || 0;

            renderRecentClaimsTable(dashData.claims || []);
            renderActivityFeed(dashData.claims || []);
        }

        if (analyticsRes.ok && analyticsData.success) {
            const an = analyticsData.analytics;
            renderBarChart('riskChartContainer', an.by_risk, 'Risk', { 'LOW': 'bg-green', 'MEDIUM': 'bg-orange', 'HIGH': 'bg-red' });
            renderBarChart('statusChartContainer', an.by_status, 'Status', { 'Submitted': 'bg-blue', 'Under Review': 'bg-orange', 'Approved': 'bg-green', 'Rejected': 'bg-red' });
        }

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

function renderBarChart(containerId, dataMap, labelPrefix, colorMap) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    if (!dataMap || Object.keys(dataMap).length === 0) {
        container.innerHTML = `<p class="text-muted p-2">No visualization data available.</p>`;
        return;
    }

    const total = Object.values(dataMap).reduce((a, b) => a + b, 0) || 1;

    Object.entries(dataMap).forEach(([key, val]) => {
        const pct = Math.round((val / total) * 100);
        const colorClass = colorMap[key] || 'bg-blue';

        const row = document.createElement('div');
        row.className = 'chart-bar-row';
        row.innerHTML = `
            <div class="chart-bar-info">
                <span>${escapeHtml(key)}</span>
                <span>${val} (${pct}%)</span>
            </div>
            <div class="bar-fill-bg">
                <div class="bar-fill-inner ${colorClass}" style="width: ${pct}%;"></div>
            </div>
        `;
        container.appendChild(row);
    });
}

function renderRecentClaimsTable(claims) {
    const tbody = document.getElementById('dashRecentTbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const recent = claims.slice(0, 5);

    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No recent claims submitted.</td></tr>`;
        return;
    }

    recent.forEach(c => {
        const tr = document.createElement('tr');
        const riskClass = (c.risk || 'MEDIUM').toLowerCase();
        const amountFormatted = `₹${parseFloat(c.claim_amount).toLocaleString('en-IN')}`;

        tr.innerHTML = `
            <td><strong>${c.claim_id}</strong></td>
            <td>${escapeHtml(c.customer_name)}</td>
            <td>${escapeHtml(c.claim_type)}</td>
            <td><strong class="text-blue">${amountFormatted}</strong></td>
            <td><span class="risk-badge risk-${riskClass}">${c.risk}</span></td>
            <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
            <td class="text-right">
                <button class="btn btn-secondary btn-sm" onclick="openCaseModal('${c.claim_id}')">
                    Inspect
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderActivityFeed(claims) {
    const feedUl = document.getElementById('dashActivityFeed');
    if (!feedUl) return;

    feedUl.innerHTML = '';
    const events = [];

    claims.forEach(c => {
        if (c.activity_timeline) {
            c.activity_timeline.forEach(ev => {
                events.push({
                    claim_id: c.claim_id,
                    ...ev
                });
            });
        }
    });

    events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    const topEvents = events.slice(0, 6);

    if (topEvents.length === 0) {
        feedUl.innerHTML = `<li class="text-muted text-center py-3">No activity logged.</li>`;
        return;
    }

    topEvents.forEach(ev => {
        const li = document.createElement('li');
        li.className = `activity-item ${ev.event_type === 'OFFICER_DECISION' ? 'type-decision' : ''}`;
        li.innerHTML = `
            <div class="activity-header">
                <span>${ev.claim_id} - ${escapeHtml(ev.event_type)}</span>
                <span class="text-muted" style="font-size:0.75rem;">${escapeHtml(ev.timestamp)}</span>
            </div>
            <div class="activity-desc">${escapeHtml(ev.description)} (${escapeHtml(ev.actor)})</div>
        `;
        feedUl.appendChild(li);
    });
}

// ==========================================
// 3. ANALYTICS VIEW
// ==========================================
async function loadAnalyticsView() {
    try {
        const response = await fetch('/analytics');
        const data = await response.json();

        if (response.ok && data.success) {
            const an = data.analytics;
            
            document.getElementById('anTotalVolume').innerText = `₹${parseFloat(an.total_claim_amount || 0).toLocaleString('en-IN')}`;
            document.getElementById('anTotalProcessed').innerText = an.total_processed;
            document.getElementById('anHighRiskPct').innerText = `${an.high_risk_pct}%`;
            document.getElementById('anApprovalPct').innerText = `${an.approval_rate_pct}%`;

            renderBarChart('anCategoryChart', an.by_type, 'Category', {
                'Health Insurance': 'bg-blue',
                'Vehicle Insurance': 'bg-violet',
                'Travel Insurance': 'bg-green',
                'Property Insurance': 'bg-orange'
            });

            renderBarChart('anStatusChart', an.by_status, 'Status', {
                'Submitted': 'bg-blue',
                'Under Review': 'bg-orange',
                'Approved': 'bg-green',
                'Rejected': 'bg-red'
            });
        }
    } catch (err) {
        console.error("Analytics Load Error:", err);
    }
}

// ==========================================
// 4. DYNAMIC DOCUMENT SELECTOR FOR FORM
// ==========================================
function initDocumentSelector() {
    const claimTypeSelect = document.getElementById('claimType');
    const documentCheckboxesContainer = document.getElementById('documentCheckboxes');

    if (!claimTypeSelect || !documentCheckboxesContainer) return;

    claimTypeSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        const requiredDocs = REQUIRED_DOCS_MAP[selectedType] || ["ID Proof", "Claim Form", "Supporting Evidence"];

        documentCheckboxesContainer.innerHTML = '';

        requiredDocs.forEach((doc, idx) => {
            const item = document.createElement('label');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" name="documents" value="${doc}" ${idx === 0 ? 'checked' : ''}>
                <span>${doc}</span>
            `;
            documentCheckboxesContainer.appendChild(item);
        });
    });
}

const REQUIRED_DOCS_MAP = {
    "Vehicle Insurance": ["Driving License", "Vehicle RC", "FIR / Incident Report"],
    "Health Insurance": ["Medical Bill", "Discharge Summary", "ID Proof"],
    "Travel Insurance": ["Ticket", "Travel Proof", "Incident Report"],
    "Property Insurance": ["Property Document", "Damage Proof", "Incident Report"]
};

// ==========================================
// 5. WIZARD STEPPER & AI PRE-CHECK
// ==========================================
function goToStep(stepNum) {
    if (stepNum > 1) {
        const name = document.getElementById('customerName').value.trim();
        const contact = document.getElementById('contactNumber').value.trim();
        const date = document.getElementById('incidentDate').value;
        if (!name || !contact || !date) {
            showToast("Please complete Step 1 fields.", "error");
            return;
        }
    }

    if (stepNum > 2) {
        const policy = document.getElementById('policyNumber').value.trim();
        const type = document.getElementById('claimType').value;
        const amount = document.getElementById('claimAmount').value;
        if (!policy || !type || !amount || parseFloat(amount) <= 0) {
            showToast("Please enter valid Step 2 policy details.", "error");
            return;
        }
    }

    for (let i = 1; i <= 5; i++) {
        const pane = document.getElementById(`pane-step${i}`);
        const node = document.getElementById(`node-step${i}`);
        if (pane) pane.classList.add('hidden');
        if (node) {
            node.classList.remove('active');
            if (i < stepNum) node.classList.add('completed');
            else node.classList.remove('completed');
        }
    }

    const targetPane = document.getElementById(`pane-step${stepNum}`);
    const targetNode = document.getElementById(`node-step${stepNum}`);
    if (targetPane) targetPane.classList.remove('hidden');
    if (targetNode) targetNode.classList.add('active');
}

window.goToStep = goToStep;

async function runAIPreCheck() {
    const claimAmount = parseFloat(document.getElementById('claimAmount').value || 0);
    const claimType = document.getElementById('claimType').value;
    
    const checkedDocBoxes = document.querySelectorAll('input[name="documents"]:checked');
    const documents = Array.from(checkedDocBoxes).map(cb => cb.value);

    goToStep(4);

    const loadingCard = document.getElementById('precheckLoading');
    const resultGrid = document.getElementById('precheckResult');

    loadingCard.classList.remove('hidden');
    resultGrid.classList.add('hidden');

    try {
        const response = await fetch('/ai-precheck', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claim_amount: claimAmount,
                claim_type: claimType,
                documents: documents
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const pre = data.precheck;
            
            document.getElementById('preReadiness').innerText = `${pre.claim_readiness}% (${pre.readiness_status})`;
            
            const badge = document.getElementById('preRisk');
            badge.innerText = pre.risk;
            badge.className = `risk-badge risk-${pre.risk.toLowerCase()}`;

            const missingSpan = document.getElementById('preMissing');
            if (pre.missing_documents && pre.missing_documents.length > 0) {
                missingSpan.innerText = pre.missing_documents.join(', ');
                missingSpan.className = 'box-val text-warning';
            } else {
                missingSpan.innerText = 'None';
                missingSpan.className = 'box-val text-success';
            }

            document.getElementById('preNextAction').innerText = pre.ai_recommendation;

            setTimeout(() => {
                loadingCard.classList.add('hidden');
                resultGrid.classList.remove('hidden');
            }, 600);
        }
    } catch (err) {
        console.error("AI Pre-Check Error:", err);
        loadingCard.classList.add('hidden');
        resultGrid.classList.remove('hidden');
    }
}

window.runAIPreCheck = runAIPreCheck;

function initWizardForm() {
    const wizardForm = document.getElementById('wizardForm');
    const finalSubmitBtn = document.getElementById('finalSubmitBtn');
    const submissionResult = document.getElementById('submissionResult');
    const resetWizardBtn = document.getElementById('resetWizardBtn');

    if (!wizardForm) return;

    wizardForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const customerName = document.getElementById('customerName').value.trim();
        const policyNumber = document.getElementById('policyNumber').value.trim();
        const claimType = document.getElementById('claimType').value;
        const claimAmount = document.getElementById('claimAmount').value;
        const incidentDate = document.getElementById('incidentDate').value;
        const contactNumber = document.getElementById('contactNumber').value.trim();

        const checkedDocBoxes = document.querySelectorAll('input[name="documents"]:checked');
        const documents = Array.from(checkedDocBoxes).map(cb => cb.value);

        const payload = {
            customer_name: customerName,
            policy_number: policyNumber,
            claim_type: claimType,
            claim_amount: parseFloat(claimAmount),
            incident_date: incidentDate,
            contact_number: contactNumber,
            documents: documents
        };

        finalSubmitBtn.disabled = true;
        finalSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting to MongoDB...`;

        try {
            const response = await fetch('/submit-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                document.getElementById('resClaimId').innerText = data.claim_id;
                document.getElementById('resStatus').innerText = data.status || "Submitted";
                document.getElementById('resReadiness').innerText = `${data.claim_readiness}% (${data.readiness_status})`;
                
                const riskBadge = document.getElementById('resRiskBadge');
                riskBadge.innerText = data.risk;
                riskBadge.className = `risk-badge risk-${data.risk.toLowerCase()}`;

                document.getElementById('resRecommendation').innerText = data.recommendation;
                document.getElementById('resRequiredDocs').innerText = (data.required_documents || []).join(', ') || 'None';
                
                const missingSpan = document.getElementById('resMissingDocs');
                if (data.missing_documents && data.missing_documents.length > 0) {
                    missingSpan.innerText = data.missing_documents.join(', ');
                } else {
                    missingSpan.innerText = 'None';
                    missingSpan.className = 'text-success';
                }

                const findingsList = document.getElementById('resFindingsList');
                findingsList.innerHTML = '';
                (data.contributing_factors || []).forEach(f => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${escapeHtml(f.factor)}</span> <strong class="text-blue">${escapeHtml(f.impact)}</strong>`;
                    findingsList.appendChild(li);
                });

                wizardForm.classList.add('hidden');
                submissionResult.classList.remove('hidden');
                showToast(`Claim ${data.claim_id} created successfully!`, "success");

                loadDashboardView();
            } else {
                showToast(data.error || "Submission failed.", "error");
            }

        } catch (err) {
            console.error("Submission Error:", err);
            showToast("Server connection error.", "error");
        } finally {
            finalSubmitBtn.disabled = false;
            finalSubmitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Submit Claim`;
        }
    });

    if (resetWizardBtn) {
        resetWizardBtn.addEventListener('click', () => {
            wizardForm.reset();
            submissionResult.classList.add('hidden');
            wizardForm.classList.remove('hidden');
            goToStep(1);
        });
    }
}

function trackNewClaim() {
    const createdId = document.getElementById('resClaimId').innerText;
    if (createdId) {
        switchView('track');
        document.getElementById('trackClaimId').value = createdId;
        const trackBtn = document.getElementById('trackBtn');
        if (trackBtn) trackBtn.click();
    }
}

window.trackNewClaim = trackNewClaim;

// ==========================================
// 6. TRACK CLAIM (GET /claim/<claim_id>)
// ==========================================
function initTrackClaim() {
    const trackBtn = document.getElementById('trackBtn');
    const trackClaimIdInput = document.getElementById('trackClaimId');
    const trackResult = document.getElementById('trackResult');
    const trackError = document.getElementById('trackError');

    if (!trackBtn || !trackClaimIdInput) return;

    const performTrack = async () => {
        const claimId = trackClaimIdInput.value.trim();
        if (!claimId) {
            showToast("Please enter a valid Claim ID (e.g. CP-00001).", "error");
            return;
        }

        trackBtn.disabled = true;
        trackBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Searching...`;

        try {
            const response = await fetch(`/claim/${encodeURIComponent(claimId)}`);
            const data = await response.json();

            if (response.ok && data.success) {
                const claim = data.claim;
                
                document.getElementById('trClaimId').innerText = claim.claim_id;
                document.getElementById('trCustomer').innerText = claim.customer_name;
                
                const badge = document.getElementById('trRiskBadge');
                badge.innerText = claim.risk || 'MEDIUM';
                badge.className = `risk-badge risk-${(claim.risk || 'medium').toLowerCase()}`;

                document.getElementById('trPolicy').innerText = claim.policy_number;
                document.getElementById('trType').innerText = claim.claim_type;
                document.getElementById('trAmount').innerText = `₹${parseFloat(claim.claim_amount).toLocaleString('en-IN')}`;
                document.getElementById('trReadiness').innerText = `${claim.claim_readiness || 80}% (${claim.readiness_status || 'READY'})`;
                document.getElementById('trStatus').innerText = claim.status;
                document.getElementById('trRecommendation').innerText = claim.ai_recommendation || claim.recommendation;

                updateTimeline(claim.status);

                const findingsUl = document.getElementById('trFindingsList');
                findingsUl.innerHTML = '';
                (claim.contributing_factors || []).forEach(f => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${escapeHtml(f.factor)}</span> <strong class="text-blue">${escapeHtml(f.impact)}</strong>`;
                    findingsUl.appendChild(li);
                });

                const activityUl = document.getElementById('trActivityTimeline');
                activityUl.innerHTML = '';
                (claim.activity_timeline || []).forEach(ev => {
                    const li = document.createElement('li');
                    li.innerHTML = `<div><strong>${escapeHtml(ev.event_type)}</strong> - ${escapeHtml(ev.description)}</div> <span class="text-muted" style="font-size:0.75rem;">${escapeHtml(ev.timestamp)} (${escapeHtml(ev.actor)})</span>`;
                    activityUl.appendChild(li);
                });

                trackError.classList.add('hidden');
                trackResult.classList.remove('hidden');

            } else {
                trackResult.classList.add('hidden');
                document.getElementById('trackErrorMsg').innerText = data.error || "Claim not found.";
                trackError.classList.remove('hidden');
            }

        } catch (err) {
            console.error("Track Error:", err);
            trackResult.classList.add('hidden');
            document.getElementById('trackErrorMsg').innerText = "Failed to communicate with server.";
            trackError.classList.remove('hidden');
        } finally {
            trackBtn.disabled = false;
            trackBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Track Claim`;
        }
    };

    trackBtn.addEventListener('click', performTrack);
    trackClaimIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performTrack();
    });
}

function updateTimeline(status) {
    const sSubmitted = document.getElementById('step-submitted');
    const sAnalysis = document.getElementById('step-analysis');
    const sDocCheck = document.getElementById('step-doc-check');
    const sOfficer = document.getElementById('step-officer');
    const sResolution = document.getElementById('step-resolution');

    const steps = [sSubmitted, sAnalysis, sDocCheck, sOfficer, sResolution];
    steps.forEach(s => s.className = 'timeline-step');

    sSubmitted.classList.add('completed');
    sAnalysis.classList.add('completed');
    sDocCheck.classList.add('completed');

    if (status === 'Submitted' || status === 'Under Review') {
        sOfficer.classList.add('active');
    } else if (status === 'Approved' || status === 'Rejected') {
        sOfficer.classList.add('completed');
        sResolution.classList.add('completed');
    }
}

// ==========================================
// 7. OFFICER DASHBOARD & CLAIMS QUEUE
// ==========================================
function initDashboardFilters() {
    const searchInput = document.getElementById('filterSearch');
    const filterRisk = document.getElementById('filterRisk');
    const filterStatus = document.getElementById('filterStatus');
    const filterType = document.getElementById('filterType');
    const filterSort = document.getElementById('filterSort');

    [searchInput, filterRisk, filterStatus, filterType, filterSort].forEach(elem => {
        if (elem) {
            elem.addEventListener('input', fetchFilteredClaims);
            elem.addEventListener('change', fetchFilteredClaims);
        }
    });
}

async function loadOfficerDashboard() {
    try {
        const response = await fetch('/officer-dashboard');
        const data = await response.json();

        if (response.ok && data.success) {
            renderPriorityQueue(data.priority_queue || []);
            renderOfficerTable(data.claims || []);
        }
    } catch (err) {
        console.error("Officer Dashboard Error:", err);
    }
}

function renderPriorityQueue(queue) {
    const container = document.getElementById('priorityQueueContainer');
    if (!container) return;

    container.innerHTML = '';
    if (queue.length === 0) {
        container.innerHTML = `<p class="text-muted p-3">No critical cases pending review.</p>`;
        return;
    }

    queue.forEach(c => {
        const card = document.createElement('div');
        const prioLower = (c.priority || 'high').toLowerCase();
        card.className = 'prio-card';
        card.onclick = () => openCaseModal(c.claim_id);

        card.innerHTML = `
            <div class="prio-top">
                <strong>${c.claim_id} (${escapeHtml(c.customer_name)})</strong>
                <span class="prio-badge prio-${prioLower}">${c.priority} PRIORITY</span>
            </div>
            <div class="flex-between">
                <span class="text-muted">${escapeHtml(c.claim_type)}</span>
                <strong class="text-gradient">₹${parseFloat(c.claim_amount).toLocaleString('en-IN')}</strong>
            </div>
            <div class="text-muted" style="font-size:0.75rem;">
                <i class="fa-solid fa-robot"></i> ${escapeHtml(c.ai_recommendation || 'Review required')}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderOfficerTable(claims) {
    const tbody = document.getElementById('officerTbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (claims.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No claims in queue.</td></tr>`;
        return;
    }

    claims.forEach(c => {
        const tr = document.createElement('tr');
        const riskClass = (c.risk || 'MEDIUM').toLowerCase();
        const amountFormatted = `₹${parseFloat(c.claim_amount).toLocaleString('en-IN')}`;

        tr.innerHTML = `
            <td><strong>${c.claim_id}</strong></td>
            <td>${escapeHtml(c.customer_name)}</td>
            <td>${escapeHtml(c.claim_type)}</td>
            <td><strong class="text-blue">${amountFormatted}</strong></td>
            <td><span class="risk-badge risk-${riskClass}">${c.risk}</span></td>
            <td><strong>${c.claim_readiness || 80}%</strong></td>
            <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
            <td class="text-right">
                <div class="action-btns">
                    <button class="btn-action btn-approve" onclick="submitDecisionDirect('${c.claim_id}', 'Approved')">Approve</button>
                    <button class="btn-action btn-review" onclick="submitDecisionDirect('${c.claim_id}', 'Under Review')">Review</button>
                    <button class="btn-action btn-reject" onclick="submitDecisionDirect('${c.claim_id}', 'Rejected')">Reject</button>
                    <button class="btn btn-secondary btn-sm" onclick="openCaseModal('${c.claim_id}')"><i class="fa-solid fa-folder-open"></i> Details</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function fetchFilteredClaims() {
    const tbody = document.getElementById('claimsQueueTbody');
    if (!tbody) return;

    const q = document.getElementById('filterSearch').value.trim();
    const risk = document.getElementById('filterRisk').value;
    const status = document.getElementById('filterStatus').value;
    const type = document.getElementById('filterType').value;
    const sort = document.getElementById('filterSort').value;

    const params = new URLSearchParams({ q: q, risk: risk, status: status, type: type, sort: sort });

    try {
        const response = await fetch(`/claims?${params.toString()}`);
        const data = await response.json();

        if (response.ok && data.success) {
            const claims = data.claims || [];
            tbody.innerHTML = '';

            if (claims.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No matching claims found.</td></tr>`;
                return;
            }

            claims.forEach(c => {
                const tr = document.createElement('tr');
                const riskClass = (c.risk || 'MEDIUM').toLowerCase();
                const amountFormatted = `₹${parseFloat(c.claim_amount).toLocaleString('en-IN')}`;

                tr.innerHTML = `
                    <td><strong>${c.claim_id}</strong></td>
                    <td>${escapeHtml(c.customer_name)}</td>
                    <td>${escapeHtml(c.claim_type)}</td>
                    <td><strong class="text-blue">${amountFormatted}</strong></td>
                    <td><span class="risk-badge risk-${riskClass}">${c.risk}</span></td>
                    <td><strong>${c.claim_readiness || 80}%</strong></td>
                    <td><span class="text-muted" style="font-size:0.85rem;">${escapeHtml(c.ai_recommendation || c.recommendation)}</span></td>
                    <td><span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
                    <td class="text-right">
                        <button class="btn btn-secondary btn-sm" onclick="openCaseModal('${c.claim_id}')">
                            Inspect Case
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Fetch Filtered Claims Error:", err);
    }
}

// ==========================================
// 8. CASE WORKSPACE MODAL
// ==========================================
async function openCaseModal(claimId) {
    activeModalClaimId = claimId;
    const overlay = document.getElementById('caseModalOverlay');
    if (!overlay) return;

    try {
        const response = await fetch(`/claim/${claimId}`);
        const data = await response.json();

        if (response.ok && data.success) {
            const c = data.claim;
            
            document.getElementById('modalClaimId').innerText = c.claim_id;
            document.getElementById('modalCustomer').innerText = c.customer_name;
            
            const badge = document.getElementById('modalRiskBadge');
            badge.innerText = c.risk;
            badge.className = `risk-badge risk-${(c.risk || 'medium').toLowerCase()}`;

            document.getElementById('mdPolicy').innerText = c.policy_number;
            document.getElementById('mdType').innerText = c.claim_type;
            document.getElementById('mdAmount').innerText = `₹${parseFloat(c.claim_amount).toLocaleString('en-IN')}`;
            document.getElementById('mdIncidentDate').innerText = c.incident_date;
            document.getElementById('mdContact').innerText = c.contact_number;
            document.getElementById('mdStage').innerText = c.current_stage || c.status;

            document.getElementById('mdRequiredDocs').innerText = (c.required_documents || []).join(', ') || 'None';
            document.getElementById('mdSubmittedDocs').innerText = (c.documents || []).join(', ') || 'None';
            
            const missingSpan = document.getElementById('mdMissingDocs');
            if (c.missing_documents && c.missing_documents.length > 0) {
                missingSpan.innerText = c.missing_documents.join(', ');
                missingSpan.className = 'text-danger';
            } else {
                missingSpan.innerText = 'None';
                missingSpan.className = 'text-success';
            }

            const factorsUl = document.getElementById('mdContributingFactors');
            factorsUl.innerHTML = '';
            (c.contributing_factors || []).forEach(f => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${escapeHtml(f.factor)}</span> <strong class="text-blue">${escapeHtml(f.impact)}</strong>`;
                factorsUl.appendChild(li);
            });

            const excDiv = document.getElementById('mdExceptionsList');
            excDiv.innerHTML = '';
            if (c.exceptions && c.exceptions.length > 0) {
                c.exceptions.forEach(ex => {
                    const box = document.createElement('div');
                    box.className = 'res-finding mb-2';
                    box.innerHTML = `
                        <strong>[${escapeHtml(ex.type)}] - Severity: ${escapeHtml(ex.severity)}</strong>
                        <p>${escapeHtml(ex.reason)}</p>
                        <span class="text-blue" style="font-size:0.8rem;">Action: ${escapeHtml(ex.recommended_action)}</span>
                    `;
                    excDiv.appendChild(box);
                });
            } else {
                excDiv.innerHTML = `<p class="text-success"><i class="fa-solid fa-check"></i> No critical exceptions detected.</p>`;
            }

            const timelineUl = document.getElementById('mdTimeline');
            timelineUl.innerHTML = '';
            (c.activity_timeline || []).forEach(ev => {
                const li = document.createElement('li');
                li.innerHTML = `<div><strong>${escapeHtml(ev.event_type)}</strong> - ${escapeHtml(ev.description)}</div> <span class="text-muted" style="font-size:0.75rem;">${escapeHtml(ev.timestamp)} (${escapeHtml(ev.actor)})</span>`;
                timelineUl.appendChild(li);
            });

            document.getElementById('mdRecommendation').innerText = c.ai_recommendation || c.recommendation;

            switchModalTab('overview');
            overlay.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Open Modal Error:", err);
        showToast("Failed to load claim detail.", "error");
    }
}

window.openCaseModal = openCaseModal;

function closeCaseModal() {
    const overlay = document.getElementById('caseModalOverlay');
    if (overlay) overlay.classList.add('hidden');
    activeModalClaimId = null;
}

window.closeCaseModal = closeCaseModal;

function switchModalTab(tabName) {
    const tabs = ['overview', 'documents', 'risk', 'exceptions', 'timeline'];
    tabs.forEach(t => {
        const pane = document.getElementById(`pane-${t}`);
        if (pane) pane.classList.add('hidden');
    });

    const activePane = document.getElementById(`pane-${tabName}`);
    if (activePane) activePane.classList.remove('hidden');

    const tabBtns = document.querySelectorAll('.modal-tabs .tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });
}

window.switchModalTab = switchModalTab;

async function submitModalDecision(decision) {
    if (!activeModalClaimId) return;
    await submitDecisionDirect(activeModalClaimId, decision);
    closeCaseModal();
}

window.submitModalDecision = submitModalDecision;

async function submitDecisionDirect(claimId, decision) {
    try {
        const response = await fetch(`/claim/${claimId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision: decision })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(`Claim ${claimId} set to '${decision}'`, "success");
            loadDashboardView();
            loadOfficerDashboard();
            fetchFilteredClaims();
        } else {
            showToast(data.error || "Failed to update status.", "error");
        }
    } catch (err) {
        console.error("Decision Error:", err);
        showToast("Failed to submit decision.", "error");
    }
}

window.submitDecisionDirect = submitDecisionDirect;

function getStatusBadgeClass(status) {
    if (status === 'Approved') return 'badge-success';
    if (status === 'Rejected') return 'badge-danger';
    return 'badge-warning';
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}
