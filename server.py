import os
import sqlite3
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

DB_FILE = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys constraints support in SQLite
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    print("Initializing Database and Schema Migration...")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            avatar TEXT NOT NULL
        )
    ''')

    # 2. Projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            goal TEXT,
            deadline TEXT NOT NULL,
            manager TEXT NOT NULL,
            status TEXT NOT NULL
        )
    ''')

    # 3. Milestones table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS milestones (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            text TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')

    # 4. Tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT NOT NULL,
            deadline TEXT NOT NULL,
            assignee TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')

    # 5. Comments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            time TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )
    ''')

    # 6. Chat messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            time TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')

    # 7. Documents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            size TEXT NOT NULL,
            uploader TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )
    ''')

    # 8. Notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            time TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0
        )
    ''')

    # 9. Resources table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS resources (
            name TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            availability TEXT NOT NULL DEFAULT 'available'
        )
    ''')

    # 10. Pipelines table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pipelines (
            id TEXT PRIMARY KEY,
            branch TEXT NOT NULL,
            triggered_by TEXT NOT NULL,
            duration INTEGER NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            logs TEXT NOT NULL
        )
    ''')

    # Seed initial data if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        print("Seeding initial data into SQLite database...")
        
        # Initial Users
        initial_users = [
            ('admin@enterprise.com', base64.b64encode(b'admin123').decode('utf-8'), 'Venkat', 'admin', 'V'),
            ('manager@enterprise.com', base64.b64encode(b'manager123').decode('utf-8'), 'Kavya', 'manager', 'K'),
            ('employee@enterprise.com', base64.b64encode(b'employee123').decode('utf-8'), 'Rahul', 'employee', 'R'),
            ('dev@enterprise.com', base64.b64encode(b'dev123').decode('utf-8'), 'Priya', 'employee', 'P')
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?)", initial_users)

        # Initial Resources
        initial_resources = [
            ('Venkat', 'admin', 'available'),
            ('Kavya', 'manager', 'busy'),
            ('Rahul', 'employee', 'available'),
            ('Priya', 'employee', 'available')
        ]
        cursor.executemany("INSERT INTO resources VALUES (?, ?, ?)", initial_resources)

        # Initial Projects
        initial_projects = [
            ('proj-1', 'ERP System Upgrade', 'Migrate database servers and modernize the browser user interface.', '2026-07-30', 'Kavya', 'in-progress'),
            ('proj-2', 'CRM Integration', 'Unify sales pipelines, analytics widgets, and customer helpdesk.', '2026-08-15', 'Venkat', 'todo'),
            ('proj-3', 'AI Support Chatbot', 'Fine-tune large language models and integrate with mobile client.', '2026-06-29', 'Kavya', 'completed')
        ]
        cursor.executemany("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)", initial_projects)

        # Initial Milestones
        initial_milestones = [
            ('m1', 'proj-1', 'Establish cloud servers', 1),
            ('m2', 'proj-1', 'Database staging migration', 0),
            ('m3', 'proj-1', 'Beta client dashboard deploy', 0),
            ('m4', 'proj-2', 'API integration endpoints ready', 0),
            ('m5', 'proj-2', 'Feedback metrics widget integration', 0),
            ('m6', 'proj-3', 'Dataset cleaning & ingestion', 1),
            ('m7', 'proj-3', 'Incorporate intent detection engines', 1)
        ]
        cursor.executemany("INSERT INTO milestones VALUES (?, ?, ?, ?)", initial_milestones)

        # Initial Tasks
        initial_tasks = [
            ('task-1', 'proj-1', 'Staging DB Migration', 'Migrate users and transactions tables to the cloud environment.', 'high', '2026-07-10', 'Priya', 'in-progress'),
            ('task-2', 'proj-1', 'Dashboard Widget Frontend', 'Create responsive stats display using mock endpoints.', 'medium', '2026-07-25', 'Rahul', 'todo'),
            ('task-3', 'proj-2', 'Support Widget Layout', 'Build mock ticketing interface.', 'low', '2026-08-10', 'Rahul', 'todo'),
            ('task-4', 'proj-3', 'NLP Models API Setup', 'Provide inference response server hooks.', 'high', '2026-06-24', 'Priya', 'completed')
        ]
        cursor.executemany("INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?)", initial_tasks)

        # Initial Comments
        initial_comments = [
            ('comment-1', 'task-1', 'Kavya', 'Make sure backups are taken before mig.', '2026-06-23T11:00:00')
        ]
        cursor.executemany("INSERT INTO comments VALUES (?, ?, ?, ?, ?)", initial_comments)

        # Initial Chat
        initial_chat = [
            ('msg-1', 'proj-1', 'Kavya', 'Welcome team! Use this channel to post updates.', '2026-06-23T10:00:00'),
            ('msg-2', 'proj-1', 'Priya', 'Drafting data models. Will share files soon.', '2026-06-23T10:20:00'),
            ('msg-3', 'proj-3', 'Kavya', 'Great job launching this on schedule!', '2026-06-23T11:00:00')
        ]
        cursor.executemany("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)", initial_chat)

        # Initial Documents
        initial_docs = [
            ('doc-1', 'proj-1', 'ERP_Data_Models.pdf', '2.4 MB', 'Priya'),
            ('doc-2', 'proj-3', 'AI_Architecture_Draft.png', '5.1 MB', 'Kavya')
        ]
        cursor.executemany("INSERT INTO documents VALUES (?, ?, ?, ?, ?)", initial_docs)

        # Initial Notifications
        initial_notis = [
            ('noti-1', 'Welcome to your Enterprise Collaboration hub!', '2026-06-23T09:00:00', 0)
        ]
        cursor.executemany("INSERT INTO notifications VALUES (?, ?, ?, ?)", initial_notis)

        # Initial Pipelines
        initial_pipelines = [
            ('run-1', 'main', 'Kavya', 42, '2026-06-23T04:45:00Z', 'success', 'Checking out source code...\nVerifying backend Python syntax...\nBuilding backend Docker image...\nBuilding frontend Docker image...\nStarting services via Docker Compose...\nVerifying running containers...\nPipeline completed successfully!'),
            ('run-2', 'dev', 'Priya', 38, '2026-06-24T09:00:00Z', 'success', 'Checking out source code...\nVerifying backend Python syntax...\nBuilding backend Docker image...\nBuilding frontend Docker image...\nStarting services via Docker Compose...\nVerifying running containers...\nPipeline completed successfully!'),
            ('run-3', 'main', 'Rahul', 12, '2026-06-25T02:30:00Z', 'failure', 'Checking out source code...\nVerifying backend Python syntax...\nsyntax error in server.py line 402: invalid syntax\nPipeline failed. Fetching logs...')
        ]
        cursor.executemany("INSERT INTO pipelines VALUES (?, ?, ?, ?, ?, ?, ?)", initial_pipelines)

    conn.commit()
    conn.close()
    print("Database Initialized Successfully.")

# --- API ROUTES ---

# Authentication / Session
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password') # incoming password
    
    encoded_pass = base64.b64encode(password.encode('utf-8')).decode('utf-8')
    
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, encoded_pass)).fetchone()
    conn.close()
    
    if user:
        return jsonify({
            'success': True,
            'user': {
                'email': user['email'],
                'name': user['name'],
                'role': user['role'],
                'avatar': user['avatar']
            }
        })
    return jsonify({'success': False, 'msg': 'Invalid email or password.'}), 401

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')
    avatar = name[0].upper() if name else '?'
    
    encoded_pass = base64.b64encode(password.encode('utf-8')).decode('utf-8')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if exists
    existing = cursor.execute("SELECT email FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'msg': 'Email address already exists.'}), 400
        
    try:
        cursor.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?)", (email, encoded_pass, name, role, avatar))
        cursor.execute("INSERT OR IGNORE INTO resources VALUES (?, ?, 'available')", (name, role))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/profile/update', methods=['POST'])
def update_profile():
    data = request.get_json()
    email = data.get('email')
    name = data.get('name')
    password = data.get('password')
    avatar = name[0].upper() if name else '?'
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        user = cursor.execute("SELECT name FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            return jsonify({'success': False, 'msg': 'User not found'}), 404
        
        old_name = user['name']
        
        # If password is provided, update password as well
        if password:
            encoded_pass = base64.b64encode(password.encode('utf-8')).decode('utf-8')
            cursor.execute("UPDATE users SET name = ?, password = ?, avatar = ? WHERE email = ?", (name, encoded_pass, avatar, email))
        else:
            cursor.execute("UPDATE users SET name = ?, avatar = ? WHERE email = ?", (name, avatar, email))
            
        # Update references if name changed
        if old_name != name:
            cursor.execute("UPDATE tasks SET assignee = ? WHERE assignee = ?", (name, old_name))
            cursor.execute("UPDATE resources SET name = ? WHERE name = ?", (name, old_name))
            cursor.execute("UPDATE projects SET manager = ? WHERE manager = ?", (name, old_name))
            cursor.execute("UPDATE chat_messages SET sender = ? WHERE sender = ?", (name, old_name))
            
        conn.commit()
        return jsonify({'success': True, 'user': {'email': email, 'name': name, 'role': cursor.execute("SELECT role FROM users WHERE email = ?", (email,)).fetchone()['role'], 'avatar': avatar}})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Projects CRUD
@app.route('/api/projects', methods=['GET'])
def get_projects():
    conn = get_db_connection()
    projects = conn.execute("SELECT * FROM projects").fetchall()
    
    result = []
    for proj in projects:
        proj_id = proj['id']
        milestones = conn.execute("SELECT * FROM milestones WHERE project_id = ?", (proj_id,)).fetchall()
        milestones_list = [{'id': m['id'], 'text': m['text'], 'completed': bool(m['completed'])} for m in milestones]
        
        result.append({
            'id': proj['id'],
            'name': proj['name'],
            'goal': proj['goal'],
            'deadline': proj['deadline'],
            'manager': proj['manager'],
            'status': proj['status'],
            'milestones': milestones_list
        })
    conn.close()
    return jsonify(result)

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)", 
                     (data['id'], data['name'], data['goal'], data['deadline'], data['manager'], data['status']))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/projects/<id>', methods=['PUT'])
def update_project(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("UPDATE projects SET name = ?, goal = ?, manager = ?, deadline = ?, status = ? WHERE id = ?", 
                     (data['name'], data['goal'], data['manager'], data['deadline'], data['status'], id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/projects/<id>', methods=['DELETE'])
def delete_project(id):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM projects WHERE id = ?", (id,))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Milestones
@app.route('/api/projects/<proj_id>/milestones', methods=['POST'])
def add_milestone(proj_id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO milestones VALUES (?, ?, ?, ?)", 
                     (data['id'], proj_id, data['text'], int(data['completed'])))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/projects/<proj_id>/milestones/<ms_id>', methods=['PUT'])
def update_milestone(proj_id, ms_id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("UPDATE milestones SET completed = ? WHERE id = ? AND project_id = ?", 
                     (int(data['completed']), ms_id, proj_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/projects/<proj_id>/milestones/<ms_id>', methods=['DELETE'])
def delete_milestone(proj_id, ms_id):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM milestones WHERE id = ? AND project_id = ?", (ms_id, proj_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Tasks & Comments CRUD
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    conn = get_db_connection()
    tasks = conn.execute("SELECT * FROM tasks").fetchall()
    
    result = []
    for t in tasks:
        task_id = t['id']
        comments = conn.execute("SELECT * FROM comments WHERE task_id = ? ORDER BY time ASC", (task_id,)).fetchall()
        comments_list = [{
            'sender': c['sender'],
            'text': c['text'],
            'time': c['time']
        } for c in comments]
        
        result.append({
            'id': t['id'],
            'projectId': t['project_id'],
            'title': t['title'],
            'description': t['description'],
            'priority': t['priority'],
            'deadline': t['deadline'],
            'assignee': t['assignee'],
            'status': t['status'],
            'comments': comments_list
        })
    conn.close()
    return jsonify(result)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
                     (data['id'], data['projectId'], data['title'], data['description'], data['priority'], data['deadline'], data['assignee'], data['status']))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/tasks/<id>', methods=['PUT'])
def update_task(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        # Standard query fields update dynamically based on payload
        fields = []
        values = []
        for key in ['title', 'description', 'priority', 'deadline', 'assignee', 'status']:
            if key in data:
                fields.append(f"{'project_id' if key == 'projectId' else key} = ?")
                values.append(data[key])
        values.append(id)
        
        q = f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
        conn.execute(q, values)
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/tasks/<id>', methods=['DELETE'])
def delete_task(id):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM tasks WHERE id = ?", (id,))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/tasks/<id>/comments', methods=['POST'])
def add_comment(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        comment_id = 'c-' + str(base64.b64encode(os.urandom(6)).decode('utf-8'))
        conn.execute("INSERT INTO comments VALUES (?, ?, ?, ?, ?)", 
                     (comment_id, id, data['sender'], data['text'], data['time']))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Collaboration Chat
@app.route('/api/chat/<proj_id>', methods=['GET'])
def get_chat(proj_id):
    conn = get_db_connection()
    messages = conn.execute("SELECT * FROM chat_messages WHERE project_id = ? ORDER BY time ASC", (proj_id,)).fetchall()
    result = [{
        'id': m['id'],
        'projectId': m['project_id'],
        'sender': m['sender'],
        'text': m['text'],
        'time': m['time']
    } for m in messages]
    conn.close()
    return jsonify(result)

@app.route('/api/chat', methods=['POST'])
def send_chat_msg():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)", 
                     (data['id'], data['projectId'], data['sender'], data['text'], data['time']))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Shared Documents
@app.route('/api/documents', methods=['GET'])
def get_documents():
    conn = get_db_connection()
    docs = conn.execute("SELECT * FROM documents").fetchall()
    result = [{
        'id': d['id'],
        'projectId': d['project_id'],
        'name': d['name'],
        'size': d['size'],
        'uploader': d['uploader']
    } for d in docs]
    conn.close()
    return jsonify(result)

@app.route('/api/documents', methods=['POST'])
def add_document():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO documents VALUES (?, ?, ?, ?, ?)", 
                     (data['id'], data['projectId'], data['name'], data['size'], data['uploader']))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/documents/<id>', methods=['DELETE'])
def delete_document(id):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM documents WHERE id = ?", (id,))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Resources Availability
@app.route('/api/resources', methods=['GET'])
def get_resources():
    conn = get_db_connection()
    res = conn.execute("SELECT * FROM resources").fetchall()
    result = [{
        'name': r['name'],
        'role': r['role'],
        'availability': r['availability']
    } for r in res]
    conn.close()
    return jsonify(result)

@app.route('/api/resources/availability', methods=['PUT'])
def update_resource_avail():
    data = request.get_json()
    name = data.get('name')
    availability = data.get('availability')
    
    conn = get_db_connection()
    try:
        conn.execute("UPDATE resources SET availability = ? WHERE name = ?", (availability, name))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Notifications
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    conn = get_db_connection()
    notis = conn.execute("SELECT * FROM notifications ORDER BY time DESC").fetchall()
    result = [{
        'id': n['id'],
        'text': n['text'],
        'time': n['time'],
        'read': bool(n['read'])
    } for n in notis]
    conn.close()
    return jsonify(result)

@app.route('/api/notifications', methods=['POST'])
def add_api_notification():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO notifications VALUES (?, ?, ?, ?)", 
                     (data['id'], data['text'], data['time'], int(data['read'])))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/notifications/read', methods=['PUT'])
def read_notifications():
    data = request.get_json()
    noti_id = data.get('id')
    
    conn = get_db_connection()
    try:
        if noti_id:
            conn.execute("UPDATE notifications SET read = 1 WHERE id = ?", (noti_id,))
        else:
            conn.execute("UPDATE notifications SET read = 1")
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Pipelines API
@app.route('/api/pipelines', methods=['GET'])
def get_pipelines():
    conn = get_db_connection()
    pipelines = conn.execute("SELECT * FROM pipelines ORDER BY time DESC").fetchall()
    result = [{
        'id': p['id'],
        'branch': p['branch'],
        'triggered_by': p['triggered_by'],
        'duration': p['duration'],
        'time': p['time'],
        'status': p['status'],
        'logs': p['logs']
    } for p in pipelines]
    conn.close()
    return jsonify(result)

@app.route('/api/pipelines', methods=['POST'])
def trigger_pipeline():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO pipelines VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (data['id'], data['branch'], data['triggered_by'], data['duration'], data['time'], data['status'], data['logs']))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/pipelines/<id>', methods=['PUT'])
def update_pipeline(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        fields = []
        values = []
        for key in ['status', 'duration', 'logs']:
            if key in data:
                fields.append(f"{key} = ?")
                values.append(data[key])
        values.append(id)
        
        q = f"UPDATE pipelines SET {', '.join(fields)} WHERE id = ?"
        conn.execute(q, values)
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        conn.close()

# Combined Database Backup Export / Restore Configs
@app.route('/api/backup', methods=['GET'])
def export_backup():
    conn = get_db_connection()
    backup_data = {}
    tables = ['users', 'projects', 'milestones', 'tasks', 'comments', 'chat_messages', 'documents', 'notifications', 'resources', 'pipelines']
    
    try:
        for t in tables:
            rows = conn.execute(f"SELECT * FROM {t}").fetchall()
            backup_data[t] = [dict(r) for r in rows]
        conn.close()
        return jsonify(backup_data)
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/backup', methods=['POST'])
def import_backup():
    backup_data = request.get_json()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Stop check constraints during bulk restore
        cursor.execute("PRAGMA foreign_keys = OFF")
        
        tables = ['users', 'projects', 'milestones', 'tasks', 'comments', 'chat_messages', 'documents', 'notifications', 'resources', 'pipelines']
        for t in tables:
            cursor.execute(f"DELETE FROM {t}")
            
            rows = backup_data.get(t, [])
            if not rows:
                continue
                
            cols = rows[0].keys()
            q = f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join(['?'] * len(cols))})"
            
            values = [tuple(row[col] for col in cols) for row in rows]
            cursor.executemany(q, values)
            
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'msg': str(e)}), 500
    finally:
        cursor.execute("PRAGMA foreign_keys = ON")
        conn.close()

if __name__ == '__main__':
    init_db()
    # Run on Port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
