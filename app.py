from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import boto3
import botocore
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import timedelta
import os
import config  # Import AWS & DB credentials from config.py
from flask_session import Session

# Initialize Flask App
app = Flask(__name__, static_folder='static')
app.secret_key = "your_secret_key"
app.permanent_session_lifetime = timedelta(days=1)

# Allow CORS for frontend (5500)
CORS(app, supports_credentials=True, origins="*", allow_headers=["Content-Type", "Authorization"])

# ✅ Store sessions in the filesystem to persist across IPs
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_COOKIE_SECURE"] = False  # ✅ Set True if using HTTPS
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# AWS S3 Configuration
AWS_ACCESS_KEY = config.AWS_ACCESS_KEY
AWS_SECRET_KEY = config.AWS_SECRET_KEY
S3_BUCKET = config.S3_BUCKET
S3_REGION = config.S3_REGION
S3_BASE_URL = config.S3_BASE_URL

# Connect to AWS S3
s3 = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY
)

# Database Configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": config.DB_PASSWORD,
    "database": "svck_db"
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

# ---------------------------
# Faculty Authentication
# ---------------------------
@app.route('/faculty_dashboard')
def faculty_dashboard():
    return render_template("faculty_dashboard.html")  # ✅ This will correctly serve the page

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get("username").lower()
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT department, password FROM faculty WHERE username = %s", (username,))
    result = cur.fetchone()
    cur.close()
    conn.close()

    if result and result[1] == password:  # Checking plain text password
        session.permanent = True
        session['faculty'] = {'username': username, 'department': result[0], 'branch': result[0]}
        return jsonify({"message": "Login successful", "department": result[0], 'branch': result[0]}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('faculty', None)
    return jsonify({"message": "Logged out successfully"}), 200

# ---------------------------
# Fetch Study Materials (Students & Faculty)
# ---------------------------
@app.route('/materials', methods=['GET'])
def get_materials():
    branch = request.args.get("branch", "all")
    semester = request.args.get("semester", "all")
    subject = request.args.get("subject", "").lower()

    conn = get_db_connection()
    cur = conn.cursor()
    query = "SELECT id, title, branch, semester, subject, file_url FROM materials"
    params = []
    conditions = []
    if branch != "all":
        conditions.append("branch = %s")
        params.append(branch)
    if semester != "all":
        conditions.append("semester = %s")
        params.append(semester)
    if subject:
        conditions.append("LOWER(subject) LIKE %s")
        params.append(f"%{subject}%")
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    cur.execute(query, tuple(params))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    materials = [{"id": r[0], "title": r[1], "branch": r[2], "semester": r[3], "subject": r[4], "file_url": r[5]} for r in rows]
    return jsonify(materials), 200

# ---------------------------
# Upload Study Materials (Faculty Only)
# ---------------------------
@app.route('/upload', methods=['POST'])
def upload_material():
    # Check that the faculty is logged in
    if 'faculty' not in session:
        return jsonify({"error": "Unauthorized"}), 403

    faculty = session['faculty']
    file = request.files.get("file")
    title = request.form.get("title")
    branch = request.form.get("uploadBranch")  # From dropdown, e.g., "cse", "ece", "csm", or "all"
    semester = request.form.get("semester")
    subject = request.form.get("subject")

    # Simple check for required fields
    if not file or not title or not branch or not semester or not subject:
        return jsonify({"error": "Missing required fields"}), 400

    # Define folder path: if branch is "all", store in shared folder; else, store under the branch folder.
    if branch.lower() == "all":
        folder_path = f"shared/{semester}/{subject}/"
    else:
        folder_path = f"{branch}/{semester}/{subject}/"

    filename = folder_path + secure_filename(file.filename)

    try:
        # Check if the file already exists in S3
        try:
            s3.head_object(Bucket=S3_BUCKET, Key=filename)
            return jsonify({
                "error": "File already exists", 
                "file_url": f"{S3_BASE_URL}{filename}"
            }), 409
        except botocore.exceptions.ClientError as e:
            if e.response['Error']['Code'] != "404":
                return jsonify({"error": "Error checking file existence"}), 500

        # Upload the file to S3
        s3.upload_fileobj(file, S3_BUCKET, filename, ExtraArgs={'ContentType': file.content_type})
        file_url = f"{S3_BASE_URL}{filename}"

    except Exception as e:
        print(e)
        return jsonify({"error": "File upload failed"}), 500

    # Save file metadata in the database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO materials (title, branch, semester, subject, file_url) VALUES (%s, %s, %s, %s, %s)",
        (title, branch, semester, subject, file_url)
    )
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "File uploaded successfully", "file_url": file_url}), 200


# ---------------------------
# Delete Study Materials (Faculty Only)
# ---------------------------
@app.route('/delete/<int:material_id>', methods=['DELETE'])
def delete_material(material_id):
    if 'faculty' not in session:
        return jsonify({"error": "Unauthorized"}), 403  # Ensure faculty is logged in
    
    faculty = session['faculty']
    conn = get_db_connection()
    cur = conn.cursor()

    # Check if the material belongs to the faculty's department or is shared
    cur.execute("SELECT file_url, branch FROM materials WHERE id = %s", (material_id,))
    material = cur.fetchone()
    
    if not material:
        cur.close()
        conn.close()
        return jsonify({"error": "Material not found"}), 404

    file_url, branch = material

    # Ensure the faculty can only delete their own department files
    if branch != "all" and branch != faculty["branch"]:
        cur.close()
        conn.close()
        return jsonify({"error": "Permission denied"}), 403

    # Delete file from S3
    s3_key = file_url.replace(S3_BASE_URL, "")
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)
    except Exception as e:
        print(e)
        return jsonify({"error": "Failed to delete file from storage"}), 500

    # Delete record from the database
    cur.execute("DELETE FROM materials WHERE id = %s", (material_id,))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Material deleted successfully"}), 200

@app.route('/')
def home():
    return render_template('index.html')  # ✅ Ensure the file exists


# ---------------------------
# Run the Flask App
# ---------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
