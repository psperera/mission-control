#!/usr/bin/env python3
"""
Mission Control Email Delivery Module
Sends mission deliverables via email with professional formatting
"""

import smtplib
import ssl
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from pathlib import Path

# Configuration from environment variables
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.zoho.eu')
SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
FROM_EMAIL = os.getenv('FROM_EMAIL', '')
FROM_NAME = os.getenv('FROM_NAME', 'Mission Control')

# Logo.dev configuration (optional - for company logos)
LOGO_DEV_KEY = os.getenv('LOGO_DEV_KEY', '')

# Company logo URLs (can use logo.dev or inline SVG)
def get_logo_url(domain, size=100):
    """Get logo URL from logo.dev or return empty string"""
    if LOGO_DEV_KEY:
        return f"https://img.logo.dev/{domain}?token={LOGO_DEV_KEY}&size={size}"
    return ''


def create_email_template(subject, dashboard_url, username, password, 
                          zip_filename, zip_size, company_logos=None):
    """
    Create professional email template with company logos and download info
    
    Args:
        subject: Email subject line
        dashboard_url: URL to mission dashboard
        username: Download username
        password: Download password
        zip_filename: Name of ZIP attachment
        zip_size: Size of ZIP file in KB
        company_logos: List of dicts with 'name', 'url', 'link', 'color'
    """
    
    # Default company logos if none provided
    if company_logos is None:
        company_logos = [
            {'name': 'ESAB', 'domain': 'esab.com', 'link': 'https://www.esab.com', 'color': '#003366'},
            {'name': 'Eddyfi', 'domain': 'eddyfi.com', 'link': 'https://www.eddyfi.com', 'color': '#0066CC'},
            {'name': 'Waygate', 'domain': 'waygate-tech.com', 'link': 'https://www.waygate-tech.com', 'color': '#00A651'},
            {'name': 'Baker Hughes', 'domain': 'bakerhughes.com', 'link': 'https://www.bakerhughes.com', 'color': '#005EB8'},
        ]
    
    # Build logo HTML
    logo_cells = []
    for logo in company_logos:
        logo_url = get_logo_url(logo['domain']) if LOGO_DEV_KEY else ''
        if logo_url:
            img_html = f'<img src="{logo_url}" alt="{logo["name"]}" style="max-height:50px; max-width:100px; display:block; margin:0 auto;" onerror="this.style.display=\'none\'">'
        else:
            # Fallback to text logo
            img_html = f'<div style="font-size:16px; font-weight:bold; color:{logo["color"]}; padding:10px;">{logo["name"]}</div>'
        
        logo_cells.append(f'''
<td align="center" style="padding:5px; width:25%;">
<a href="{logo["link"]}" style="text-decoration:none;">
{img_html}
<div style="font-size:12px; color:{logo["color"]}; font-weight:bold; margin-top:5px;">{logo["name"]}</div>
</a>
</td>''')
    
    logo_row = '\n'.join(logo_cells)
    
    # Plain text version
    plain_body = f"""{subject}

DOWNLOAD
--------
Dashboard: {dashboard_url}
User: {username}
Pass: {password}

File: {zip_filename}
Size: {zip_size} KB

Access your secure deliverables via the dashboard link above.

Regards,
{FROM_NAME}
"""

    # HTML version
    html_body = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{subject}</title>
</head>
<body style="margin:0; padding:0; font-family:Arial, Helvetica, sans-serif; background-color:#f4f4f4;">
<table role="presentation" style="width:100%; border-collapse:collapse;">
<tr>
<td align="center" style="padding:20px 0;">
<table role="presentation" style="width:600px; border-collapse:collapse; background-color:#ffffff; border:1px solid #dddddd;">

<!-- Header -->
<tr>
<td style="padding:30px; background:linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); text-align:center;">
<h1 style="color:#ffffff; margin:0; font-size:24px; font-family:Arial, sans-serif;">{subject}</h1>
<p style="color:#e0e0e0; margin:10px 0 0 0; font-size:14px;">Mission Control Deliverables</p>
</td>
</tr>

