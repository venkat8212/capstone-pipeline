/**
 * Enterprise Project Management & Collaboration System - Core Logic
 * Integrated with the Python Flask Backend API and SQLite Database
 */

const API_BASE = 'http://localhost:5000/api';

// Global Client-Side State Cache
let state = {
    users: [],
    projects: [],
    tasks: [],
    chat: [],
    documents: [],
    notifications: [],
    resources: [],
    pipelines: []
};

// API Call Wrapper
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.msg || 'API Error');
        }
        return await res.json();
    } catch (err) {
        showToast(err.message, 'danger');
        throw err;
    }
}

// Session Management
let currentUser = null;

function getCurrentUser() {
    const session = sessionStorage.getItem('epms_session');
    if (session) {
        currentUser = JSON.parse(session);
        return currentUser;
    }
    return null;
}

async function loginUser(email, password) {
    try {
        const result = await apiCall('/auth/login', 'POST', { email, password });
        if (result.success) {
            currentUser = result.user;
            sessionStorage.setItem('epms_session', JSON.stringify(currentUser));
            
            // Send login notification to backend database
            await addNotification(`User ${currentUser.name} logged in successfully.`);
            await checkUpcomingDeadlines();
            return true;
        }
    } catch (e) {
        // handled in wrapper
    }
    return false;
}

async function registerUser(name, email, password, role) {
    try {
        const result = await apiCall('/auth/register', 'POST', { name, email, password, role });
        return result;
    } catch (e) {
        return { success: false, msg: e.message };
    }
}

function logoutUser() {
    sessionStorage.removeItem('epms_session');
    currentUser = null;
    window.location.reload();
}

// Router & Views
function initRouter() {
    const navItems = document.querySelectorAll('.sidebar-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.getAttribute('data-target');
            if (targetPage) {
                switchPage(targetPage);
            }
        });
    });
}

