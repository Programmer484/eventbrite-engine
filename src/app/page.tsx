'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({
    type: null,
    message: ''
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [documentText, setDocumentText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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

  const handleProceed = () => {
    if (!documentText.trim()) {
      alert("Please provide some document text first.");
      return;
    }
    // For now just console log, phase 3 will use this
    alert("Phase 2 complete! Document text is ready for Phase 3 extraction. Length: " + documentText.length);
  };

  useEffect(() => {
    // Check session storage on load
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
        
        // Short delay to let user see success message before transitioning
        setTimeout(() => {
          setIsAuthenticated(true);
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
        
        <div className="glass-panel">
          <div className="flex-between">
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>Upload Event Details</h2>
              <p className="subtitle" style={{ marginBottom: 0 }}>Provide a raw document or paste text to extract Eventbrite fields.</p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleProceed}
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
