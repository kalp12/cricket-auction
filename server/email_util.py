import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "Cricket Auction <noreply@cricket-auction.com>")
EMAIL_ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def send_email(to: str, subject: str, body_html: str) -> bool:
    if not EMAIL_ENABLED:
        print(f"[Email] Skipping — SMTP not configured. Would send to {to}: {subject}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to, msg.as_string())

        print(f"[Email] Sent to {to}: {subject}")
        return True
    except Exception as e:
        print(f"[Email] Failed to send to {to}: {e}")
        return False


def send_registration_confirmation(email: str, player_name: str, auction_name: str) -> bool:
    return send_email(
        to=email,
        subject=f"Registration Received — {auction_name}",
        body_html=f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #1a1a2e; border-radius: 12px; color: #e0e0e0;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; line-height: 48px; font-size: 24px;">&#127942;</div>
                <h2 style="margin: 12px 0 4px; color: #fbbf24; font-size: 22px;">Registration Received</h2>
            </div>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Hi <strong style="color: #fff;">{player_name}</strong>,
            </p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Your registration for <strong style="color: #fbbf24;">{auction_name}</strong> has been submitted successfully.
                Our team will review your registration and you'll be notified once it's approved.
            </p>
            <div style="margin: 24px 0; padding: 16px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.15); border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #d97706;">Status: <strong>Pending Approval</strong></p>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 32px;">
                Powered by Cricket Auction
            </p>
        </div>
        """,
    )


def send_approval_notification(email: str, player_name: str, auction_name: str) -> bool:
    return send_email(
        to=email,
        subject=f"Registration Approved — {auction_name}",
        body_html=f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #1a1a2e; border-radius: 12px; color: #e0e0e0;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 12px; line-height: 48px; font-size: 24px;">&#9989;</div>
                <h2 style="margin: 12px 0 4px; color: #22c55e; font-size: 22px;">Registration Approved!</h2>
            </div>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Hi <strong style="color: #fff;">{player_name}</strong>,
            </p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Great news! Your registration for <strong style="color: #fbbf24;">{auction_name}</strong> has been <strong style="color: #22c55e;">approved</strong>.
                You've been added to the player pool and will be eligible for bidding.
            </p>
            <div style="margin: 24px 0; padding: 16px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.15); border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #16a34a;">Status: <strong>Approved — You're in the player pool!</strong></p>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 32px;">
                Powered by Cricket Auction
            </p>
        </div>
        """,
    )


def send_rejection_notification(email: str, player_name: str, auction_name: str) -> bool:
    return send_email(
        to=email,
        subject=f"Registration Update — {auction_name}",
        body_html=f"""
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #1a1a2e; border-radius: 12px; color: #e0e0e0;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #6b7280, #4b5563); border-radius: 12px; line-height: 48px; font-size: 24px;">&#128221;</div>
                <h2 style="margin: 12px 0 4px; color: #9ca3af; font-size: 22px;">Registration Update</h2>
            </div>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Hi <strong style="color: #fff;">{player_name}</strong>,
            </p>
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">
                Thank you for registering for <strong style="color: #fbbf24;">{auction_name}</strong>.
                Unfortunately, your registration was not approved at this time.
                Please contact the auction organizer for more information.
            </p>
            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 32px;">
                Powered by Cricket Auction
            </p>
        </div>
        """,
    )
