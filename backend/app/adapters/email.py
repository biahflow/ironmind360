import asyncio
import smtplib
from email.message import EmailMessage

from app.config import settings


class SMTPEmailProvider:
    async def send(self, *, to: str, subject: str, text: str) -> None:
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = to
        message["Subject"] = subject
        message.set_content(text)

        def _send() -> None:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.send_message(message)

        await asyncio.to_thread(_send)
