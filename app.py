from flask import Flask, render_template, request, redirect, url_for, jsonify, session, flash
import threading
import json
import os
from database import init_db, get_db
from bot import InstagramBot

app = Flask(__name__)
app.secret_key = "myreelbot_super_secret_key_2024"

bot_instance = None
bot_thread = None

@app.before_request
def setup():
    init_db()

# ─────────────────────────── AUTH ───────────────────────────
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        if username and password:
            db = get_db()
            db.execute("UPDATE settings SET value=? WHERE key='ig_username'", (username,))
            db.execute("UPDATE settings SET value=? WHERE key='ig_password'", (password,))
            db.commit()
            session["logged_in"] = True
            session["username"] = username
            flash("Instagram account connected! ✅", "success")
            return redirect(url_for("dashboard"))
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────── DASHBOARD ───────────────────────────
@app.route("/")
@login_required
def dashboard():
    db = get_db()
    total_contacts = db.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
    total_dms_sent = db.execute("SELECT COUNT(*) FROM logs WHERE action='dm_sent'").fetchone()[0]
    total_automations = db.execute("SELECT COUNT(*) FROM automations WHERE active=1").fetchone()[0]
    recent_logs = db.execute("SELECT * FROM logs ORDER BY created_at DESC LIMIT 10").fetchall()
    return render_template("dashboard.html",
        total_contacts=total_contacts,
        total_dms_sent=total_dms_sent,
        total_automations=total_automations,
        recent_logs=recent_logs,
        bot_running=bot_instance is not None and getattr(bot_instance, 'running', False)
    )

# ─────────────────────────── AUTOMATIONS ───────────────────────────
@app.route("/automations")
@login_required
def automations():
    db = get_db()
    autos = db.execute("SELECT * FROM automations ORDER BY created_at DESC").fetchall()
    return render_template("automations.html", automations=autos)

@app.route("/automations/create", methods=["GET", "POST"])
@login_required
def create_automation():
    if request.method == "POST":
        name = request.form.get("name")
        keyword = request.form.get("keyword", "").strip().lower()
        link = request.form.get("link")
        dm_message = request.form.get("dm_message")
        reply_comment = request.form.get("reply_comment")
        db = get_db()
        db.execute(
            "INSERT INTO automations (name, keyword, link, dm_message, reply_comment, active) VALUES (?,?,?,?,?,1)",
            (name, keyword, link, dm_message, reply_comment)
        )
        db.commit()
        flash(f"Automation '{name}' created! ✅", "success")
        return redirect(url_for("automations"))
    return render_template("create_automation.html")

@app.route("/automations/toggle/<int:auto_id>")
@login_required
def toggle_automation(auto_id):
    db = get_db()
    current = db.execute("SELECT active FROM automations WHERE id=?", (auto_id,)).fetchone()
    if current:
        new_val = 0 if current["active"] else 1
        db.execute("UPDATE automations SET active=? WHERE id=?", (new_val, auto_id))
        db.commit()
    return redirect(url_for("automations"))

@app.route("/automations/delete/<int:auto_id>")
@login_required
def delete_automation(auto_id):
    db = get_db()
    db.execute("DELETE FROM automations WHERE id=?", (auto_id,))
    db.commit()
    flash("Automation deleted!", "info")
    return redirect(url_for("automations"))

# ─────────────────────────── CONTACTS ───────────────────────────
@app.route("/contacts")
@login_required
def contacts():
    db = get_db()
    all_contacts = db.execute("SELECT * FROM contacts ORDER BY created_at DESC").fetchall()
    return render_template("contacts.html", contacts=all_contacts)

# ─────────────────────────── LOGS ───────────────────────────
@app.route("/logs")
@login_required
def logs():
    db = get_db()
    all_logs = db.execute("SELECT * FROM logs ORDER BY created_at DESC LIMIT 100").fetchall()
    return render_template("logs.html", logs=all_logs)

@app.route("/api/logs")
@login_required
def api_logs():
    db = get_db()
    all_logs = db.execute("SELECT * FROM logs ORDER BY created_at DESC LIMIT 20").fetchall()
    return jsonify([dict(l) for l in all_logs])

# ─────────────────────────── SETTINGS ───────────────────────────
@app.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    db = get_db()
    if request.method == "POST":
        for key in ["ig_username", "ig_password", "poll_interval"]:
            val = request.form.get(key)
            if val:
                db.execute("UPDATE settings SET value=? WHERE key=?", (val, key))
        db.commit()
        flash("Settings saved! ✅", "success")
        return redirect(url_for("settings"))
    cfg = {r["key"]: r["value"] for r in db.execute("SELECT * FROM settings").fetchall()}
    return render_template("settings.html", cfg=cfg)

# ─────────────────────────── BOT CONTROL ───────────────────────────
@app.route("/bot/start")
@login_required
def start_bot():
    global bot_instance, bot_thread
    db = get_db()
    cfg = {r["key"]: r["value"] for r in db.execute("SELECT * FROM settings").fetchall()}
    username = cfg.get("ig_username", "")
    password = cfg.get("ig_password", "")
    if not username or not password:
        flash("Pehle Instagram account connect karo Settings mein! ⚠️", "warning")
        return redirect(url_for("settings"))
    if bot_instance and getattr(bot_instance, 'running', False):
        flash("Bot already chal raha hai! ✅", "info")
        return redirect(url_for("dashboard"))
    bot_instance = InstagramBot(username, password)
    bot_thread = threading.Thread(target=bot_instance.start, daemon=True)
    bot_thread.start()
    flash("Bot start ho gaya! 🚀 Comments sun raha hai...", "success")
    return redirect(url_for("dashboard"))

@app.route("/bot/stop")
@login_required
def stop_bot():
    global bot_instance
    if bot_instance:
        bot_instance.stop()
        bot_instance = None
    flash("Bot band kar diya. ⛔", "info")
    return redirect(url_for("dashboard"))

@app.route("/bot/status")
def bot_status():
    running = bot_instance is not None and getattr(bot_instance, 'running', False)
    return jsonify({"running": running})

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 MyReelBot Dashboard chal raha hai: http://localhost:{port}")
    app.run(debug=False, host="0.0.0.0", port=port, use_reloader=False)
