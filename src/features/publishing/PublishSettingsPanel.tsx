import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Button,
  Input,
  Label,
  Toggle,
} from '../../components/ui';
import type { PublishSettings } from '../../types/models';

export const DEFAULT_PUBLISH_SETTINGS: PublishSettings = {
  webhookUrl: '',
  webhookSecret: '',
  perPlatformWebhooks: {},
  autoPublishOnApproval: false,
};

interface PublishSettingsPanelProps {
  settings: PublishSettings;
  onUpdate: (settings: PublishSettings) => void;
}

export const PublishSettingsPanel: React.FC<PublishSettingsPanelProps> = ({
  settings,
  onUpdate,
}) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const handleTestWebhook = async () => {
    if (!settings.webhookUrl) return;

    setTestStatus('testing');
    setTestError('');

    try {
      // Send a test payload to the webhook (secret is in body, not header, due to no-cors)
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Test from PM Dashboard',
        entryId: 'test-entry-id',
        platforms: ['Instagram'],
        caption: 'This is a test post from PM Dashboard webhook configuration.',
        ...(settings.webhookSecret && { webhookSecret: settings.webhookSecret }),
      };

      await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
        mode: 'no-cors', // Zapier webhooks don't return CORS headers
      });

      // With no-cors, we can't read the response, but if no error thrown, assume success
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (error) {
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : 'Failed to send test');
    }
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-ocean-900">Publishing Integration</CardTitle>
        <p className="text-sm text-graystone-500">
          Configure Zapier webhook for auto-publishing content to social platforms.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Webhook URL */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Zapier Webhook URL</Label>
          <Input
            type="url"
            value={settings.webhookUrl}
            onChange={(e) => onUpdate({ ...settings, webhookUrl: e.target.value })}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-graystone-500">
            Create a Zapier webhook trigger and paste the URL here.
          </p>
        </div>

        {/* Webhook Secret */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Webhook Secret (Optional)</Label>
          <Input
            type="password"
            value={settings.webhookSecret}
            onChange={(e) => onUpdate({ ...settings, webhookSecret: e.target.value })}
            placeholder="Enter a secret for verification"
            className="font-mono text-sm"
          />
          <p className="text-xs text-graystone-500">
            Sent in the payload body as &ldquo;webhookSecret&rdquo; for verification in your Zap.
          </p>
        </div>

        {/* Auto-publish toggle */}
        <div className="flex items-center justify-between p-4 bg-graystone-50 rounded-xl">
          <div>
            <Label className="text-sm font-medium">Auto-publish on Approval</Label>
            <p className="text-xs text-graystone-500 mt-1">
              Automatically trigger publishing when an entry is approved and scheduled time is
              reached.
            </p>
          </div>
          <Toggle
            checked={settings.autoPublishOnApproval}
            onChange={(checked) => onUpdate({ ...settings, autoPublishOnApproval: checked })}
          />
        </div>

        {/* Test Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleTestWebhook}
            disabled={!settings.webhookUrl || testStatus === 'testing'}
          >
            {testStatus === 'testing' ? 'Testing...' : 'Test Webhook'}
          </Button>
          {testStatus === 'success' && (
            <span className="text-sm text-emerald-600">Test sent successfully!</span>
          )}
          {testStatus === 'error' && (
            <span className="text-sm text-red-600">{testError || 'Test failed'}</span>
          )}
        </div>

        {/* Webhook Payload Info */}
        <div className="p-4 bg-ocean-50 rounded-xl">
          <h4 className="text-sm font-medium text-ocean-900 mb-2">Webhook Payload Format</h4>
          <pre className="text-xs text-ocean-700 overflow-x-auto">
            {`{
  "entryId": "uuid",
  "platforms": ["Instagram", "Facebook"],
  "caption": "Post caption...",
  "platformCaptions": { "Instagram": "..." },
  "mediaUrls": ["https://..."],
  "scheduledDate": "2026-01-15T10:00:00Z",
  "firstComment": "First comment text",
  "callbackUrl": "https://your-supabase.../publish-callback",
  "webhookSecret": "your-secret-if-configured"
}`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};

export default PublishSettingsPanel;