function switchPage(pageId) {
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetElement = document.getElementById(`${pageId}-page`);
    if (targetElement) {
        targetElement.classList.add('active');
        const activeNav = document.querySelector(`.sidebar-item[data-target="${pageId}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Set title header
        const pageTitle = pageId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        document.getElementById('header-title-text').innerText = pageTitle;

        // Render page specific data
        renderPageData(pageId);
    }
}

// Notification Engine
async function addNotification(text) {
    const noti = {
        id: 'noti-' + Date.now(),
        text: text,
        time: new Date().toISOString(),
        read: 0
    };
    try {
        await apiCall('/notifications', 'POST', noti);
        await updateNotificationsUI();
        showToast(text);
    } catch (e) {
        console.error("Failed to post notification to DB:", e);
    }
}

function showToast(text, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="lucide-bell"></i> <span>${text}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function checkUpcomingDeadlines() {
    if (!currentUser) return;
    const today = new Date();
    try {
        const tasks = await apiCall('/tasks');
        tasks.forEach(task => {
            if (task.assignee === currentUser.name && task.status !== 'completed') {
                const due = new Date(task.deadline);
                const diffTime = due - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 3) {
                    addNotification(`Urgent Task: "${task.title}" is due in ${diffDays} day(s).`);
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function updateNotificationsUI() {
    try {
        state.notifications = await apiCall('/notifications');
        const unread = state.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('noti-badge');
        if (badge) {
            badge.innerText = unread;
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }

        const list = document.getElementById('noti-list');
        if (list) {
            list.innerHTML = '';
            if (state.notifications.length === 0) {
                list.innerHTML = `<div class="noti-empty">No new notifications</div>`;
                return;
            }
            state.notifications.forEach(n => {
                const timeStr = new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const item = document.createElement('div');
                item.className = 'noti-item';
                item.innerHTML = `
                    <div>${n.text}</div>
                    <div class="noti-time">${timeStr}</div>
                `;
                item.addEventListener('click', async () => {
                    await apiCall('/notifications/read', 'PUT', { id: n.id });
                    updateNotificationsUI();
                });
                list.appendChild(item);
            });
        }
    } catch (e) {
        console.error("Failed to load notifications list UI:", e);
    }
}

// Rendering Switchboard
async function renderPageData(pageId) {
    if (!currentUser) return;
    
    // Update User Panel in Sidebar
    const avatarContainer = document.getElementById('sidebar-user-avatar');
    if (avatarContainer) avatarContainer.innerText = currentUser.avatar;
    const nameContainer = document.getElementById('sidebar-user-name');
    if (nameContainer) nameContainer.innerText = currentUser.name;
    const roleContainer = document.getElementById('sidebar-user-role');
    if (roleContainer) roleContainer.innerText = `${currentUser.role} Role`;

    switch (pageId) {
        case 'dashboard':
            await renderDashboard();
            break;
        case 'projects':
            await renderProjects();
            break;
        case 'tasks':
            await renderTasks();
            break;
        case 'collaboration':
            await renderCollaboration();
            break;
        case 'resources':
            await renderResources();
            break;
        case 'reports':
            await renderReports();
            break;
        case 'pipeline':
            await renderPipeline();
            break;
        case 'security':
            await renderSecurity();
            break;
    }
    
    // Initialize icons using Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// 1. Dashboard Logic
async function renderDashboard() {
    try {
        state.projects = await apiCall('/projects');
        state.tasks = await apiCall('/tasks');
        state.resources = await apiCall('/resources');
        
        // Total Projects
        document.getElementById('dash-total-projects').innerText = state.projects.length;

        // Completed Projects
        const completedProj = state.projects.filter(p => p.status === 'completed').length;
        document.getElementById('dash-completed-projects').innerText = completedProj;

        // Active Tasks
        const activeTasks = state.tasks.filter(t => t.status !== 'completed').length;
        document.getElementById('dash-active-tasks').innerText = activeTasks;

        // Team Members
        const backup = await apiCall('/backup');
        document.getElementById('dash-team-count').innerText = backup.users ? backup.users.length : 4;

        // Project Progress Overview List
        const progressList = document.getElementById('dash-project-progress-list');
        if (progressList) {
            progressList.innerHTML = '';
            state.projects.forEach(p => {
                const pTasks = state.tasks.filter(t => t.projectId === p.id);
                let percent = 0;
                if (pTasks.length > 0) {
                    const comp = pTasks.filter(t => t.status === 'completed').length;
                    percent = Math.round((comp / pTasks.length) * 100);
                } else {
                    percent = p.status === 'completed' ? 100 : (p.status === 'in-progress' ? 50 : 0);
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${p.name}</strong></td>
                    <td>${p.manager}</td>
                    <td><span class="badge badge-${p.status}">${p.status.replace('-', ' ')}</span></td>
                    <td>
                        <div class="progress-container">
                            <div class="progress-bar-wrapper">
                                <div class="progress-bar-fill" style="width: ${percent}%"></div>
                            </div>
                            <span style="font-size: 0.8rem; width: 35px;">${percent}%</span>
                        </div>
                    </td>
                `;
                progressList.appendChild(tr);
            });
        }

        // Workload alerts list
        const workloadList = document.getElementById('dash-workload-alerts');
        if (workloadList) {
            workloadList.innerHTML = '';
            state.resources.forEach(res => {
                const activeT = state.tasks.filter(t => t.assignee === res.name && t.status !== 'completed').length;
                let badgeClass = 'color-success';
                let warningText = 'Optimal workload';
                if (activeT >= 3) {
                    badgeClass = 'color-danger';
                    warningText = 'High Overload!';
                } else if (activeT >= 2) {
                    badgeClass = 'color-warning';
                    warningText = 'Approaching Limit';
                }
                
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.padding = '12px';
                li.style.borderBottom = '1px solid var(--border-color)';
                li.style.fontSize = '0.9rem';
                li.innerHTML = `
                    <div>
                        <strong>${res.name}</strong> (${res.role})
                    </div>
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${activeT} Active Tasks</span>
                        <span style="font-size: 0.75rem; font-weight:600; color: var(--${badgeClass});">${warningText}</span>
                    </div>
                `;
                workloadList.appendChild(li);
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// 2. Project Management Logic
async function renderProjects() {
    try {
        state.projects = await apiCall('/projects');
        state.tasks = await apiCall('/tasks');
        state.resources = await apiCall('/resources');
        
        const list = document.getElementById('project-list-table');
        if (!list) return;
        list.innerHTML = '';

        state.projects.forEach(p => {
            const pTasks = state.tasks.filter(t => t.projectId === p.id);
            const compTasks = pTasks.filter(t => t.status === 'completed').length;
            const totalT = pTasks.length;
            const taskRatio = totalT > 0 ? `${compTasks}/${totalT} Tasks` : '0 Tasks';

            const percent = totalT > 0 ? Math.round((compTasks / totalT) * 100) : (p.status === 'completed' ? 100 : 0);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--text-main);">${p.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Goal: ${p.goal}</div>
                </td>
                <td><strong>${p.manager}</strong></td>
                <td><span class="badge badge-${p.status}">${p.status.replace('-', ' ')}</span></td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar-wrapper">
                            <div class="progress-bar-fill" style="width: ${percent}%"></div>
                        </div>
                        <span>${percent}%</span>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-align: right;">${taskRatio}</div>
                </td>
                <td><span style="font-size: 0.85rem;">${p.deadline}</span></td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="editProjectMilestones('${p.id}')">Milestones</button>
                        ${currentUser.role !== 'employee' ? `
                        <button class="btn btn-secondary btn-sm" onclick="openEditProjectModal('${p.id}')"><i class="lucide-edit-2"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}')"><i class="lucide-trash-2"></i></button>
                        ` : ''}
                    </div>
                </td>
            `;
            list.appendChild(tr);
        });

        // Populate Project Manager Dropdowns
        const mgrSelect = document.getElementById('proj-manager-select');
        if (mgrSelect) {
            mgrSelect.innerHTML = state.resources.filter(r => r.role === 'manager' || r.role === 'admin').map(m => `<option value="${m.name}">${m.name} (${m.role})</option>`).join('');
        }
        const mgrEditSelect = document.getElementById('edit-proj-manager-select');
        if (mgrEditSelect) {
            mgrEditSelect.innerHTML = state.resources.filter(r => r.role === 'manager' || r.role === 'admin').map(m => `<option value="${m.name}">${m.name} (${m.role})</option>`).join('');
        }

        // Render Gantt Timeline Chart
        renderGanttChart();
    } catch (e) {
        console.error(e);
    }
}

function renderGanttChart() {
    const sidebar = document.getElementById('gantt-sidebar-rows');
    const timeline = document.getElementById('gantt-timeline-rows');
    if (!sidebar || !timeline) return;

    sidebar.innerHTML = '';
    timeline.innerHTML = '';

    if (state.projects.length === 0) {
        sidebar.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);">No Projects</div>';
        return;
    }

    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const timelineHeader = document.getElementById('gantt-timeline-header');
    if (timelineHeader) {
        timelineHeader.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const mIndex = (today.getMonth() + i) % 12;
            const div = document.createElement('div');
            div.innerText = months[mIndex];
            timelineHeader.appendChild(div);
        }
    }

    state.projects.forEach(p => {
        const labelRow = document.createElement('div');
        labelRow.className = 'gantt-sidebar-row';
        labelRow.innerText = p.name;
        sidebar.appendChild(labelRow);

        const barRow = document.createElement('div');
        barRow.className = 'gantt-timeline-row';
        
        const dlDate = new Date(p.deadline);
        const startOffsetMonths = 0; 
        let durationMonths = ((dlDate.getFullYear() - today.getFullYear()) * 12) + (dlDate.getMonth() - today.getMonth()) + 1;
        if (durationMonths < 1) durationMonths = 1;
        if (durationMonths > 12) durationMonths = 12;

        const leftPct = (startOffsetMonths / 12) * 100;
        const widthPct = (durationMonths / 12) * 100;

        const bar = document.createElement('div');
        bar.className = 'gantt-bar';
        bar.style.left = `${leftPct}%`;
        bar.style.width = `${widthPct}%`;
        bar.innerText = `${p.deadline}`;
        bar.setAttribute('title', `${p.name} due ${p.deadline}`);
        bar.addEventListener('click', () => {
            editProjectMilestones(p.id);
        });

        barRow.appendChild(bar);
        timeline.appendChild(barRow);
    });
}

// Project Milestones Modal
let activeMilestoneProjectId = null;
window.editProjectMilestones = async function(projectId) {
    activeMilestoneProjectId = projectId;
    try {
        state.projects = await apiCall('/projects');
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return;

        document.getElementById('milestone-project-name').innerText = project.name;
        const container = document.getElementById('milestone-list-container');
        container.innerHTML = '';

        if (!project.milestones) project.milestones = [];

        if (project.milestones.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem;text-align:center;">No milestones defined for this project.</div>';
        } else {
            project.milestones.forEach(m => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.gap = '12px';
                div.style.padding = '8px 0';
                div.innerHTML = `
                    <input type="checkbox" id="chk-${m.id}" ${m.completed ? 'checked' : ''} onchange="toggleMilestone('${projectId}', '${m.id}', this.checked)">
                    <label for="chk-${m.id}" style="font-size: 0.95rem; ${m.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${m.text}</label>
                    ${currentUser.role !== 'employee' ? `
                    <button class="btn-secondary" style="border:none;background:none;color:var(--color-danger);cursor:pointer;margin-left:auto;" onclick="deleteMilestone('${projectId}', '${m.id}')"><i class="lucide-trash-2" style="width:14px;height:14px;"></i></button>
                    ` : ''}
                `;
                container.appendChild(div);
            });
        }

        const addForm = document.getElementById('add-milestone-form');
        if (addForm) {
            addForm.style.display = currentUser.role === 'employee' ? 'none' : 'flex';
        }

        openModal('milestones-modal');
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
};

window.toggleMilestone = async function(projectId, milestoneId, isChecked) {
    try {
        await apiCall(`/projects/${projectId}/milestones/${milestoneId}`, 'PUT', { completed: isChecked });
        const project = state.projects.find(p => p.id === projectId);
        addNotification(`Milestone updated in project "${project ? project.name : ''}".`);
        await editProjectMilestones(projectId); 
        await renderProjects(); 
    } catch (e) {
        console.error(e);
    }
};

window.addMilestone = async function(e) {
    e.preventDefault();
    if (!activeMilestoneProjectId) return;
    const textInput = document.getElementById('new-milestone-text');
    const text = textInput.value.trim();
    if (!text) return;

    try {
        const msData = {
            id: 'ms-' + Date.now(),
            text: text,
            completed: false
        };
        await apiCall(`/projects/${activeMilestoneProjectId}/milestones`, 'POST', msData);
        textInput.value = '';
        addNotification(`New milestone "${text}" added.`);
        await editProjectMilestones(activeMilestoneProjectId);
        await renderProjects();
    } catch (e) {
        console.error(e);
    }
};

window.deleteMilestone = async function(projectId, milestoneId) {
    try {
        await apiCall(`/projects/${projectId}/milestones/${milestoneId}`, 'DELETE');
        await editProjectMilestones(projectId);
        await renderProjects();
    } catch (e) {
        console.error(e);
    }
};

// CRUD Projects Actions
window.saveNewProject = async function(e) {
    e.preventDefault();
    if (currentUser.role === 'employee') {
        showToast('Access Denied. Admins and Managers only.', 'danger');
        return;
    }
    const name = document.getElementById('proj-name-input').value.trim();
    const goal = document.getElementById('proj-goal-input').value.trim();
    const manager = document.getElementById('proj-manager-select').value;
    const deadline = document.getElementById('proj-deadline-input').value;
    const status = document.getElementById('proj-status-select').value;

    if (!name || !deadline) return;

    const newProj = {
        id: 'proj-' + Date.now(),
        name,
        goal,
        manager,
        deadline,
        status
    };

    try {
        await apiCall('/projects', 'POST', newProj);
        closeModal('project-modal');
        e.target.reset();
        await addNotification(`Project "${name}" created.`);
        await renderProjects();
    } catch (err) {
        console.error(err);
    }
};

let activeEditProjectId = null;
window.openEditProjectModal = async function(id) {
    const proj = state.projects.find(p => p.id === id);
    if (!proj) return;
    activeEditProjectId = id;

    document.getElementById('edit-proj-name-input').value = proj.name;
    document.getElementById('edit-proj-goal-input').value = proj.goal;
    document.getElementById('edit-proj-manager-select').value = proj.manager;
    document.getElementById('edit-proj-deadline-input').value = proj.deadline;
    document.getElementById('edit-proj-status-select').value = proj.status;

    openModal('edit-project-modal');
};

window.updateProject = async function(e) {
    e.preventDefault();
    if (!activeEditProjectId) return;

    const editProj = {
        name: document.getElementById('edit-proj-name-input').value.trim(),
        goal: document.getElementById('edit-proj-goal-input').value.trim(),
        manager: document.getElementById('edit-proj-manager-select').value,
        deadline: document.getElementById('edit-proj-deadline-input').value,
        status: document.getElementById('edit-proj-status-select').value
    };

    try {
        await apiCall(`/projects/${activeEditProjectId}`, 'PUT', editProj);
        closeModal('edit-project-modal');
        addNotification(`Project configuration updated.`);
        await renderProjects();
    } catch (err) {
        console.error(err);
    }
};

window.deleteProject = async function(id) {
    if (!confirm('Are you sure you want to delete this project? This will delete all associated tasks, chats, and documentation.')) return;
    try {
        await apiCall(`/projects/${id}`, 'DELETE');
        addNotification(`Project removed from system.`);
        await renderProjects();
    } catch (e) {
        console.error(e);
    }
};

// 3. Tasks Management Logic (Kanban Board)
async function renderTasks() {
    try {
        state.projects = await apiCall('/projects');
        state.tasks = await apiCall('/tasks');
        state.resources = await apiCall('/resources');

        // Populate projects dropdowns
        const projSelect = document.getElementById('task-project-select');
        if (projSelect) {
            projSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
        const filterProjSelect = document.getElementById('task-filter-project');
        if (filterProjSelect) {
            const currentFilter = filterProjSelect.value;
            filterProjSelect.innerHTML = '<option value="all">All Projects</option>' + 
                state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            if (currentFilter) filterProjSelect.value = currentFilter;
        }

        // Populate user assignees
        const assignSelect = document.getElementById('task-assignee-select');
        if (assignSelect) {
            assignSelect.innerHTML = state.resources.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
        }

        // Setup columns
        const columns = {
            todo: document.getElementById('kanban-todo-wrapper'),
            'in-progress': document.getElementById('kanban-inprogress-wrapper'),
            completed: document.getElementById('kanban-completed-wrapper')
        };

        Object.values(columns).forEach(col => {
            if (col) col.innerHTML = '';
        });

        const activeProjectFilter = document.getElementById('task-filter-project')?.value || 'all';
        const activePriorityFilter = document.getElementById('task-filter-priority')?.value || 'all';

        let filteredTasks = state.tasks;
        if (activeProjectFilter !== 'all') {
            filteredTasks = filteredTasks.filter(t => t.projectId === activeProjectFilter);
        }
        if (activePriorityFilter !== 'all') {
            filteredTasks = filteredTasks.filter(t => t.priority === activePriorityFilter);
        }

        document.getElementById('count-todo').innerText = filteredTasks.filter(t => t.status === 'todo').length;
        document.getElementById('count-inprogress').innerText = filteredTasks.filter(t => t.status === 'in-progress').length;
        document.getElementById('count-completed').innerText = filteredTasks.filter(t => t.status === 'completed').length;

        filteredTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-id', task.id);
            
            const pObj = state.projects.find(p => p.id === task.projectId);
            const pName = pObj ? pObj.name : 'Unknown Project';

            card.innerHTML = `
                <div style="font-size:0.7rem; color:var(--accent-teal); font-weight:600; text-transform:uppercase; margin-bottom: 6px;">${pName}</div>
                <div class="kanban-card-title">${task.title}</div>
                <span class="badge badge-${task.priority}">${task.priority} Priority</span>
                <div class="kanban-card-meta">
                    <div class="kanban-card-date">
                        <i class="lucide-calendar" style="width:12px;height:12px;"></i>
                        ${task.deadline}
                    </div>
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <div class="kanban-card-assignee">${task.assignee.charAt(0).toUpperCase()}</div>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:12px; border-top:1px solid var(--border-color); padding-top:8px;">
                    <button class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:0.7rem;" onclick="viewTaskComments('${task.id}', event)">Comments</button>
                    <select class="form-control" style="padding:2px; font-size:0.7rem; width:100px; height:24px;" onchange="moveTaskStatus('${task.id}', this.value, event)">
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                        <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                    ${currentUser.role !== 'employee' ? `
                    <button class="btn-secondary" style="border:none;background:none;color:var(--color-danger);cursor:pointer;" onclick="deleteTask('${task.id}', event)"><i class="lucide-trash-2" style="width:12px;height:12px;"></i></button>
                    ` : ''}
                </div>
            `;

            card.addEventListener('dragstart', handleDragStart, false);
            card.addEventListener('dragend', handleDragEnd, false);
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'I') {
                    viewTaskComments(task.id, e);
                }
            });

            if (columns[task.status]) {
                columns[task.status].appendChild(card);
            }
        });

        setupDragAndDrop();
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
}

window.moveTaskStatus = async function(taskId, newStatus, e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    try {
        await apiCall(`/tasks/${taskId}`, 'PUT', { status: newStatus });
        const task = state.tasks.find(t => t.id === taskId);
        addNotification(`Task "${task ? task.title : ''}" status changed to ${newStatus}.`);
        await renderTasks();
    } catch (err) {
        console.error(err);
    }
};

window.saveNewTask = async function(e) {
    e.preventDefault();
    const projectId = document.getElementById('task-project-select').value;
    const title = document.getElementById('task-title-input').value.trim();
    const assignee = document.getElementById('task-assignee-select').value;
    const deadline = document.getElementById('task-deadline-input').value;
    const priority = document.getElementById('task-priority-select').value;
    const description = document.getElementById('task-desc-input').value.trim();

    if (!title || !deadline) return;

    const newTask = {
        id: 'task-' + Date.now(),
        projectId,
        title,
        description,
        assignee,
        deadline,
        priority,
        status: 'todo'
    };

    try {
        await apiCall('/tasks', 'POST', newTask);
        closeModal('task-modal');
        e.target.reset();
        addNotification(`Task allocated and assigned to ${assignee}.`);
        await renderTasks();
    } catch (err) {
        console.error(err);
    }
};

window.deleteTask = async function(id, e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        await apiCall(`/tasks/${id}`, 'DELETE');
        addNotification(`Task removed from backlog.`);
        await renderTasks();
    } catch (err) {
        console.error(err);
    }
};

// Task comments logic
let activeTaskCommentsId = null;
window.viewTaskComments = async function(taskId, e) {
    if (e) e.stopPropagation();
    activeTaskCommentsId = taskId;
    try {
        state.tasks = await apiCall('/tasks');
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        document.getElementById('comments-task-title').innerText = task.title;
        document.getElementById('comments-task-desc').innerText = task.description || 'No description provided.';
        
        const commentsList = document.getElementById('comments-list');
        commentsList.innerHTML = '';

        if (!task.comments) task.comments = [];

        if (task.comments.length === 0) {
            commentsList.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:12px;">No comments yet. Start the conversation!</div>`;
        } else {
            task.comments.forEach(c => {
                const dateStr = new Date(c.time).toLocaleString();
                const div = document.createElement('div');
                div.style.borderBottom = '1px solid var(--border-color)';
                div.style.padding = '10px 0';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                        <strong>${c.sender}</strong>
                        <span style="color:var(--text-muted);">${dateStr}</span>
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-main);">${c.text}</div>
                `;
                commentsList.appendChild(div);
            });
        }

        openModal('comments-modal');
    } catch (err) {
        console.error(err);
    }
};

window.saveNewComment = async function(e) {
    e.preventDefault();
    if (!activeTaskCommentsId) return;

    const input = document.getElementById('new-comment-text');
    const text = input.value.trim();
    if (!text) return;

    try {
        const commentData = {
            sender: currentUser.name,
            text: text,
            time: new Date().toISOString()
        };
        await apiCall(`/tasks/${activeTaskCommentsId}/comments`, 'POST', commentData);
        input.value = '';
        await viewTaskComments(activeTaskCommentsId);
    } catch (err) {
        console.error(err);
    }
};

// Drag and drop mechanics
let dragSrcEl = null;
function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
}

function handleDragEnd(e) {
    this.style.opacity = '1.0';
    document.querySelectorAll('.kanban-cards-wrapper').forEach(w => {
        w.classList.remove('dragover');
    });
}

function setupDragAndDrop() {
    const wrappers = document.querySelectorAll('.kanban-cards-wrapper');
    wrappers.forEach(w => {
        w.addEventListener('dragover', (e) => {
            e.preventDefault();
            w.classList.add('dragover');
        });

        w.addEventListener('dragleave', () => {
            w.classList.remove('dragover');
        });

        w.addEventListener('drop', async (e) => {
            e.preventDefault();
            w.classList.remove('dragover');
            const id = e.dataTransfer.getData('text/plain');
            const targetStatus = w.getAttribute('data-status');
            
            if (id && targetStatus) {
                try {
                    await apiCall(`/tasks/${id}`, 'PUT', { status: targetStatus });
                    addNotification(`Task transitioned status successfully.`);
                    await renderTasks();
                } catch (err) {
                    console.error(err);
                }
            }
        });
    });
}

// 4. Team Collaboration Logic
let activeChatRoomProjectId = null;
async function renderCollaboration() {
    try {
        state.projects = await apiCall('/projects');
        
        const roomList = document.getElementById('collab-chat-rooms');
        if (!roomList) return;
        roomList.innerHTML = '';

        if (state.projects.length === 0) {
            roomList.innerHTML = '<div style="font-size:0.8rem;padding:12px;color:var(--text-muted);">No active project rooms</div>';
            return;
        }

        state.projects.forEach(p => {
            const item = document.createElement('div');
            item.className = 'collab-room-item';
            if (p.id === activeChatRoomProjectId) item.className += ' active';
            item.innerHTML = `<i class="lucide-hash"></i> <span>${p.name}</span>`;
            item.addEventListener('click', () => {
                activeChatRoomProjectId = p.id;
                renderCollaboration();
            });
            roomList.appendChild(item);
        });

        if (!activeChatRoomProjectId && state.projects.length > 0) {
            activeChatRoomProjectId = state.projects[0].id;
            renderCollaboration();
            return;
        }

        // Render Chat Messages
        const chatTitle = document.getElementById('collab-chat-title');
        const msgContainer = document.getElementById('collab-chat-messages');
        
        if (activeChatRoomProjectId) {
            const activeProj = state.projects.find(p => p.id === activeChatRoomProjectId);
            if (chatTitle) chatTitle.innerText = `# ${activeProj ? activeProj.name : 'Collaboration Room'}`;

            if (msgContainer) {
                msgContainer.innerHTML = '';
                state.chat = await apiCall(`/chat/${activeChatRoomProjectId}`);
                
                if (state.chat.length === 0) {
                    msgContainer.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.85rem;margin-top:40px;">No messages in this project room yet. Write something below!</div>`;
                } else {
                    state.chat.forEach(msg => {
                        const isOwn = msg.sender === currentUser.name;
                        const bubble = document.createElement('div');
                        bubble.className = `chat-message-bubble ${isOwn ? 'own' : ''}`;
                        const timeStr = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        bubble.innerHTML = `
                            <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">${msg.sender.charAt(0).toUpperCase()}</div>
                            <div>
                                <div class="chat-bubble-content">${msg.text}</div>
                                <div class="chat-bubble-meta">
                                    <span>${msg.sender}</span>
                                    <span>${timeStr}</span>
                                </div>
                            </div>
                        `;
                        msgContainer.appendChild(bubble);
                    });
                    msgContainer.scrollTop = msgContainer.scrollHeight;
                }
            }
        }

        // Document Storage list
        await renderDocuments();
    } catch (e) {
        console.error(e);
    }
}

window.sendChatMessage = async function(e) {
    e.preventDefault();
    if (!activeChatRoomProjectId) return;

    const input = document.getElementById('collab-chat-input');
    const text = input.value.trim();
    if (!text) return;

    const newMsg = {
        id: 'msg-' + Date.now(),
        projectId: activeChatRoomProjectId,
        sender: currentUser.name,
        text: text,
        time: new Date().toISOString()
    };

    try {
        await apiCall('/chat', 'POST', newMsg);
        input.value = '';
        await renderCollaboration();

        // Simulated reply
        setTimeout(async () => {
            const responses = [
                "Good point! Let's sync on this in tomorrow's standup.",
                "Reviewing the requirements file now.",
                "Awesome! Thanks for the update.",
                "Can you verify this with our project lead?",
                "I will upload the draft schema file to our document tab."
            ];
            const randomAnswer = responses[Math.floor(Math.random() * responses.length)];
            const members = state.resources.filter(r => r.name !== currentUser.name);
            const simulatedSender = members.length > 0 ? members[Math.floor(Math.random() * members.length)].name : 'Kavya';

            const reply = {
                id: 'msg-' + (Date.now() + 1),
                projectId: activeChatRoomProjectId,
                sender: simulatedSender,
                text: randomAnswer,
                time: new Date().toISOString()
            };
            await apiCall('/chat', 'POST', reply);
            await renderCollaboration();
            showToast(`New message from ${simulatedSender}`);
        }, 3000);
    } catch (err) {
        console.error(err);
    }
};

async function renderDocuments() {
    const list = document.getElementById('collab-doc-list');
    if (!list) return;
    list.innerHTML = '';

    try {
        // Populate Projects dropdown in document modal
        const projSelect = document.getElementById('doc-project-select');
        if (projSelect) {
            projSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }

        state.documents = await apiCall('/documents');
        let docs = state.documents;
        if (activeChatRoomProjectId) {
            docs = docs.filter(d => d.projectId === activeChatRoomProjectId);
        }

        if (docs.length === 0) {
            list.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem;grid-column:1/-1;text-align:center;padding:24px;">No files shared in this project yet.</div>';
            return;
        }

        docs.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.innerHTML = `
                <div class="doc-card-info">
                    <i class="lucide-file-text doc-icon"></i>
                    <div style="overflow:hidden;">
                        <div class="doc-name" title="${doc.name}">${doc.name}</div>
                        <div class="doc-size">${doc.size}</div>
                    </div>
                </div>
                <div class="doc-actions">
                    <span class="doc-uploader">By: ${doc.uploader}</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="simulateDownload('${doc.name}')"><i class="lucide-download" style="width:12px;height:12px;"></i></button>
                        ${currentUser.role !== 'employee' || doc.uploader === currentUser.name ? `
                        <button class="btn btn-danger btn-sm" style="padding:4px 8px;" onclick="deleteDocument('${doc.id}')"><i class="lucide-trash-2" style="width:12px;height:12px;"></i></button>
                        ` : ''}
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (e) {
        console.error(e);
    }
}

window.simulateDownload = function(name) {
    showToast(`Downloading: ${name}... Download Complete.`);
};

window.saveNewDocument = async function(e) {
    e.preventDefault();
    const projectId = document.getElementById('doc-project-select').value;
    const fileInput = document.getElementById('doc-file-input');
    
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    const newDoc = {
        id: 'doc-' + Date.now(),
        projectId,
        name: file.name,
        size: sizeMB,
        uploader: currentUser.name
    };

    try {
        await apiCall('/documents', 'POST', newDoc);
        closeModal('document-modal');
        e.target.reset();
        addNotification(`Document "${file.name}" uploaded successfully.`);
        await renderCollaboration();
    } catch (err) {
        console.error(err);
    }
};

window.deleteDocument = async function(id) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
        await apiCall(`/documents/${id}`, 'DELETE');
        addNotification(`Document removed.`);
        await renderCollaboration();
    } catch (err) {
        console.error(err);
    }
};

// 5. Resource Management Logic
async function renderResources() {
    try {
        state.resources = await apiCall('/resources');
        state.tasks = await apiCall('/tasks');

        const list = document.getElementById('resource-list-table');
        if (!list) return;
        list.innerHTML = '';

        state.resources.forEach(res => {
            const activeT = state.tasks.filter(t => t.assignee === res.name && t.status !== 'completed').length;
            const totalT = state.tasks.filter(t => t.assignee === res.name).length;
            
            let workloadPercent = (activeT / 5) * 100; 
            if (workloadPercent > 100) workloadPercent = 100;

            let levelClass = 'fill';
            if (activeT >= 4) {
                levelClass = 'fill-red';
            } else if (activeT >= 2) {
                levelClass = 'fill-amber';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="user-avatar" style="width:32px;height:32px;font-size:0.75rem;">${res.name.charAt(0)}</div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-main);">${res.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${res.role}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="progress-container">
                        <div class="progress-bar-wrapper">
                            <div class="progress-bar-fill ${levelClass}" style="width: ${workloadPercent}%; background-color: ${activeT >= 4 ? 'var(--color-danger)' : (activeT >= 2 ? 'var(--color-warning)' : 'var(--color-success)')}"></div>
                        </div>
                        <span>${activeT} Tasks Active</span>
                    </div>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">(Total assignments: ${totalT})</div>
                </td>
                <td>
                    <select class="form-control" style="padding:6px; font-size:0.85rem; width:150px;" onchange="changeResourceAvailability('${res.name}', this.value)" ${currentUser.role === 'employee' && currentUser.name !== res.name ? 'disabled' : ''}>
                        <option value="available" ${res.availability === 'available' ? 'selected' : ''}>🟢 Available</option>
                        <option value="busy" ${res.availability === 'busy' ? 'selected' : ''}>🟡 Busy</option>
                        <option value="out-of-office" ${res.availability === 'out-of-office' ? 'selected' : ''}>🔴 Out of Office</option>
                    </select>
                </td>
                <td>
                    ${currentUser.role !== 'employee' ? `
                    <button class="btn btn-secondary btn-sm" onclick="openAllocateModal('${res.name}')">Allocate Work</button>
                    ` : '<span style="font-size:0.8rem;color:var(--text-muted);">View Only</span>'}
                </td>
            `;
            list.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

window.changeResourceAvailability = async function(name, newAvail) {
    try {
        await apiCall('/resources/availability', 'PUT', { name, availability: newAvail });
        addNotification(`Resource availability state updated.`);
        await renderResources();
    } catch (err) {
        console.error(err);
    }
};

let activeAllocateResourceName = null;
window.openAllocateModal = async function(name) {
    activeAllocateResourceName = name;
    document.getElementById('alloc-resource-name').innerText = name;
    
    try {
        state.projects = await apiCall('/projects');
        const projSelect = document.getElementById('alloc-project-select');
        if (projSelect) {
            projSelect.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
        openModal('allocate-modal');
    } catch (e) {
        console.error(e);
    }
};

window.saveAllocation = async function(e) {
    e.preventDefault();
    if (!activeAllocateResourceName) return;

    const projectId = document.getElementById('alloc-project-select').value;
    const taskTitle = document.getElementById('alloc-task-title').value.trim();
    const taskDeadline = document.getElementById('alloc-task-deadline').value;
    const taskPriority = document.getElementById('alloc-task-priority').value;

    if (!taskTitle || !taskDeadline) return;

    const newTask = {
        id: 'task-' + Date.now(),
        projectId: projectId,
        title: taskTitle,
        description: 'Assigned via resource management dashboard.',
        assignee: activeAllocateResourceName,
        deadline: taskDeadline,
        priority: taskPriority,
        status: 'todo'
    };

    try {
        await apiCall('/tasks', 'POST', newTask);
        closeModal('allocate-modal');
        e.target.reset();
        addNotification(`Task allocated successfully.`);
        await renderResources();
    } catch (err) {
        console.error(err);
    }
};

// 6. Reports & Analytics
let chartsInstances = {};
async function renderReports() {
    Object.values(chartsInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartsInstances = {};

    const projectsCtx = document.getElementById('chart-projects-progress')?.getContext('2d');
    const workloadCtx = document.getElementById('chart-resources-workload')?.getContext('2d');
    const taskStatusCtx = document.getElementById('chart-tasks-distribution')?.getContext('2d');

    if (!projectsCtx || !workloadCtx || !taskStatusCtx) return;

    try {
        state.projects = await apiCall('/projects');
        state.tasks = await apiCall('/tasks');
        state.resources = await apiCall('/resources');

        // Data 1: Projects Progress
        const projLabels = state.projects.map(p => p.name);
        const projProgressData = state.projects.map(p => {
            const pTasks = state.tasks.filter(t => t.projectId === p.id);
            if (pTasks.length === 0) return p.status === 'completed' ? 100 : 0;
            return Math.round((pTasks.filter(t => t.status === 'completed').length / pTasks.length) * 100);
        });

        chartsInstances.projChart = new Chart(projectsCtx, {
            type: 'bar',
            data: {
                labels: projLabels,
                datasets: [{
                    label: 'Completion Progress (%)',
                    data: projProgressData,
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: '#222c40' }, ticks: { color: '#9ca3af' } },
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Data 2: Resource Workload
        const resLabels = state.resources.map(r => r.name);
        const resWorkloadData = state.resources.map(r => {
            return state.tasks.filter(t => t.assignee === r.name && t.status !== 'completed').length;
        });

        chartsInstances.workloadChart = new Chart(workloadCtx, {
            type: 'bar',
            data: {
                labels: resLabels,
                datasets: [{
                    label: 'Active Tasks Count',
                    data: resWorkloadData,
                    backgroundColor: 'rgba(20, 184, 166, 0.6)',
                    borderColor: 'rgba(20, 184, 166, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { beginAtZero: true, stepSize: 1, grid: { color: '#222c40' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Data 3: Task Distribution
        const todoCount = state.tasks.filter(t => t.status === 'todo').length;
        const progressCount = state.tasks.filter(t => t.status === 'in-progress').length;
        const compCount = state.tasks.filter(t => t.status === 'completed').length;

        chartsInstances.statusChart = new Chart(taskStatusCtx, {
            type: 'doughnut',
            data: {
                labels: ['To Do', 'In Progress', 'Completed'],
                datasets: [{
                    data: [todoCount, progressCount, compCount],
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.7)',
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(16, 185, 129, 0.7)'
                    ],
                    borderColor: '#151c2c',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } }
                    }
                }
            }
        });

        document.getElementById('report-total-tasks').innerText = state.tasks.length;
        const completedTasks = state.tasks.filter(t => t.status === 'completed').length;
        const compRate = state.tasks.length > 0 ? Math.round((completedTasks / state.tasks.length) * 100) : 0;
        document.getElementById('report-completion-rate').innerText = `${compRate}%`;

    } catch (e) {
        console.error(e);
    }
}

// 7. Security & Backup Profile settings
async function renderSecurity() {
    try {
        const backup = await apiCall('/backup');
        state.users = backup.users || [];

        const adminPanel = document.getElementById('security-admin-panel');
        if (adminPanel) {
            adminPanel.style.display = currentUser.role === 'admin' ? 'block' : 'none';
        }

        const userTable = document.getElementById('security-users-list');
        if (userTable) {
            userTable.innerHTML = '';
            state.users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${u.name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-todo" style="text-transform:uppercase;">${u.role}</span></td>
                    <td>
                        ${u.email !== currentUser.email && u.email !== 'admin@enterprise.com' ? `
                        <select class="form-control" style="padding:4px; font-size:0.75rem; width:120px;" onchange="changeUserRole('${u.email}', this.value)">
                            <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>Employee</option>
                            <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        ` : '<span style="font-size:0.8rem;color:var(--text-muted);">Protected</span>'}
                    </td>
                `;
                userTable.appendChild(tr);
            });
        }

        const profileEmail = document.getElementById('profile-email-text');
        if (profileEmail) profileEmail.innerText = currentUser.email;
        const profileName = document.getElementById('profile-name-input');
        if (profileName) profileName.value = currentUser.name;
    } catch (e) {
        console.error(e);
    }
}

window.changeUserRole = async function(email, newRole) {
    if (currentUser.role !== 'admin') {
        showToast('Only admins can change roles.', 'danger');
        return;
    }
    // Note: To change a user role, we update profile information
    const user = state.users.find(u => u.email === email);
    if (user) {
        try {
            // Re-use update profile route or implement custom endpoint, but updating it in user state and pushing it is cleanest
            user.role = newRole;
            // Since we can import bulk config changes to modify user schemas on the backend, let's post the backup update back!
            const backupPayload = await apiCall('/backup');
            backupPayload.users = backupPayload.users.map(u => {
                if (u.email === email) u.role = newRole;
                return u;
            });
            // Update resource role as well
            backupPayload.resources = backupPayload.resources.map(r => {
                if (r.name === user.name) r.role = newRole;
                return r;
            });
            await apiCall('/backup', 'POST', backupPayload);
            addNotification(`Role updated for user "${user.name}".`);
            await renderSecurity();
        } catch (err) {
            console.error(err);
        }
    }
};

window.saveProfileSettings = async function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('profile-name-input').value.trim();
    const passwordInput = document.getElementById('profile-password-input').value.trim();

    if (!nameInput) return;

    try {
        const updatePayload = {
            email: currentUser.email,
            name: nameInput,
            password: passwordInput || null
        };
        const result = await apiCall('/profile/update', 'POST', updatePayload);
        if (result.success) {
            currentUser = result.user;
            sessionStorage.setItem('epms_session', JSON.stringify(currentUser));
            addNotification(`Profile settings updated successfully.`);
            await renderPageData('security');
        }
    } catch (err) {
        console.error(err);
    }
};

// Database backup & recovery endpoints trigger
window.exportDataBackup = async function() {
    try {
        const data = await apiCall('/backup');
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 4));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `epms_sql_backup_${new Date().toISOString().split('T')[0]}.json`);
        dlAnchorElem.click();
        showToast('Database configuration backup downloaded.');
    } catch (e) {
        console.error(e);
    }
};

window.importDataBackup = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const parsed = JSON.parse(evt.target.result);
            if (parsed.users && parsed.projects && parsed.tasks) {
                const result = await apiCall('/backup', 'POST', parsed);
                if (result.success) {
                    showToast('Database restored successfully. Syncing UI...', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            } else {
                showToast('Invalid backup schema.', 'danger');
            }
        } catch (err) {
            showToast('Error uploading database backup file.', 'danger');
        }
    };
    reader.readAsText(file);
};

window.resetSystemData = async function() {
    if (!confirm('Warning: This will clear SQLite configurations and restore defaults. Proceed?')) return;
    
    // We restore database by posting original initialData mock back
    const initialData = {
        users: [
            { email: 'admin@enterprise.com', password: 'YWRtaW4xMjM=', name: 'Venkat', role: 'admin', avatar: 'V' },
            { email: 'manager@enterprise.com', password: 'bWFuYWdlcjEyMw==', name: 'Kavya', role: 'manager', avatar: 'K' },
            { email: 'employee@enterprise.com', password: 'ZW1wbG95ZWUxMjM=', name: 'Rahul', role: 'employee', avatar: 'R' },
            { email: 'dev@enterprise.com', password: 'ZGV2MTIz', name: 'Priya', role: 'employee', avatar: 'P' }
        ],
        projects: [
            { id: 'proj-1', name: 'ERP System Upgrade', goal: 'Migrate database servers and modernize the browser user interface.', deadline: '2026-07-30', manager: 'Kavya', status: 'in-progress' },
            { id: 'proj-2', name: 'CRM Integration', goal: 'Unify sales pipelines, analytics widgets, and customer helpdesk.', deadline: '2026-08-15', manager: 'Venkat', status: 'todo' },
            { id: 'proj-3', name: 'AI Support Chatbot', goal: 'Fine-tune large language models and integrate with mobile client.', deadline: '2026-06-29', manager: 'Kavya', status: 'completed' }
        ],
        milestones: [
            { id: 'm1', project_id: 'proj-1', text: 'Establish cloud servers', completed: 1 },
            { id: 'm2', project_id: 'proj-1', text: 'Database staging migration', completed: 0 },
            { id: 'm3', project_id: 'proj-1', text: 'Beta client dashboard deploy', completed: 0 },
            { id: 'm4', project_id: 'proj-2', text: 'API integration endpoints ready', completed: 0 },
            { id: 'm5', project_id: 'proj-2', text: 'Feedback metrics widget integration', completed: 0 },
            { id: 'm6', project_id: 'proj-3', text: 'Dataset cleaning & ingestion', completed: 1 },
            { id: 'm7', project_id: 'proj-3', text: 'Incorporate intent detection engines', completed: 1 }
        ],
        tasks: [
            { id: 'task-1', project_id: 'proj-1', title: 'Staging DB Migration', description: 'Migrate users and transactions tables to the cloud environment.', priority: 'high', deadline: '2026-07-10', assignee: 'Priya', status: 'in-progress' },
            { id: 'task-2', project_id: 'proj-1', title: 'Dashboard Widget Frontend', description: 'Create responsive stats display using mock endpoints.', priority: 'medium', deadline: '2026-07-25', assignee: 'Rahul', status: 'todo' },
            { id: 'task-3', project_id: 'proj-2', title: 'Support Widget Layout', description: 'Build mock ticketing interface.', priority: 'low', deadline: '2026-08-10', assignee: 'Rahul', status: 'todo' },
            { id: 'task-4', project_id: 'proj-3', title: 'NLP Models API Setup', description: 'Provide inference response server hooks.', priority: 'high', deadline: '2026-06-24', assignee: 'Priya', status: 'completed' }
        ],
        comments: [
            { id: 'comment-1', task_id: 'task-1', sender: 'Kavya', text: 'Make sure backups are taken before mig.', time: '2026-06-23T11:00:00' }
        ],
        chat_messages: [
            { id: 'msg-1', project_id: 'proj-1', sender: 'Kavya', text: 'Welcome team! Use this channel to post updates.', time: '2026-06-23T10:00:00' },
            { id: 'msg-2', project_id: 'proj-1', sender: 'Priya', text: 'Drafting data models. Will share files soon.', time: '2026-06-23T10:20:00' },
            { id: 'msg-3', project_id: 'proj-3', sender: 'Kavya', text: 'Great job launching this on schedule!', time: '2026-06-23T11:00:00' }
        ],
        documents: [
            { id: 'doc-1', project_id: 'proj-1', name: 'ERP_Data_Models.pdf', size: '2.4 MB', uploader: 'Priya' },
            { id: 'doc-2', project_id: 'proj-3', name: 'AI_Architecture_Draft.png', size: '5.1 MB', uploader: 'Kavya' }
        ],
        notifications: [
            { id: 'noti-1', text: 'Welcome to your Enterprise Collaboration hub!', time: '2026-06-23T09:00:00', read: 0 }
        ],
        resources: [
            { name: 'Venkat', role: 'admin', availability: 'available' },
            { name: 'Kavya', role: 'manager', availability: 'busy' },
            { name: 'Rahul', role: 'employee', availability: 'available' },
            { name: 'Priya', role: 'employee', availability: 'available' }
        ]
    };

    try {
        await apiCall('/backup', 'POST', initialData);
        showToast('Database reset complete. Reloading UI...');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (err) {
        console.error(err);
    }
};

// Modal helpers
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};

// App Initialization Entrypoint
document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const authWrapper = document.getElementById('auth-view');
    const appWrapper = document.getElementById('app-view');

    if (getCurrentUser()) {
        if (authWrapper) authWrapper.style.display = 'none';
        if (appWrapper) appWrapper.style.display = 'grid';
        
        initRouter();
        updateNotificationsUI();
        switchPage('dashboard');
        
        // Setup bell alerts dropdown toggle
        const bell = document.getElementById('noti-bell-btn');
        const drop = document.getElementById('noti-drop');
        if (bell && drop) {
            bell.addEventListener('click', (e) => {
                e.stopPropagation();
                drop.classList.toggle('active');
            });
            document.addEventListener('click', () => {
                drop.classList.remove('active');
            });
        }
    } else {
        if (authWrapper) authWrapper.style.display = 'flex';
        if (appWrapper) appWrapper.style.display = 'none';
        initAuthForm();
    }
});

// Auth form switcher & submissions
function initAuthForm() {
    const btnLogin = document.getElementById('tab-btn-login');
    const btnRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');

    if (btnLogin && btnRegister && formLogin && formRegister) {
        btnLogin.addEventListener('click', () => {
            btnLogin.classList.add('active');
            btnRegister.classList.remove('active');
            formLogin.style.display = 'flex';
            formRegister.style.display = 'none';
        });

        btnRegister.addEventListener('click', () => {
            btnRegister.classList.add('active');
            btnLogin.classList.remove('active');
            formRegister.style.display = 'flex';
            formLogin.style.display = 'none';
        });

        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const pass = document.getElementById('login-password').value;

            const loggedIn = await loginUser(email, pass);
            if (loggedIn) {
                window.location.reload();
            } else {
                showToast('Invalid credentials. Hint: admin@enterprise.com / admin123', 'danger');
            }
        });

        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const pass = document.getElementById('reg-password').value;
            const role = document.getElementById('reg-role').value;

            const res = await registerUser(name, email, pass, role);
            if (res.success) {
                showToast('Registration successful! Please log in.');
                btnLogin.click();
            } else {
                showToast(res.msg || 'Registration failed.', 'danger');
            }
        });
    }
}

// --- 8. CI/CD Pipeline Dashboard Logic ---

let activeSimulation = null; // Holds runtime active simulation data if any

async function renderPipeline() {
    try {
        state.pipelines = await apiCall('/pipelines');
        
        // 1. Calculate Stats
        const totalBuilds = state.pipelines.length;
        const successRuns = state.pipelines.filter(p => p.status === 'success');
        const successRate = totalBuilds > 0 ? Math.round((successRuns.length / totalBuilds) * 100) : 0;
        
        const completedRuns = state.pipelines.filter(p => p.status !== 'running');
        const avgDuration = completedRuns.length > 0 
            ? Math.round(completedRuns.reduce((sum, p) => sum + p.duration, 0) / completedRuns.length) 
            : 0;
            
        const lastStatus = totalBuilds > 0 ? state.pipelines[0].status : '-';
        
        // 2. Render Stats in UI
        document.getElementById('pipeline-total-builds').innerText = totalBuilds;
        document.getElementById('pipeline-success-rate').innerText = `${successRate}%`;
        document.getElementById('pipeline-avg-duration').innerText = `${avgDuration}s`;
        
        const statusEl = document.getElementById('pipeline-last-status');
        statusEl.innerText = lastStatus.toUpperCase();
        statusEl.className = ''; // reset classes
        if (lastStatus === 'success') statusEl.style.color = 'var(--color-success)';
        else if (lastStatus === 'failure') statusEl.style.color = 'var(--color-danger)';
        else if (lastStatus === 'running') statusEl.style.color = 'var(--accent-indigo)';
        else statusEl.style.color = 'var(--text-main)';

        // 3. Render Runs List Table
        const listContainer = document.getElementById('pipeline-runs-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            
            if (state.pipelines.length === 0) {
                listContainer.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No build runs recorded yet.</td></tr>';
                return;
            }
            
            state.pipelines.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'cursor-pointer';
                tr.setAttribute('data-run-id', p.id);
                
                const timeStr = new Date(p.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                const durStr = p.status === 'running' ? 'Running...' : `${p.duration}s`;
                
                tr.innerHTML = `
                    <td><strong>#${p.id}</strong></td>
                    <td><code style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-family:monospace;">${p.branch}</code></td>
                    <td>${p.triggered_by}</td>
                    <td>${durStr}</td>
                    <td>${timeStr}</td>
                    <td><span class="badge badge-${p.status}">${p.status.toUpperCase()}</span></td>
                `;
                
                tr.addEventListener('click', () => {
                    document.querySelectorAll('#pipeline-runs-list tr').forEach(r => r.classList.remove('active-row'));
                    tr.classList.add('active-row');
                    selectPipelineRun(p);
                });
                
                listContainer.appendChild(tr);
            });
            
            // Auto-select the first run by default if not simulating and no row is active
            if (!activeSimulation && state.pipelines.length > 0) {
                const firstRow = listContainer.querySelector('tr');
                if (firstRow) firstRow.click();
            }
        }
    } catch (e) {
        console.error("Failed to render pipelines:", e);
    }
}

function selectPipelineRun(run) {
    const visualizer = document.getElementById('pipeline-visualizer-container');
    const logsConsole = document.getElementById('pipeline-logs-console-card');
    const logsTerminal = document.getElementById('pipeline-logs-terminal');
    const logsRunId = document.getElementById('pipeline-logs-run-id');
    
    if (!visualizer) return;
    
    // Clear visualizer
    visualizer.innerHTML = '';
    
    // Define Stages
    const stages = [
        { name: 'Checkout', desc: 'Pull latest source code and workspace files' },
        { name: 'Verify Syntax', desc: 'Verify Python server and configuration health' },
        { name: 'Build Docker Images', desc: 'Build backend and Nginx frontend Docker images' },
        { name: 'Integration Deployment', desc: 'Start containers and run sanity tests' }
    ];
    
    // Determine statuses based on run state
    let stageStates = ['pending', 'pending', 'pending', 'pending'];
    
    if (run.status === 'success') {
        stageStates = ['success', 'success', 'success', 'success'];
    } else if (run.status === 'failure') {
        if (run.logs.includes('syntax error')) {
            stageStates = ['success', 'failure', 'pending', 'pending'];
        } else {
            stageStates = ['success', 'success', 'success', 'failure'];
        }
    } else if (run.status === 'running') {
        if (activeSimulation && activeSimulation.id === run.id) {
            const currentStageIdx = activeSimulation.currentStage;
            for (let i = 0; i < 4; i++) {
                if (i < currentStageIdx) stageStates[i] = 'success';
                else if (i === currentStageIdx) stageStates[i] = 'running';
                else stageStates[i] = 'pending';
            }
        } else {
            stageStates = ['success', 'success', 'running', 'pending'];
        }
    }
    
    // Render stages
    stages.forEach((stage, idx) => {
        const item = document.createElement('div');
        const stState = stageStates[idx];
        item.className = `pipeline-stage-item ${stState}`;
        
        let iconHtml = '<i class="lucide-circle" style="width:16px;height:16px;"></i>';
        let metaHtml = 'Waiting to execute';
        
        if (stState === 'success') {
            iconHtml = '<i class="lucide-check" style="width:16px;height:16px;color:var(--color-success);"></i>';
            metaHtml = 'Completed successfully';
        } else if (stState === 'failure') {
            iconHtml = '<i class="lucide-x" style="width:16px;height:16px;color:var(--color-danger);"></i>';
            metaHtml = 'Execution failed';
        } else if (stState === 'running') {
            iconHtml = '<i class="lucide-loader-2" style="width:16px;height:16px;animation:spin 1s linear infinite;color:var(--accent-indigo);"></i>';
            metaHtml = 'In progress...';
        }
        
        item.innerHTML = `
            <div class="pipeline-stage-status-icon">
                ${iconHtml}
            </div>
            <div class="pipeline-stage-info">
                <div class="pipeline-stage-title">${stage.name}</div>
                <div class="pipeline-stage-meta">${stage.desc} &bull; <strong style="text-transform: capitalize;">${stState}</strong></div>
            </div>
        `;
        
        visualizer.appendChild(item);
    });
    
    // Render console logs
    if (logsConsole && logsTerminal && logsRunId) {
        logsConsole.style.display = 'block';
        logsRunId.innerText = `Run ID: #${run.id}`;
        logsTerminal.innerText = run.logs;
        logsTerminal.scrollTop = logsTerminal.scrollHeight;
    }
    
    // Initialize icons
    if (window.lucide) {
        window.lucide.createIcons({
            attrs: {
                class: 'lucide-custom'
            }
        });
    }
}

async function triggerPipelineRun() {
    if (activeSimulation) return;
    
    const triggerBtn = document.getElementById('trigger-pipeline-btn');
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = `<i class="lucide-loader-2" style="width:14px;height:14px;animation:spin 1s linear infinite;margin-right:6px;"></i> Simulating Build...`;
    }
    
    const runId = 'run-' + Math.floor(Math.random() * 9000 + 1000);
    const branches = ['main', 'dev', 'feature/auth-hooks', 'patch-dashboard'];
    const branch = branches[Math.floor(Math.random() * branches.length)];
    const username = currentUser ? currentUser.name : 'System';
    
    // 1. Register running state in DB
    const newRun = {
        id: runId,
        branch: branch,
        triggered_by: username,
        duration: 0,
        time: new Date().toISOString(),
        status: 'running',
        logs: `[${new Date().toLocaleTimeString()}] Starting pipeline execution...\n` +
              `[${new Date().toLocaleTimeString()}] Triggered by user: ${username}\n` +
              `[${new Date().toLocaleTimeString()}] Tracking git branch: refs/heads/${branch}\n\n`
    };
    
    activeSimulation = {
        id: runId,
        currentStage: 0,
        runData: newRun
    };
    
    try {
        await apiCall('/pipelines', 'POST', newRun);
        showToast(`Pipeline build #${runId} triggered successfully on branch ${branch}!`);
        
        // Refresh pipelines and select it
        await renderPipeline();
        
        // Focus the row
        const row = document.querySelector(`tr[data-run-id="${runId}"]`);
        if (row) {
            document.querySelectorAll('#pipeline-runs-list tr').forEach(r => r.classList.remove('active-row'));
            row.classList.add('active-row');
        }
        selectPipelineRun(activeSimulation.runData);
        
        // Stage simulated timeouts
        // Stage 1: Checkout (1000ms)
        setTimeout(async () => {
            activeSimulation.currentStage = 1;
            activeSimulation.runData.logs += 
                `[${new Date().toLocaleTimeString()}] --- Stage 1: Checkout ---\n` +
                `[${new Date().toLocaleTimeString()}] Fetching source code from repository...\n` +
                `[${new Date().toLocaleTimeString()}] Checking out Dockerfiles and configurations...\n` +
                `[${new Date().toLocaleTimeString()}] Workspace synchronization successful.\n\n`;
            
            await updateSimulatedState(1);
            
            // Stage 2: Verify Syntax (1200ms)
            setTimeout(async () => {
                activeSimulation.currentStage = 2;
                activeSimulation.runData.logs += 
                    `[${new Date().toLocaleTimeString()}] --- Stage 2: Verify Syntax ---\n` +
                    `[${new Date().toLocaleTimeString()}] Compiling server code (python3 -m py_compile server.py)...\n` +
                    `[${new Date().toLocaleTimeString()}] Static verification completed. 0 syntax errors found.\n\n`;
                
                await updateSimulatedState(2);
                
                // Stage 3: Build Docker Images (1500ms)
                setTimeout(async () => {
                    activeSimulation.currentStage = 3;
                    activeSimulation.runData.logs += 
                        `[${new Date().toLocaleTimeString()}] --- Stage 3: Build Docker Images ---\n` +
                        `[${new Date().toLocaleTimeString()}] Executing: docker build -t capstone-backend:latest -f Dockerfile .\n` +
                        `[${new Date().toLocaleTimeString()}] Step 1/5 : FROM python:3.10-slim\n` +
                        `[${new Date().toLocaleTimeString()}]  ---> Using cache (d4930184ca1f)\n` +
                        `[${new Date().toLocaleTimeString()}] Step 5/5 : CMD ["python", "server.py"]\n` +
                        `[${new Date().toLocaleTimeString()}] Successfully built capstone-backend:latest\n` +
                        `[${new Date().toLocaleTimeString()}] Executing: docker build -t capstone-frontend:latest -f Dockerfile.frontend .\n` +
                        `[${new Date().toLocaleTimeString()}] Successfully built capstone-frontend:latest\n\n`;
                    
                    await updateSimulatedState(3.5);
                    
                    // Stage 4: Integration Deployment (1500ms)
                    setTimeout(async () => {
                        activeSimulation.currentStage = 4;
                        
                        // Decide success or failure
                        const isSuccess = Math.random() > 0.15; // 85% success rate
                        
                        if (isSuccess) {
                            activeSimulation.runData.status = 'success';
                            activeSimulation.runData.duration = 6;
                            activeSimulation.runData.logs += 
                                `[${new Date().toLocaleTimeString()}] --- Stage 4: Integration Deployment ---\n` +
                                `[${new Date().toLocaleTimeString()}] Orchestrating: docker compose up -d\n` +
                                `[${new Date().toLocaleTimeString()}] Starting backend-1 ... started\n` +
                                `[${new Date().toLocaleTimeString()}] Starting frontend-1 ... started\n` +
                                `[${new Date().toLocaleTimeString()}] Integration deployment health checks: PASSED\n\n` +
                                `[${new Date().toLocaleTimeString()}] Pipeline completed successfully!`;
                                
                            showToast(`Pipeline build #${runId} finished successfully!`, 'success');
                        } else {
                            activeSimulation.runData.status = 'failure';
                            activeSimulation.runData.duration = 6;
                            activeSimulation.runData.logs += 
                                `[${new Date().toLocaleTimeString()}] --- Stage 4: Integration Deployment ---\n` +
                                `[${new Date().toLocaleTimeString()}] Orchestrating: docker compose up -d\n` +
                                `[${new Date().toLocaleTimeString()}] Starting backend-1 ... FAILED\n` +
                                `[${new Date().toLocaleTimeString()}] Error: Bind for port 5000 failed. Address already in use.\n` +
                                `[${new Date().toLocaleTimeString()}] Pipeline execution failed!`;
                                
                            showToast(`Pipeline build #${runId} failed!`, 'danger');
                        }
                        
                        await apiCall(`/pipelines/${runId}`, 'PUT', {
                            status: activeSimulation.runData.status,
                            duration: activeSimulation.runData.duration,
                            logs: activeSimulation.runData.logs
                        });
                        
                        // End Simulation
                        activeSimulation = null;
                        
                        if (triggerBtn) {
                            triggerBtn.disabled = false;
                            triggerBtn.innerHTML = `<i class="lucide-play" style="width: 14px; height: 14px;"></i> Trigger Build Pipeline`;
                        }
                        
                        // Re-render
                        await renderPipeline();
                        
                        // Re-select this run row to display the final state
                        const finalRow = document.querySelector(`tr[data-run-id="${runId}"]`);
                        if (finalRow) finalRow.click();
                        
                    }, 1500);
                }, 1500);
            }, 1200);
        }, 1000);
        
    } catch (err) {
        console.error("Simulation failed:", err);
        activeSimulation = null;
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = `<i class="lucide-play" style="width: 14px; height: 14px;"></i> Trigger Build Pipeline`;
        }
    }
}

async function updateSimulatedState(duration) {
    if (!activeSimulation) return;
    
    activeSimulation.runData.duration = duration;
    
    // Update DB
    await apiCall(`/pipelines/${activeSimulation.id}`, 'PUT', {
        duration: duration,
        logs: activeSimulation.runData.logs
    });
    
    // Re-render visualizer
    selectPipelineRun(activeSimulation.runData);
    
    // Update duration in table cell directly without full re-render
    const durCell = document.querySelector(`tr[data-run-id="${activeSimulation.id}"] td:nth-child(4)`);
    if (durCell) durCell.innerText = `${duration}s`;
}
