import { useState } from 'react';
import { ExternalLink, Download, FileText, AlertCircle } from 'lucide-react';
import { Dialog, Button } from '../../design-system';
import { safeDownload } from './api';

export interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url?: string | undefined;
  mimeType?: string | undefined;
  downloadPath?: string | undefined;
  category?: string | undefined;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  url: rawUrl,
  mimeType,
  downloadPath,
  category,
}: DocumentPreviewDialogProps) {
  const [frameError, setFrameError] = useState(false);
  const url = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;

  const isImage = Boolean(
    mimeType?.startsWith('image/') ||
      (url && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url)) ||
      (title && /\.(png|jpe?g|webp|gif|svg)$/i.test(title)),
  );
  const isWord = Boolean(
    mimeType === 'application/msword' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      (url && /\.(docx?|doc)(\?.*)?$/i.test(url)) ||
      (title && /\.(docx?|doc)$/i.test(title)),
  );
  const isPdf = Boolean(
    !isWord &&
      !isImage &&
      (mimeType === 'application/pdf' ||
        (url && /\.pdf(\?.*)?$/i.test(url)) ||
        (title && /\.pdf$/i.test(title)) ||
        mimeType === undefined),
  );


  const handleDownload = () => {
    if (downloadPath) {
      void safeDownload(downloadPath);
    } else if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFrameError(false);
        onOpenChange(next);
      }}
      title={title || 'Document Preview'}
      description={
        category ? `Category: ${category.replaceAll('-', ' ')}` : undefined
      }
      className="tvx-doc-preview-dialog"
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {url && (
              <Button
                variant="secondary"
                onClick={handleOpenExternal}
                leadingIcon={<ExternalLink size={14} />}
              >
                Open in new tab
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleDownload}
              leadingIcon={<Download size={14} />}
            >
              Download
            </Button>
          </div>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: '400px',
        }}
      >
        {!url ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: '#64748b',
            }}
          >
            <AlertCircle size={36} color="#94a3b8" />
            <p style={{ margin: 0, fontSize: '15px' }}>
              Preview link is currently unavailable.
            </p>
          </div>
        ) : isImage ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              maxHeight: '70vh',
              overflow: 'hidden',
            }}
          >
            <img
              src={url}
              alt={title}
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                objectFit: 'contain',
                borderRadius: '6px',
              }}
            />
          </div>
        ) : isWord ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
              }}
            >
              <FileText size={40} />
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: '#dbeafe',
                  color: '#1e40af',
                  marginBottom: '8px',
                }}
              >
                Microsoft Word Document
              </span>
              <strong
                style={{ display: 'block', fontSize: '16px', color: '#0f172a' }}
              >
                {title}
              </strong>
              <p
                style={{
                  margin: '8px auto 0 auto',
                  maxWidth: '480px',
                  fontSize: '13px',
                  color: '#64748b',
                  lineHeight: '1.5',
                }}
              >
                Microsoft Word files (.docx / .doc) cannot be rendered directly
                inside web browsers. You can download or open the file to view
                it in Word or your preferred document reader.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button
                variant="primary"
                onClick={handleDownload}
                leadingIcon={<Download size={14} />}
              >
                Download to view
              </Button>
              {url && (
                <Button
                  variant="secondary"
                  onClick={handleOpenExternal}
                  leadingIcon={<ExternalLink size={14} />}
                >
                  Open in new tab
                </Button>
              )}
            </div>
          </div>
        ) : isPdf && !frameError ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '100%',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '68vh',
                minHeight: '480px',
                background: '#f8fafc',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}
            >
              <object
                data={`${url}#toolbar=1`}
                type="application/pdf"
                style={{ width: '100%', height: '100%', display: 'block' }}
                onError={() => setFrameError(true)}
              >
                <iframe
                  src={`${url}#toolbar=1`}
                  title={title}
                  onError={() => setFrameError(true)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </object>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: '#f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              <span>Having trouble viewing the PDF preview inside this window?</span>
              <button
                type="button"
                onClick={handleOpenExternal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4338ca',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Click here to view in a new tab ↗
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderRadius: '50%',
                background: '#e0e7ff',
                color: '#4338ca',
              }}
            >
              <FileText size={36} />
            </div>
            <div>
              <strong
                style={{ display: 'block', fontSize: '16px', color: '#0f172a' }}
              >
                {title}
              </strong>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: '#64748b',
                }}
              >
                Direct inline preview is not supported for this file type or
                browser.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="secondary"
                onClick={handleOpenExternal}
                leadingIcon={<ExternalLink size={14} />}
              >
                Open document
              </Button>
              <Button
                variant="primary"
                onClick={handleDownload}
                leadingIcon={<Download size={14} />}
              >
                Download file
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
