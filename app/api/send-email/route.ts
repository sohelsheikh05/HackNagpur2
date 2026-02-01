import { NextRequest, NextResponse } from 'next/server';

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || '587';
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    // Check if SMTP is configured - if not, log and return success (simulated)
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.log('[EMAIL] SMTP not fully configured - simulating email');
      console.log('[EMAIL] To:', to);
      console.log('[EMAIL] Subject:', subject);
      
      return NextResponse.json({
        success: true,
        message: 'Email logged (SMTP not fully configured)',
        simulated: true,
      });
    }

    // Dynamically import nodemailer only when needed
    const nodemailer = await import('nodemailer');

    // Create transporter
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Send email
    await transporter.sendMail({
      from: `"SafeRide Alerts" <${smtpUser}>`,
      to,
      subject,
      text: text || '',
      html,
    });

    console.log('[EMAIL] Email sent successfully to:', to);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      to,
      subject,
    });

  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
