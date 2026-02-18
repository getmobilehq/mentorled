'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { emailTemplatesAPI } from '@/lib/api';
import {
  EmailTemplateListItem,
  EmailTemplateDetail,
  EmailTemplateVariable,
  EmailConfigStatus,
} from '@/types';
import {
  Mail,
  Eye,
  Edit3,
  Send,
  RotateCcw,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Code,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, 'info' | 'warning' | 'success' | 'default'> = {
  Screening: 'info',
  Delivery: 'warning',
  Challenges: 'success',
};

export default function EmailTemplatesPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'configuration'>('templates');
  const [templates, setTemplates] = useState<EmailTemplateListItem[]>([]);
  const [config, setConfig] = useState<EmailConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateListItem | null>(null);
  const [previewVariables, setPreviewVariables] = useState<EmailTemplateVariable[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplateDetail | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editPreviewHtml, setEditPreviewHtml] = useState('');
  const [showEditPreview, setShowEditPreview] = useState(false);
  const [showVariableRef, setShowVariableRef] = useState(false);

  // Test send modal
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [testSendKey, setTestSendKey] = useState('');
  const [testSendEmail, setTestSendEmail] = useState('');
  const [testSendResult, setTestSendResult] = useState<{ status: string; message: string } | null>(null);
  const [testSending, setTestSending] = useState(false);

  // Revert confirm
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const [revertKey, setRevertKey] = useState('');
  const [reverting, setReverting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, configRes] = await Promise.all([
        emailTemplatesAPI.list(),
        emailTemplatesAPI.getConfig(),
      ]);
      setTemplates(templatesRes.data);
      setConfig(configRes.data);
    } catch (err) {
      console.error('Failed to fetch email template data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePreview = async (template: EmailTemplateListItem) => {
    setPreviewTemplate(template);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const [previewRes, detailRes] = await Promise.all([
        emailTemplatesAPI.getPreview(template.key),
        emailTemplatesAPI.get(template.key),
      ]);
      setPreviewHtml(previewRes.data.html);
      setPreviewSubject(previewRes.data.subject);
      setPreviewVariables(detailRes.data.variables);
    } catch (err) {
      console.error('Failed to load preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEdit = async (templateKey: string) => {
    try {
      const res = await emailTemplatesAPI.get(templateKey);
      const detail: EmailTemplateDetail = res.data;
      setEditTemplate(detail);
      setEditSubject(detail.current_subject);
      setEditContent(detail.current_content);
      setEditError('');
      setShowEditPreview(false);
      setEditPreviewHtml('');
      setShowVariableRef(false);
      setEditOpen(true);
    } catch (err) {
      console.error('Failed to load template for editing:', err);
    }
  };

  const handleEditPreview = async () => {
    if (!editTemplate) return;
    try {
      // Save temporarily to preview, then revert if needed
      // Actually, we preview the current saved version, not the in-progress edit
      // For a real preview of edits, we'd need a preview-with-content endpoint
      // For now, preview the currently saved version
      const res = await emailTemplatesAPI.getPreview(editTemplate.key);
      setEditPreviewHtml(res.data.html);
      setShowEditPreview(true);
    } catch (err) {
      console.error('Failed to generate preview:', err);
    }
  };

  const handleSave = async () => {
    if (!editTemplate) return;
    setEditSaving(true);
    setEditError('');
    try {
      await emailTemplatesAPI.update(editTemplate.key, {
        subject: editSubject,
        content: editContent,
      });
      setEditOpen(false);
      fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEditError(detail || 'Failed to save template. Please check the syntax.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    try {
      await emailTemplatesAPI.revert(revertKey);
      setRevertConfirmOpen(false);
      setEditOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to revert template:', err);
    } finally {
      setReverting(false);
    }
  };

  const handleTestSend = async () => {
    if (!testSendEmail) return;
    setTestSending(true);
    setTestSendResult(null);
    try {
      const res = await emailTemplatesAPI.testSend(testSendKey, { to_email: testSendEmail });
      setTestSendResult(res.data);
    } catch (err: any) {
      setTestSendResult({ status: 'failed', message: err?.response?.data?.detail || 'Failed to send test email.' });
    } finally {
      setTestSending(false);
    }
  };

  const tabs = [
    { key: 'templates', label: 'Templates' },
    { key: 'configuration', label: 'Configuration' },
  ] as const;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and customize email templates sent by the platform
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tmpl) => (
                  <Card key={tmpl.key} className="hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900">{tmpl.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={CATEGORY_COLORS[tmpl.category] || 'default'}>
                          {tmpl.category}
                        </Badge>
                        {tmpl.has_override && (
                          <Badge variant="warning">Customized</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{tmpl.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {tmpl.variable_count} variable{tmpl.variable_count !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreview(tmpl)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(tmpl.key)}
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTestSendKey(tmpl.key);
                            setTestSendEmail('');
                            setTestSendResult(null);
                            setTestSendOpen(true);
                          }}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Test
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Configuration Tab */}
            {activeTab === 'configuration' && config && (
              <div className="max-w-2xl space-y-6">
                <Card>
                  <div className="flex items-center gap-3 mb-6">
                    <Server className="h-6 w-6 text-gray-400" />
                    <h2 className="text-lg font-semibold text-gray-900">SMTP Configuration</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Email Sending</span>
                      {config.enabled ? (
                        <Badge variant="success">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="danger">
                          <XCircle className="h-3 w-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-700">SMTP Host</span>
                      <span className="text-sm text-gray-600 font-mono">{config.smtp_host}:{config.smtp_port}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-700">From Name</span>
                      <span className="text-sm text-gray-600">{config.smtp_from_name}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-700">From Email</span>
                      <span className="text-sm text-gray-600 font-mono">
                        {config.smtp_from_email || '(not configured)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm font-medium text-gray-700">Credentials</span>
                      {config.has_credentials ? (
                        <Badge variant="success">Configured</Badge>
                      ) : (
                        <Badge variant="warning">Not Configured</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700">
                        Email configuration is managed via environment variables. Set <code className="bg-blue-100 px-1 rounded">ENABLE_EMAIL=true</code>,{' '}
                        <code className="bg-blue-100 px-1 rounded">SMTP_USER</code>, and{' '}
                        <code className="bg-blue-100 px-1 rounded">SMTP_PASSWORD</code> to enable sending.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Preview Modal */}
        <Modal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={previewTemplate ? `Preview: ${previewTemplate.name}` : 'Preview'}
          size="xl"
        >
          {previewLoading ? (
            <div className="text-center py-12 text-gray-500">Loading preview...</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Subject: </span>
                <span className="text-gray-600">{previewSubject}</span>
              </div>

              <div className="border rounded-lg overflow-hidden bg-gray-50">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full bg-white"
                  style={{ height: '450px' }}
                  sandbox="allow-same-origin"
                  title="Email Preview"
                />
              </div>

              {previewVariables.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Template Variables (sample data shown)</h4>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 px-2 text-gray-500 font-medium">Variable</th>
                          <th className="text-left py-1.5 px-2 text-gray-500 font-medium">Type</th>
                          <th className="text-left py-1.5 px-2 text-gray-500 font-medium">Sample</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewVariables.map((v) => (
                          <tr key={v.name} className="border-b border-gray-50">
                            <td className="py-1.5 px-2 font-mono text-blue-600">{'{{ ' + v.name + ' }}'}</td>
                            <td className="py-1.5 px-2 text-gray-500">{v.type}</td>
                            <td className="py-1.5 px-2 text-gray-600 max-w-xs truncate">
                              {typeof v.sample === 'object' ? JSON.stringify(v.sample) : String(v.sample)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPreviewOpen(false);
                    if (previewTemplate) handleEdit(previewTemplate.key);
                  }}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit Template
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (previewTemplate) {
                      setTestSendKey(previewTemplate.key);
                      setTestSendEmail('');
                      setTestSendResult(null);
                      setTestSendOpen(true);
                    }
                  }}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send Test
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Edit Modal */}
        <Modal
          open={editOpen}
          onOpenChange={setEditOpen}
          title={editTemplate ? `Edit: ${editTemplate.name}` : 'Edit Template'}
          size="xl"
        >
          {editTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {editTemplate.has_override ? (
                  <Badge variant="warning">Customized</Badge>
                ) : (
                  <Badge variant="default">Default</Badge>
                )}
                <span className="text-xs text-gray-400">{editTemplate.category}</span>
              </div>

              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {editError}
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>

              {/* HTML Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Code className="h-4 w-4" />
                    Template HTML (Jinja2)
                  </label>
                  <button
                    onClick={() => setShowVariableRef(!showVariableRef)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {showVariableRef ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Variable Reference
                  </button>
                </div>

                {showVariableRef && (
                  <div className="mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200 max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {editTemplate.variables.map((v) => (
                        <div key={v.name} className="flex items-center gap-2 text-xs">
                          <code className="text-blue-600 bg-blue-50 px-1 rounded">{'{{ ' + v.name + ' }}'}</code>
                          <span className="text-gray-500 truncate">{v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={16}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-y"
                  spellCheck={false}
                />
              </div>

              {/* Edit Preview */}
              {showEditPreview && editPreviewHtml && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Preview (saved version)</h4>
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    <iframe
                      srcDoc={editPreviewHtml}
                      className="w-full bg-white"
                      style={{ height: '300px' }}
                      sandbox="allow-same-origin"
                      title="Edit Preview"
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {editTemplate.has_override && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setRevertKey(editTemplate.key);
                        setRevertConfirmOpen(true);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Revert to Default
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={handleEditPreview}>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={editSaving}>
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Test Send Modal */}
        <Modal
          open={testSendOpen}
          onOpenChange={setTestSendOpen}
          title="Send Test Email"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Send a test email using sample data to verify the template renders correctly.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
              <input
                type="email"
                value={testSendEmail}
                onChange={(e) => setTestSendEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            {testSendResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  testSendResult.status === 'sent'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : testSendResult.status === 'skipped'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {testSendResult.message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setTestSendOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleTestSend}
                disabled={testSending || !testSendEmail}
              >
                <Send className="h-4 w-4 mr-1" />
                {testSending ? 'Sending...' : 'Send Test'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Revert Confirm Modal */}
        <Modal
          open={revertConfirmOpen}
          onOpenChange={setRevertConfirmOpen}
          title="Revert to Default?"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will remove all customizations and restore the original template. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRevertConfirmOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={handleRevert} disabled={reverting}>
                {reverting ? 'Reverting...' : 'Revert to Default'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
