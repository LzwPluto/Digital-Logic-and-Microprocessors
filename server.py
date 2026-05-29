from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

app.static_folder = '.'
SAVE_DIR = "saves"

if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/main.html")
def main():
    return send_from_directory(".", "main.html")

@app.route("/list")
def list_files():
    return jsonify(os.listdir(SAVE_DIR))

@app.route("/load/<name>")
def load_file(name):
    path = os.path.join(SAVE_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

@app.route("/upload", methods=["POST"])
def upload():
    data = request.json
    name = data["name"]
    content = data["data"]
    
    path = os.path.join(SAVE_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(content, ensure_ascii=False, indent=2))
        
    return jsonify(ok=True)

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
