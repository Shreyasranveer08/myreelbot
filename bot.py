import time
import logging
from database import get_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT] %(message)s")

class InstagramBot:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.running = False
        self.client = None
        self.seen_comments = set()

    def login(self):
        try:
            from instagrapi import Client
            self.client = Client()
            self.client.login(self.username, self.password)
            self._log("login", self.username, f"✅ @{self.username} ne login kiya!")
            logging.info(f"Instagram login successful: @{self.username}")
            return True
        except Exception as e:
            self._log("error", self.username, f"Login failed: {str(e)}")
            logging.error(f"Login failed: {e}")
            return False

    def start(self):
        if not self.login():
            return
        self.running = True
        logging.info("Bot chal raha hai... comments sun raha hai!")
        self._log("bot_start", "system", "🤖 Bot start ho gaya — comments sun raha hai!")

        while self.running:
            try:
                self._check_comments()
            except Exception as e:
                logging.error(f"Error checking comments: {e}")
                self._log("error", "system", f"Error: {str(e)}")

            db = get_db()
            interval = int(db.execute("SELECT value FROM settings WHERE key='poll_interval'").fetchone()["value"] or 30)
            logging.info(f"Next check in {interval} seconds...")
            time.sleep(interval)

    def _check_comments(self):
        if not self.client:
            return

        db = get_db()
        automations = db.execute("SELECT * FROM automations WHERE active=1").fetchall()
        if not automations:
            return

        # Get user's recent posts/reels
        try:
            user_id = self.client.user_id
            medias = self.client.user_medias(user_id, 5)  # check last 5 posts
        except Exception as e:
            logging.error(f"Could not fetch medias: {e}")
            return

        for media in medias:
            try:
                comments = self.client.media_comments(media.id, amount=20)
            except Exception as e:
                logging.warning(f"Could not fetch comments for {media.id}: {e}")
                continue

            for comment in comments:
                comment_key = str(comment.pk)
                if comment_key in self.seen_comments:
                    continue
                self.seen_comments.add(comment_key)

                comment_text = comment.text.strip().lower()
                commenter_username = comment.user.username
                commenter_id = str(comment.user.pk)

                logging.info(f"New comment from @{commenter_username}: '{comment.text}'")
                self._log("comment", commenter_username, f"Comment: '{comment.text}'")

                # Check each automation
                for auto in automations:
                    keyword = auto["keyword"].strip().lower()
                    if not keyword or keyword in comment_text:
                        # Send DM
                        self._send_dm(commenter_username, commenter_id, auto)
                        # Update automation trigger count
                        db.execute("UPDATE automations SET triggered_count=triggered_count+1 WHERE id=?", (auto["id"],))
                        db.commit()
                        break  # Only trigger one automation per comment

    def _send_dm(self, username, user_id, automation):
        try:
            message = automation["dm_message"].replace("{link}", automation["link"]).replace("{username}", username)
            self.client.direct_send(message, [int(user_id)])
            self._log("dm_sent", username, f"✅ DM bheja: {automation['link']}")
            logging.info(f"DM sent to @{username}")
            # Save contact
            db = get_db()
            db.execute("""
                INSERT INTO contacts (instagram_username, instagram_id, last_comment, dms_received)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(instagram_username) DO UPDATE SET
                    dms_received=dms_received+1,
                    last_comment=excluded.last_comment
            """, (username, user_id, automation["keyword"]))
            db.commit()
        except Exception as e:
            self._log("error", username, f"DM send nahi hua: {str(e)}")
            logging.error(f"DM failed for @{username}: {e}")

    def _log(self, action, username, message):
        try:
            db = get_db()
            db.execute("INSERT INTO logs (action, username, message) VALUES (?,?,?)", (action, username, message))
            db.commit()
        except:
            pass

    def stop(self):
        self.running = False
        self._log("bot_stop", "system", "⛔ Bot band kar diya.")
        logging.info("Bot stopped.")
