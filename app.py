from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import os
import base64
import sqlite3
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash', system_instruction="You are AgriSmart AI, an expert agricultural advisory chatbot. Assist farmers with crop management, disease identification, soil health, and subsidies.")

# --- DATABASE SETUP ---
DB_NAME = "agrismart.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    # Create Users Table
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, phone TEXT, password TEXT)''')
    # Create Posts Table
    cursor.execute('''CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT, content TEXT)''')
    # Create Comments Table
    cursor.execute('''CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, author TEXT, content TEXT, FOREIGN KEY(post_id) REFERENCES posts(id))''')
    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

# --- AUTHENTICATION ROUTES ---
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)", (data['name'], data['email'], data['phone'], data['password']))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "name": data['name']})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "Email already exists!"}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM users WHERE (email = ? OR name = ?) AND password = ?", (data['user'], data['user'], data['password']))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({"success": True, "name": user['name']})
    return jsonify({"success": False, "error": "Invalid credentials!"}), 401

# --- COMMUNITY ROUTES ---
@app.route('/api/posts', methods=['GET', 'POST'])
def handle_posts():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        cursor.execute("INSERT INTO posts (author, content) VALUES (?, ?)", (data['author'], data['content']))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
        
    # GET request: Fetch all posts
    cursor.execute("SELECT * FROM posts ORDER BY id DESC")
    posts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(posts)

@app.route('/api/comments/<int:post_id>', methods=['GET', 'POST'])
def handle_comments(post_id):
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        cursor.execute("INSERT INTO comments (post_id, author, content) VALUES (?, ?, ?)", (post_id, data['author'], data['content']))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
        
    # GET request: Fetch comments for a specific post
    cursor.execute("SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC", (post_id,))
    comments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(comments)

# --- AI ROUTES (Unchanged) ---
@app.route('/api/chat', methods=['POST'])
def chat():
    # ... (Keep your exact existing /api/chat logic here) ...
    data = request.json
    user_message = data.get('message', '')
    images_data = data.get('images', [])
    language = data.get('language', 'English')
    client_history = data.get('history', [])
    
    if not user_message and not images_data: return jsonify({"reply": "Please ask a question or upload an image."}), 400
    try:
        formatted_history = [{"role": "user" if msg['role'] == "user" else "model", "parts": [msg['text']]} for msg in client_history]
        chat_session = model.start_chat(history=formatted_history)
        contents = [f"Please respond in {language}.\nUser: {user_message}"]
        for img_data in images_data:
            header, encoded = img_data.split(",", 1)
            contents.append(Image.open(BytesIO(base64.b64decode(encoded))))
        response = chat_session.send_message(contents)
        return jsonify({"reply": response.text})
    except Exception as e:
        return jsonify({"reply": "Sorry, I encountered an error."}), 500

@app.route('/api/crop_health', methods=['POST'])
def crop_health():
    # ... (Keep your exact existing /api/crop_health logic here) ...
    data = request.json
    image_data = data.get('image', None)
    language = data.get('language', 'English')
    if not image_data: return jsonify({"reply": "Please upload an image."}), 400
    try:
        contents = [f"You are an expert agronomist AI. Provide NPK Levels, Health Rating, Issues, and Suggestions. Respond in {language}."]
        header, encoded = image_data.split(",", 1)
        contents.append(Image.open(BytesIO(base64.b64decode(encoded))))
        response = model.generate_content(contents)
        return jsonify({"reply": response.text})
    except Exception as e:
        return jsonify({"reply": "Error analyzing the crop."}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
