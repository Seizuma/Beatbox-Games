const nodemailer = require('nodemailer');
const { WebhookClient } = require('discord.js');

class ContactService {
    constructor() {
        // Configuration email avec vérification
        try {
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                this.emailTransporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
                console.log('Email configuration detected for:', process.env.SMTP_USER);
            } else {
                console.log('Email configuration incomplete - email disabled');
                this.emailTransporter = null;
            }
        } catch (error) {
            console.error('Email configuration error:', error);
            this.emailTransporter = null;
        }

        // Configuration Discord Webhooks
        this.discordWebhooks = {
            bugs: process.env.DISCORD_WEBHOOK_BUGS ? new WebhookClient({ url: process.env.DISCORD_WEBHOOK_BUGS }) : null,
            suggestions: process.env.DISCORD_WEBHOOK_SUGGESTIONS ? new WebhookClient({ url: process.env.DISCORD_WEBHOOK_SUGGESTIONS }) : null
        };

        this.contactEmail = process.env.CONTACT_EMAIL || 'contact@beatboxgames.com';

        // Système de rate limiting en mémoire (Redis recommandé en production)
        this.userSubmissions = new Map(); // discordId -> { date: string, submissions: { category: count } }

        // Nettoyage automatique toutes les heures
        setInterval(() => this.cleanupOldRecords(), 60 * 60 * 1000);

