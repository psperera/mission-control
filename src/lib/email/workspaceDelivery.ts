/**
 * Workspace-specific email delivery
 * Sends deliverables to workspace-configured email addresses
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

interface WorkspaceDeliveryOptions {
  to: string;
  subject: string;
  workspaceName: string;
  missionName: string;
  zipPath?: string;
  customMessage?: string;
  dashboardUrl: string;
}

interface DeliveryResult {
  success: boolean;
  error?: string;
}

export async function sendWorkspaceDeliverables(
  options: WorkspaceDeliveryOptions
): Promise<DeliveryResult> {
  const {
    to,
    subject,
    workspaceName,
    missionName,
    zipPath,
    customMessage,
    dashboardUrl
  } = options;

  // Create transporter
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_SERVER || 'smtp.zoho.eu',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.FROM_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Build email content
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0; padding:0; font-family:Arial, Helvetica, sans-serif; background-color:#f4f4f4;">
<table role="presentation" style="width:100%; border-collapse:collapse;">
<tr>
<td align="center" style="padding:20px 0;">
<table role="presentation" style="width:600px; border-collapse:collapse; background-color:#ffffff; border:1px solid #dddddd;">

<!-- Header -->
<tr>
<td style="padding:30px; background:linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); text-align:center;">
<h1 style="color:#ffffff; margin:0; font-size:24px; font-family:Arial, sans-serif;">${missionName}</h1>
<p style="color:#e0e0e0; margin:10px 0 0 0; font-size:14px;">${workspaceName}</p>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:30px;">

<!-- Progress Info -->
<table role="presentation" style="width:100%; background-color:#e8f4f8; border-left:4px solid #2a5298; margin-bottom:20px;">
<tr>
<td style="padding:15px;">
<p style="margin:0 0 10px 0; font-size:14px; color:#333;"><strong>Mission Update:</strong></p>
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Workspace:</strong> ${workspaceName}</p>
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Mission:</strong> ${missionName}</p>
${customMessage ? `<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Message:</strong> ${customMessage}</p>` : ''}
<p style="margin:5px 0; font-size:13px; color:#555;"><strong>Dashboard:</strong> <a href="${dashboardUrl}" style="color:#2a5298; text-decoration:none;">${dashboardUrl}</a></p>
</td>
</tr>
</table>

<p style="color:#333; font-size:13px; line-height:1.6;">
  ${zipPath ? 'Your mission deliverables are attached to this email.' : 'New progress has been made on your mission.'}
</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:20px 30px; background-color:#f9f9f9; border-top:1px solid #dddddd; text-align:center;">
<p style="margin:0; color:#666; font-size:13px;"><strong>Mission Control</strong></p>
<p style="margin:5px 0 0 0; color:#888; font-size:12px;">Automated deliverable notification</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
`;

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${process.env.FROM_NAME || 'Mission Control'}" <${process.env.FROM_EMAIL}>`,
    to,
    subject,
    html: htmlContent,
    text: `Mission: ${missionName}\nWorkspace: ${workspaceName}\n${customMessage || ''}\n\nDashboard: ${dashboardUrl}`
  };

  // Attach ZIP if provided
  if (zipPath && fs.existsSync(zipPath)) {
    mailOptions.attachments = [
      {
        filename: path.basename(zipPath),
        path: zipPath
      }
    ];
  }

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email delivery failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