<!-- Company Logos -->
<tr>
<td style="padding:20px 30px; background-color:#f9f9f9; border-bottom:1px solid #eeeeee;">
<table role="presentation" style="width:100%; border-collapse:collapse;">
<tr>
{logo_row}
</tr>
</table>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:30px;">

<!-- Download Box -->
<table role="presentation" style="width:100%; background-color:#e8f4f8; border-left:4px solid #2a5298; margin-bottom:20px;">
<tr>
<td style="padding:15px;">
<p style="margin:0 0 10px 0; font-size:14px; color:#333;"><strong>Secure Download:</strong></p>
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Dashboard:</strong> <a href="{dashboard_url}" style="color:#2a5298; text-decoration:none; font-weight:bold;">{dashboard_url}</a></p>
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Username:</strong> {username}</p>
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Password:</strong> {password}</p>
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>File:</strong> {zip_filename} ({zip_size} KB)</p>
</td>
</tr>
</table>

<p style="color:#333; font-size:13px; line-height:1.6;">Access your secure deliverables via the dashboard link above.</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:20px 30px; background-color:#f9f9f9; border-top:1px solid #dddddd; text-align:center;">
<p style="margin:0; color:#666; font-size:13px;"><strong>{FROM_NAME}</strong></p>
<p style="margin:5px 0 0 0; color:#888; font-size:12px;">{FROM_EMAIL}</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>"""

    return plain_body, html_body


def send_deliverable_email(to_email, subject, dashboard_url, username, password,
                           zip_path, company_logos=None, smtp_password=None):
    """
    Send deliverable email with ZIP attachment
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        dashboard_url: URL to dashboard
        username: Download username
        password: Download password
        zip_path: Path to ZIP file
        company_logos: Optional list of company logo configs
        smtp_password: SMTP password (or from env var)
    """
    
    if not FROM_EMAIL:
        raise ValueError("FROM_EMAIL not configured. Set in .env.local")
    
    if not smtp_password:
        smtp_password = os.getenv('SMTP_PASSWORD')
        if not smtp_password:
            raise ValueError("SMTP_PASSWORD not configured. Set in .env.local")
    
    zip_path = Path(zip_path)
    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP file not found: {zip_path}")
    
    zip_size = zip_path.stat().st_size // 1024
    
    # Create email content
    plain_body, html_body = create_email_template(
        subject, dashboard_url, username, password,
        zip_path.name, zip_size, company_logos
    )
    
    # Build message
    msg = MIMEMultipart('mixed')
    msg['Subject'] = subject
    msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg['To'] = to_email
    
    # Alternative part for HTML/text
    msg_alternative = MIMEMultipart('alternative')
    msg.attach(msg_alternative)
    
    msg_alternative.attach(MIMEText(plain_body, 'plain'))
    msg_alternative.attach(MIMEText(html_body, 'html'))
    
    # Attach ZIP file
    with open(zip_path, 'rb') as f:
        zip_attachment = MIMEApplication(f.read(), _subtype='zip')
        zip_attachment.add_header('Content-Disposition', 'attachment', filename=zip_path.name)
        msg.attach(zip_attachment)
    
    # Send email
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
        server.login(FROM_EMAIL, smtp_password)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())
    
    print(f"✅ Email sent to {to_email}")
    print(f"   Subject: {subject}")
    print(f"   Attachment: {zip_path.name} ({zip_size} KB)")


if __name__ == "__main__":
    # Example usage (requires environment variables to be set)
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 email_delivery.py <to_email>")
        print("\nRequired environment variables:")
        print("  FROM_EMAIL - Sender email address")
        print("  SMTP_PASSWORD - SMTP password")
        print("  LOGO_DEV_KEY - (Optional) logo.dev API key for company logos")
        sys.exit(1)
    
    to_email = sys.argv[1]
    
    # Example call (customize as needed)
    send_deliverable_email(
        to_email=to_email,
        subject="Mission Deliverables - Download Ready",
        dashboard_url="http://localhost:3000",
        username="mission",
        password="secure-password",
        zip_path="./deliverables.zip"
    )