        // Log configuration status
        console.log('ContactService Configuration:');
        console.log('  Email:', this.emailTransporter ? 'Enabled' : 'Disabled');
        console.log('  Discord Bugs:', this.discordWebhooks.bugs ? 'Enabled' : 'Disabled');
        console.log('  Discord Suggestions:', this.discordWebhooks.suggestions ? 'Enabled' : 'Disabled');
    }

    async sendContactMessage(data, discordUser) {
        if (!discordUser || !discordUser.discordId) {
            throw new Error('Discord authentication required');
        }

        const { type, category, details } = data;

        // Vérifier les limites de soumission
        const rateLimitCheck = this.checkRateLimit(discordUser.discordId, category);
        if (!rateLimitCheck.allowed) {
            const error = new Error(`Rate limit exceeded for category ${category}. Limit: ${rateLimitCheck.limit}, used: ${rateLimitCheck.used}`);
            error.rateLimited = true;
            throw error;
        }

        const results = {
            email: { success: false, error: null },
            discord: { success: false, error: null }
        };

        try {
            console.log(`Sending contact message from ${discordUser.username}: ${type} - ${category}`);

            const subject = type === 'bug' ? '🐛 New Bug Report' : '💡 New Suggestion';
            const categoryText = this.getCategoryText(category);

            const emailContent = this.formatEmailContent({ type, category: categoryText, details, subject, user: discordUser });
            const discordContent = this.formatDiscordContent({ type, category: categoryText, details, user: discordUser });

            // Email sending
            if (this.emailTransporter && this.contactEmail) {
                try {
                    console.log('Attempting to send email...');
                    await this.sendEmail(subject, emailContent);
                    results.email.success = true;
                    console.log('Email sent successfully');
                } catch (error) {
                    results.email.error = error.message;
                    console.error('Email sending error:', error.message);
                    if (error.code) console.error('Error code:', error.code);
                }
            } else {
                console.log('Email not configured, skipping');
                results.email.error = 'Email configuration missing';
            }

            // Discord sending
            const webhook = type === 'bug' ? this.discordWebhooks.bugs : this.discordWebhooks.suggestions;
            if (webhook) {
                try {
                    console.log('Attempting to send Discord message...');
                    await this.sendDiscordMessage(webhook, discordContent, type);
                    results.discord.success = true;
                    console.log('Discord message sent successfully');
                } catch (error) {
                    results.discord.error = error.message;
                    console.error('Discord sending error:', error.message);
                }
            } else {
                console.log('Discord not configured, skipping');
                results.discord.error = 'Discord configuration missing';
            }

            // Check if at least one method succeeded
            if (!results.email.success && !results.discord.success) {
                throw new Error('No communication channels available');
            }

            // Enregistrer la soumission réussie
            this.recordSubmission(discordUser.discordId, category);

            console.log(`Contact message processed - Email: ${results.email.success ? 'OK' : 'FAILED'}, Discord: ${results.discord.success ? 'OK' : 'FAILED'}`);
            return { success: true, results };

        } catch (error) {
            console.error('General contact sending error:', error);
            throw error;
        }
    }

    checkRateLimit(discordId, category) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const userRecord = this.userSubmissions.get(discordId);

        // Si pas de record ou date différente, créer nouveau record
        if (!userRecord || userRecord.date !== today) {
            return { allowed: true, used: 0, limit: 10 };
        }

        const used = userRecord.submissions[category] || 0;
        const limit = 10;

        return {
            allowed: used < limit,
            used: used,
            limit: limit
        };
    }

    recordSubmission(discordId, category) {
        const today = new Date().toISOString().split('T')[0];
        const userRecord = this.userSubmissions.get(discordId);

        if (!userRecord || userRecord.date !== today) {
            // Nouveau jour ou nouvel utilisateur
            this.userSubmissions.set(discordId, {
                date: today,
                submissions: { [category]: 1 }
            });
        } else {
            // Incrémenter le compteur pour cette catégorie
            userRecord.submissions[category] = (userRecord.submissions[category] || 0) + 1;
        }
    }

    getUserSubmissionLimits(discordId) {
        const today = new Date().toISOString().split('T')[0];
        const userRecord = this.userSubmissions.get(discordId);

        if (!userRecord || userRecord.date !== today) {
            return { blindtest: 0, buzzer: 0, other: 0 };
        }

        return {
            blindtest: userRecord.submissions.blindtest || 0,
            buzzer: userRecord.submissions.buzzer || 0,
            other: userRecord.submissions.other || 0
        };
    }

    // Nettoyage automatique des anciens records (appelé périodiquement)
    cleanupOldRecords() {
        const today = new Date().toISOString().split('T')[0];

        for (const [discordId, record] of this.userSubmissions.entries()) {
            if (record.date !== today) {
                this.userSubmissions.delete(discordId);
            }
        }

        console.log(`Cleaned up old submission records. Current active users: ${this.userSubmissions.size}`);
    }

    getCategoryText(category) {
        const categories = {
            blindtest: 'Blind Test',
            buzzer: 'Buzzer Battle',
            other: 'Other'
        };
        return categories[category] || category;
    }

    formatEmailContent({ type, category, details, subject, user }) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-bottom: 15px; }
        .details { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .user-info { background: #e8f4fd; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">${subject}</h1>
        </div>
        <div class="content">
            <div class="user-info">
                <div class="label">👤 From Discord User:</div>
                <div><strong>${user.username}</strong> (ID: ${user.discordId})</div>
            </div>
            <div class="value">
                <span class="label">Type:</span> ${type === 'bug' ? '🐛 Bug Report' : '💡 Suggestion'}
            </div>
            <div class="value">
                <span class="label">Category:</span> ${category}
            </div>
            <div class="details">
                <div class="label">Details:</div>
                <p>${details.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="value">
                <span class="label">Date:</span> ${new Date().toLocaleString('en-US')}
            </div>
        </div>
        <div class="footer">
            BeatBox Games - Contact Form
        </div>
    </div>
</body>
</html>
        `;
    }

    formatDiscordContent({ type, category, details, user }) {
        const emoji = type === 'bug' ? '🐛' : '💡';
        const color = type === 'bug' ? 0xff4757 : 0x3742fa;

        return {
            embeds: [{
                title: `${emoji} New ${type === 'bug' ? 'Bug Report' : 'Suggestion'}`,
                color: color,
                fields: [
                    {
                        name: '👤 User',
                        value: `${user.username} (${user.discordId})`,
                        inline: true
                    },
                    {
                        name: '📝 Category',
                        value: category,
                        inline: true
                    },
                    {
                        name: '🕒 Date',
                        value: new Date().toLocaleString('en-US'),
                        inline: true
                    },
                    {
                        name: '📋 Details',
                        value: details.length > 1000 ? details.substring(0, 1000) + '...' : details,
                        inline: false
                    }
                ],
                footer: {
                    text: 'BeatBox Games - Contact Form'
                },
                timestamp: new Date().toISOString()
            }]
        };
    }

    async sendEmail(subject, htmlContent) {
        // Test connection before sending
        try {
            await this.emailTransporter.verify();
            console.log('SMTP connection verified');
        } catch (error) {
            console.error('SMTP verification failed:', error.message);
            throw error;
        }

        const mailOptions = {
            from: `"BeatBox Games Contact" <${this.emailTransporter.options.auth.user}>`,
            to: this.contactEmail,
            subject: subject,
            html: htmlContent
        };

        console.log('Sending email from:', mailOptions.from);
        console.log('Sending email to:', mailOptions.to);

        return await this.emailTransporter.sendMail(mailOptions);
    }

    async sendDiscordMessage(webhook, content, type) {
        return await webhook.send(content);
    }

    // Test method for email configuration
    async testEmailConfiguration() {
        if (!this.emailTransporter) {
            return { success: false, error: 'No email configuration' };
        }

        try {
            await this.emailTransporter.verify();
            return { success: true, message: 'Email configuration OK' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ContactService();