'use client';

import { useState, useEffect } from 'react';

interface ExtractedEventData {
  name: string | null;
  description: string | null;
  start_utc: string | null;
  start_timezone: string;
  end_utc: string | null;
  end_timezone: string;
  currency: string;
  is_online: boolean;
  venue_details: string | null;
  ticket_type: string | null;
  ticket_price: number | null;
}

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({
    type: null,
    message: ''
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Phase 2 & 3 & 4 & 5 States
  const [documentText, setDocumentText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'extracting' | 'review' | 'creating' | 'success'>('upload');
  const [liveEventUrl, setLiveEventUrl] = useState('');
  const [formData, setFormData] = useState<ExtractedEventData>({
    name: '',
    description: '',
    start_utc: '',
    start_timezone: 'America/Edmonton',
    end_utc: '',
    end_timezone: 'America/Edmonton',
    currency: 'CAD',
    is_online: false,
    venue_details: '',
    ticket_type: 'free',
    ticket_price: 0
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.md'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentText(event.target?.result as string);
      };
      reader.readAsText(file);
    } else if (file) {
      alert("Please upload a .txt or .md file for now.");
    }
  };

  const handleExtract = async () => {
    if (!documentText.trim()) {
      alert("Please provide some document text first.");
      return;
    }

    setCurrentStep('extracting');
    setStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: documentText }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const ext = data.data;
        
        // Convert extracted ISO UTC datetimes to local format required by <input type="datetime-local" />
        const formatDateTimeLocal = (isoString: string | null) => {
          if (!isoString) return '';
          try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            // Offset back to local string format
            const tzoffset = date.getTimezoneOffset() * 60000; 
            const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
            return localISOTime;
          } catch {
            return '';
          }
        };

        setFormData({
          name: ext.name || '',
          description: ext.description || '',
          start_utc: formatDateTimeLocal(ext.start_utc),
          start_timezone: ext.start_timezone || 'America/Edmonton',
          end_utc: formatDateTimeLocal(ext.end_utc),
          end_timezone: ext.end_timezone || 'America/Edmonton',
          currency: ext.currency || 'CAD',
          is_online: ext.is_online ?? false,
          venue_details: ext.venue_details || '',
          ticket_type: ext.ticket_type || 'free',
          ticket_price: ext.ticket_price || 0
        });
        setCurrentStep('review');
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to extract data using Claude.' });
        setCurrentStep('upload');
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'A network error occurred during extraction.' });
      setCurrentStep('upload');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('creating');
    setStatus({ type: null, message: '' });

    const storedToken = sessionStorage.getItem('eventbrite_token');
    if (!storedToken) {
      setStatus({ type: 'error', message: 'Eventbrite token missing from session. Please reconnect.' });
      setIsAuthenticated(false);
      return;
    }

    try {
      const res = await fetch('/api/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setLiveEventUrl(data.event_url);
        setCurrentStep('success');
      } else {
        // Specific error handling for Eventbrite creation failure
        const errorMsg = data.details || data.error || 'Failed to create event on Eventbrite.';
        setStatus({ type: 'error', message: errorMsg });
        setCurrentStep('review');
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'A network error occurred during event publishing.' });
      setCurrentStep('review');
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setDocumentText('');
    setLiveEventUrl('');
    setStatus({ type: null, message: '' });
    setFormData({
      name: '',
      description: '',
      start_utc: '',
      start_timezone: 'America/Edmonton',
      end_utc: '',
      end_timezone: 'America/Edmonton',
      currency: 'CAD',
      is_online: false,
      venue_details: '',
      ticket_type: 'free',
      ticket_price: 0
    });
  };

  useEffect(() => {
    const storedToken = sessionStorage.getItem('eventbrite_token');
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatus({ type: 'error', message: 'Please enter a valid token.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/test-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus({ 
          type: 'success', 
          message: `Connection successful! Welcome, ${data.user.name || data.user.emails[0].email}.` 
        });
        sessionStorage.setItem('eventbrite_token', token.trim());
        setUserProfile(data.user);
        
        setTimeout(() => {
          setIsAuthenticated(true);
          setStatus({ type: null, message: '' });
        }, 1500);
      } else {
        setStatus({ 
          type: 'error', 
          message: data.error || 'Failed to authenticate with Eventbrite.' 
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'A network error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('eventbrite_token');
    setIsAuthenticated(false);
    setToken('');
    setCurrentStep('upload');
    setDocumentText('');
    setStatus({ type: null, message: '' });
    setUserProfile(null);
  };

  if (isAuthenticated) {
    return (
      <main className="app-container">
        <div className="dashboard-nav">
          <div>
            <h1 className="heading-gradient" style={{ fontSize: '1.5rem', marginBottom: 0 }}>Eventbrite Engine</h1>
          </div>
          <button onClick={handleLogout} className="btn btn-outline">
            Clear Token
          </button>
        </div>

        {status.type === 'error' && (
          <div className="status-message status-error" style={{ marginBottom: '1.5rem' }}>
            <strong>⚠</strong>
            <span>{status.message}</span>
          </div>
        )}

        {currentStep === 'upload' && (
          <div className="glass-panel">
            <div className="flex-between">
              <div>
                <h2 style={{ marginBottom: '0.5rem' }}>Upload Event Details</h2>
                <p className="subtitle" style={{ marginBottom: 0 }}>Provide a raw document or paste text to extract Eventbrite fields.</p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleExtract}
                disabled={!documentText.trim()}
              >
                Extract Fields →
              </button>
            </div>
            
            <div style={{ marginTop: '2rem' }}>
              <label 
                htmlFor="file-upload"
                className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ display: 'block' }}
              >
                <div className="upload-icon">📄</div>
                <h3 style={{ marginBottom: '0.5rem' }}>Drag & Drop Document</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  Supports .txt and .md files (Word .docx support coming soon)
                </p>
                
                <input 
                  type="file" 
                  id="file-upload" 
                  style={{ display: 'none' }} 
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                />
                <span className="btn btn-outline" style={{ display: 'inline-block' }}>
                  Browse Files
                </span>
              </label>

              <div className="input-group">
                <label htmlFor="raw-text" className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Or Paste Raw Text</span>
                  <span style={{ fontWeight: 'normal', textTransform: 'none' }}>{documentText.length} characters</span>
                </label>
                <textarea
                  id="raw-text"
                  className="textarea-field"
                  placeholder="Paste the raw event details, notes, or email thread here..."
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'extracting' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <span className="loader" style={{ width: '40px', height: '40px', borderWidth: '4px', display: 'inline-block', marginBottom: '1.5rem' }}></span>
            <h2>Extracting Details using Claude AI...</h2>
            <p className="subtitle" style={{ marginTop: '0.5rem' }}>Structuring event data, fixing dates, and setting defaults.</p>
          </div>
        )}

        {currentStep === 'creating' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <span className="loader" style={{ width: '40px', height: '40px', borderWidth: '4px', display: 'inline-block', marginBottom: '1.5rem' }}></span>
            <h2>Creating Draft on Eventbrite...</h2>
            <p className="subtitle" style={{ marginTop: '0.5rem' }}>Setting up draft, generating ticket tier, and preparing dashboard link.</p>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="glass-panel">
            <div className="flex-between" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <h2>Review Extracted Details</h2>
                <p className="subtitle" style={{ marginBottom: 0 }}>We highlighted missing fields in yellow. Please fill them in or adjust before publishing.</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-outline" type="button" onClick={() => setCurrentStep('upload')}>
                  ← Back to Upload
                </button>
                <button className="btn btn-primary" type="button" onClick={handleCreateEvent}>
                  Create Draft Event ✓
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateEvent}>
              <div className="form-group">
                <label className="input-label">
                  Event Title {!formData.name && <span className="warning-badge">Missing</span>}
                </label>
                <input
                  type="text"
                  className={`input-field ${!formData.name ? 'field-warning' : ''}`}
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Artificial Intelligence Workshop 2026"
                  required
                />
              </div>

              <div className="form-group">
                <label className="input-label">Description</label>
                <textarea
                  className="textarea-field"
                  style={{ minHeight: '120px' }}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Give a brief or detailed overview of the event..."
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="input-label">
                    Start Date & Time {!formData.start_utc && <span className="warning-badge">Missing</span>}
                  </label>
                  <input
                    type="datetime-local"
                    className={`input-field ${!formData.start_utc ? 'field-warning' : ''}`}
                    value={formData.start_utc || ''}
                    onChange={(e) => setFormData({ ...formData, start_utc: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">Start Timezone</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.start_timezone}
                    onChange={(e) => setFormData({ ...formData, start_timezone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="input-label">
                    End Date & Time {!formData.end_utc && <span className="warning-badge">Missing</span>}
                  </label>
                  <input
                    type="datetime-local"
                    className={`input-field ${!formData.end_utc ? 'field-warning' : ''}`}
                    value={formData.end_utc || ''}
                    onChange={(e) => setFormData({ ...formData, end_utc: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="input-label">End Timezone</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.end_timezone}
                    onChange={(e) => setFormData({ ...formData, end_timezone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="input-label">Location Type</label>
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${!formData.is_online ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, is_online: false })}
                    >
                      Venue (Physical)
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${formData.is_online ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, is_online: true })}
                    >
                      Online Event
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="input-label">Currency</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  />
                </div>
              </div>

              {!formData.is_online && (
                <div className="form-group">
                  <label className="input-label">
                    Venue Details {!formData.venue_details && <span className="warning-badge">Missing</span>}
                  </label>
                  <input
                    type="text"
                    className={`input-field ${!formData.venue_details ? 'field-warning' : ''}`}
                    value={formData.venue_details || ''}
                    onChange={(e) => setFormData({ ...formData, venue_details: e.target.value })}
                    placeholder="e.g. Edmonton Convention Centre, 9797 Jasper Ave, Edmonton, AB"
                  />
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="input-label">Ticket Type</label>
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${formData.ticket_type === 'free' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, ticket_type: 'free', ticket_price: 0 })}
                    >
                      Free Ticket
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${formData.ticket_type === 'paid' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, ticket_type: 'paid' })}
                    >
                      Paid Ticket
                    </button>
                  </div>
                </div>

                {formData.ticket_type === 'paid' && (
                  <div className="form-group">
                    <label className="input-label">Ticket Price ({formData.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={formData.ticket_price || ''}
                      onChange={(e) => setFormData({ ...formData, ticket_price: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 29.99"
                      required
                    />
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'spin 0.5s ease' }}>🎉</div>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Draft Event Created!</h2>
            <p className="subtitle" style={{ marginBottom: '2.5rem' }}>We successfully parsed and saved your event as a draft on Eventbrite.</p>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '2rem', borderRadius: '12px', marginBottom: '2.5rem' }}>
              <h3 style={{ marginBottom: '1rem', color: '#c084fc' }}>{formData.name}</h3>
              <a 
                href={liveEventUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Open Draft in Dashboard ↗
              </a>
            </div>

            <button className="btn btn-outline" onClick={handleReset}>
              Create Another Event
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="app-container">
      <div className="center-wrapper">
        <div className="glass-panel" style={{ maxWidth: '500px', width: '100%' }}>
          <h1 className="heading-gradient" style={{ fontSize: '2.5rem' }}>Setup Connection</h1>
          <p className="subtitle">Connect your Eventbrite account to continue.</p>
          
          <form onSubmit={handleTestConnection}>
            <div className="input-group">
              <label htmlFor="token" className="input-label">Private Token</label>
              <input
                id="token"
                type="password"
                className="input-field"
                placeholder="Paste your Eventbrite token..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loader"></span> Testing Connection...
                </>
              ) : (
                'Test & Connect'
              )}
            </button>
          </form>

          {status.type && (
            <div className={`status-message ${status.type === 'success' ? 'status-success' : 'status-error'}`}>
              <strong>{status.type === 'success' ? '✓' : '⚠'}</strong>
              <span>{status.message}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
